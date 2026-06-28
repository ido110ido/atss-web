import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db, storage } from "../lib/firebase.js";
import { COLLECTIONS, DeliveryDoc, DeliveryStatus, WorkerDoc } from "../config/constants.js";
import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, sendText, downloadMedia } from "../lib/whatsapp.js";
import { applyDeliveryStatusTransition } from "../lib/deliveryActions.js";

export const whatsappWebhook = onRequest(
  {
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN],
    timeoutSeconds: 60, // Extended timeout for Graph API media downloads
    memory: "256MiB",
  },
  async (req, res) => {
    // GET — webhook verification handshake from Meta
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN.value()) {
        logger.info("Webhook verified");
        res.status(200).send(challenge);
      } else {
        res.status(403).send("Forbidden");
      }
      return;
    }

    // POST — inbound message event from Meta
    if (req.method === "POST") {
      try {
        const body = req.body;

        // Validate payload origin
        if (body?.object !== "whatsapp_business_account") {
          res.status(404).send("Not Found");
          return;
        }

        // Process batches securely, avoiding hardcoded array indexes
        if (Array.isArray(body?.entry)) {
          for (const entry of body.entry) {
            if (!Array.isArray(entry.changes)) continue;

            for (const change of entry.changes) {
              const value = change.value;
              if (!value) continue;

              if (Array.isArray(value.messages)) {
                // Process all messages asynchronously
                for (const msg of value.messages) {
                  await handleInboundMessage(msg);
                }
              }

              if (Array.isArray(value.statuses)) {
                // Process delivery receipts
                for (const status of value.statuses) {
                  logger.info("Delivery status update", { status });
                }
              }
            }
          }
        }

        // ACK only after all processing finishes to prevent termination
        res.status(200).send("OK");
      } catch (err) {
        logger.error("Error processing webhook payload", {
          error: err instanceof Error ? err.message : String(err),
        });
        // 500 forces Meta to retry sending the payload later
        res.status(500).send("Internal Server Error");
      }
      return;
    }

    res.status(405).send("Method Not Allowed");
  },
);

/**
 * Routes an inbound WhatsApp message to the correct handler by type.
 * @param {Record<string, unknown>} msg raw message object from Meta webhook
 * @return {Promise<void>}
 */
async function handleInboundMessage(msg: Record<string, unknown>): Promise<void> {
  const from = String(msg.from ?? "");
  const type = String(msg.type ?? "");

  if (!from || !type) {
    logger.warn("Malformed message received, missing fields", { msg });
    return;
  }

  logger.info("Inbound message", { from, type });

  if (type === "button" || type === "interactive") {
    await handleButtonReply(from, msg);
  } else if (type === "image") {
    await handlePhoto(from, msg);
  } else if (type === "text") {
    await sendText(from, "קיבלתי את ההודעה שלך! הבוט מחובר בהצלחה.");
  } else {
    logger.info("Unhandled message type", { type, from });
  }
}

/**
 * Parses a button payload of the form "delivery_id: X,status:Y" into its
 * parts. Tolerant of the inconsistent spacing used when the buttons are
 * built (see morningPush.ts).
 * @param {string} payload raw button reply ID
 * @return {{deliveryId: string, status: string} | null} parsed fields, or
 * null if the payload doesn't contain both keys
 */
function parseButtonPayload(payload: string): { deliveryId: string; status: string } | null {
  let deliveryId = "";
  let status = "";

  for (const part of payload.split(",")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "delivery_id") deliveryId = value;
    if (key === "status") status = value;
  }

  logger.info("Parsed button payload", { payload, deliveryId, status });
  return deliveryId && status ? { deliveryId, status } : null;
}

/**
 * Handles a button-reply interactive message — the start/finish-unloading
 * and issue-report buttons sent with the morning delivery list.
 * @param {string} from sender phone number in E.164 format
 * @param {Record<string, unknown>} msg raw message object
 * @return {Promise<void>}
 */
