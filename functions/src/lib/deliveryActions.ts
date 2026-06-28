import { db } from "./firebase.js";
import { COLLECTIONS, DeliveryDoc, DeliveryStatus } from "../config/constants.js";
import { sendText, sendInteractiveButtons } from "./whatsapp.js";

/**
 * Applies a delivery status transition and sends the worker the same
 * WhatsApp message they'd get from pressing the corresponding button
 * themselves. Shared between the inbound webhook (button taps) and the
 * dashboard's manual status-override action, so both paths stay identical.
 * @param {string} deliveryId Firestore doc ID of the delivery
 * @param {DeliveryStatus} targetStatus status to transition to
 * @return {Promise<{messaged: boolean}>} whether a WhatsApp message was sent
 */
export async function applyDeliveryStatusTransition(
  deliveryId: string,
  targetStatus: DeliveryStatus,
): Promise<{ messaged: boolean }> {
  const deliveryRef = db.collection(COLLECTIONS.DELIVERIES).doc(deliveryId);
  const snap = await deliveryRef.get();
  if (!snap.exists) {
    throw new Error(`Delivery ${deliveryId} not found`);
  }
  const delivery = snap.data() as DeliveryDoc;
  const phone = delivery.workerPhone;

  if (targetStatus === "in_progress") {
    await deliveryRef.update({ status: "in_progress" });
    await sendText(phone, `Unloading started for the delivery at store ${delivery.storeBranch}.`);
    await sendInteractiveButtons(phone, "Tap below once you're done unloading.", [
      { id: `delivery_id: ${deliveryId},status:awaiting_photo`, title: "Finished unloading" },
    ]);
    return { messaged: true };
  }

  if (targetStatus === "awaiting_photo") {
    await deliveryRef.update({ status: "awaiting_photo" });
    await db.collection(COLLECTIONS.WORKERS).doc(delivery.workerId).update({
      pendingPhotoDeliveryId: deliveryId,
    });
    await sendText(phone, "Please send a photo of the unloaded goods to confirm completion.");
    return { messaged: true };
  }

  if (targetStatus === "issue") {
    await deliveryRef.update({ status: "issue" });
    await sendText(phone, "Got it — we've flagged an issue with this delivery.");
    return { messaged: true };
  }

  // pending / sent / done — no equivalent worker button press to mirror
  // (in particular, "done" is normally only reached via an actual photo, so
  // there's no honest "as if they pressed a button" message for it), just
  // update the status directly.
  await deliveryRef.update({ status: targetStatus });
  return { messaged: false };
}
