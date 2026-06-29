import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firebase.js";
import { COLLECTIONS, WorkerDoc } from "../config/constants.js";

/**
 * When a worker's phone number changes (e.g. edited from the dashboard),
 * propagate it to every one of their deliveries that isn't done yet, so the
 * morning push / button replies / photo confirmation keep messaging the
 * right number. Deliveries already marked "done" are left untouched — they
 * keep the phone number that was actually used, which is accurate history.
 */
export const onWorkerPhoneChanged = onDocumentUpdated(`${COLLECTIONS.WORKERS}/{workerId}`, async (event) => {
  const before = event.data?.before.data() as WorkerDoc | undefined;
  const after = event.data?.after.data() as WorkerDoc | undefined;
  if (!before || !after || before.phone === after.phone) return;

  const workerId = event.params.workerId;

  const snap = await db
    .collection(COLLECTIONS.DELIVERIES)
    .where("workerId", "==", workerId)
    .where("status", "in", ["pending", "sent", "in_progress", "awaiting_photo", "issue"])
    .get();

  if (snap.empty) {
    logger.info("Worker phone changed, no active deliveries to update", { workerId });
    return;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { workerPhone: after.phone });
  }
  await batch.commit();

  logger.info(`Worker phone changed — updated workerPhone on ${snap.size} active delivery doc(s)`, {
    workerId,
    oldPhone: before.phone,
    newPhone: after.phone,
  });
});