async function handleButtonReply(from: string, msg: Record<string, unknown>): Promise<void> {
  // Two different shapes depending on where the button came from:
  // - type "button": quick-reply on an approved template message (e.g. the
  //   "Start unloading" / "Report issue" buttons sent with the delivery
  //   item template) — payload lives at msg.button.payload.
  // - type "interactive": reply to a freeform interactive message we sent
  //   ourselves via sendInteractiveButtons (e.g. "Finished unloading") —
  //   payload lives at msg.interactive.button_reply.id.
  let buttonId = "";
  if (msg.type === "button") {
    const button = msg.button as Record<string, unknown> | undefined;
    buttonId = String(button?.payload ?? "");
  } else {
    const interactive = msg.interactive as Record<string, unknown> | undefined;
    const reply = interactive?.button_reply as Record<string, unknown> | undefined;
    buttonId = String(reply?.id ?? "");
  }

  if (!buttonId) {
    logger.warn("Missing button ID in reply payload", { from, type: msg.type });
    return;
  }

  logger.info("Button reply", { from, buttonId });

  const parsed = parseButtonPayload(buttonId);
  if (!parsed) {
    logger.warn("Unrecognized button payload", { from, buttonId });
    return;
  }
  const { deliveryId, status } = parsed;

  const deliveryRef = db.collection(COLLECTIONS.DELIVERIES).doc(deliveryId);
  const snap = await deliveryRef.get();
  if (!snap.exists) {
    logger.warn("Button reply for unknown delivery", { from, deliveryId });
    await sendText(from, "We couldn't find that delivery — it may have been removed.");
    return;
  }
  const delivery = snap.data() as DeliveryDoc;

  if (delivery.workerPhone !== from) {
    logger.warn("Button reply phone mismatch", {
      from,
      deliveryId,
      expected: delivery.workerPhone,
    });
    return;
  }

  // `status` here is the TARGET status encoded in the button payload (see
  // morningPush.ts), not the delivery's current status.
  if (!["in_progress", "awaiting_photo", "issue"].includes(status)) {
    logger.warn("Unknown button status", { from, deliveryId, status });
    return;
  }

  await applyDeliveryStatusTransition(deliveryId, status as DeliveryStatus);
}

/**
 * Handles an inbound photo message — the unloading confirmation photo.
 * Downloads the media from the Graph API, saves it to Storage, and only
 * then marks the worker's pending delivery as done.
 * @param {string} from sender phone number in E.164 format
 * @param {Record<string, unknown>} msg raw message object
 * @return {Promise<void>}
 */
async function handlePhoto(from: string, msg: Record<string, unknown>): Promise<void> {
  const image = msg.image as Record<string, unknown> | undefined;
  const mediaId = String(image?.id ?? "");

  if (!mediaId) {
    logger.warn("Missing media ID in image payload", { from });
    return;
  }

  logger.info("Photo received", { from, mediaId });

  const workerSnap = await db
    .collection(COLLECTIONS.WORKERS)
    .where("phone", "==", from)
    .limit(1)
    .get();
  if (workerSnap.empty) {
    logger.warn("Photo from unknown worker phone", { from });
    await sendText(from, "We couldn't find your worker profile — please contact your admin.");
    return;
  }
  const workerRef = workerSnap.docs[0].ref;
  const worker = workerSnap.docs[0].data() as WorkerDoc;
  const deliveryId = worker.pendingPhotoDeliveryId;

  if (!deliveryId) {
    await sendText(
      from,
      'We weren\'t expecting a photo right now — tap "Finished unloading" first.',
    );
    return;
  }

  try {
    const buffer = await downloadMedia(mediaId);
    const photoPath = `photos/${deliveryId}/${mediaId}.jpg`;
    // These photos never change once saved, so cache aggressively — the
    // dashboard re-displays the same confirmation photo on every visit to
    // the Completed page.
    await storage.bucket().file(photoPath).save(buffer, {
      contentType: "image/jpeg",
      metadata: { cacheControl: "public, max-age=2592000" }, // 30 days
    });

    await db.collection(COLLECTIONS.DELIVERIES).doc(deliveryId).update({
      status: "done",
      photoPath,
    });
    await workerRef.update({ pendingPhotoDeliveryId: null });

    await sendText(from, "Photo received — delivery marked as done. Thank you!");
  } catch (err) {
    logger.error("Failed to process confirmation photo", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendText(from, "We couldn't save your photo — please try sending it again.");
  }
}
