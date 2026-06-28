import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firebase.js";
import { COLLECTIONS, DeliveryDoc, DeliveryStatus } from "../config/constants.js";
import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } from "../lib/whatsapp.js";
import { applyDeliveryStatusTransition } from "../lib/deliveryActions.js";

const VALID_STATUSES: DeliveryStatus[] = ["pending", "sent", "in_progress", "awaiting_photo", "done", "issue"];

/**
 * Manual Trigger (Dashboard status dropdown)
 * Lets a dispatcher override a delivery's status directly. Goes through the
 * same applyDeliveryStatusTransition used by the WhatsApp webhook, so e.g.
 * setting "in_progress" here sends the worker the exact same message they'd
 * get from tapping "Start unloading" themselves.
 */
export const updateDeliveryStatus = onCall(
  {
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    const email = request.auth?.token.email?.toLowerCase();
    if (!email) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { deliveryId, status } = request.data as { deliveryId?: string; status?: string };
    if (!deliveryId || !status || !VALID_STATUSES.includes(status as DeliveryStatus)) {
      throw new HttpsError("invalid-argument", "deliveryId and a valid status are required.");
    }

    const userSnap = await db.collection("users").doc(email).get();
    const profile = userSnap.data() as { company?: string; active?: boolean } | undefined;
    if (!userSnap.exists || !profile?.active || !profile.company) {
      throw new HttpsError("permission-denied", "Your account doesn't have access.");
    }

    const deliverySnap = await db.collection(COLLECTIONS.DELIVERIES).doc(deliveryId).get();
    if (!deliverySnap.exists) {
      throw new HttpsError("not-found", "Delivery not found.");
    }
    const delivery = deliverySnap.data() as DeliveryDoc;
    if (delivery.company !== profile.company) {
      throw new HttpsError("permission-denied", "This delivery doesn't belong to your company.");
    }

    try {
      const result = await applyDeliveryStatusTransition(deliveryId, status as DeliveryStatus);
      logger.info("Manual delivery status update", { deliveryId, status, company: profile.company });
      return result;
    } catch (err) {
      logger.error("Manual delivery status update failed", {
        deliveryId,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError("internal", "Failed to update delivery status.");
    }
  },
);
