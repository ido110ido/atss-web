import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase-admin";

// Goes through the same transition logic as the WhatsApp webhook
// (functions/src/lib/deliveryActions.ts) — e.g. manually setting
// "in_progress" sends the worker the exact message they'd get from tapping
// "Start unloading" themselves.
export async function updateDeliveryStatus(deliveryId, status) {
  const fn = httpsCallable(functions, "updateDeliveryStatus");
  const result = await fn({ deliveryId, status });
  return result.data;
}
