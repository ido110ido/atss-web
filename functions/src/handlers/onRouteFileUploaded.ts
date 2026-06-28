import { onObjectFinalized, StorageEvent } from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db, storage } from "../lib/firebase.js";
import { COLLECTIONS, normalizePhone, workerDocId } from "../config/constants.js";
import { parseDeliveryExcel, parseWorkerExcel } from "../lib/excelParser.js";
import { createDeliveriesFromRows } from "../lib/deliveries.js";

export const onRouteFileUploaded = onObjectFinalized(async (event) => {
  const filePath = event.data.name ?? "";

  if (filePath.startsWith("imports/")) {
    await onDeliveryFileUploaded(filePath, event);
  }

  if (filePath.startsWith("workers/")) {
    await onWorkerFileUploaded(filePath, event);
  }
});

/**
 * Extracts the company segment from an `{imports,workers}/{company}/{file}`
 * storage path.
 * @param {string} filePath full storage object path
 * @return {string | null} the company identifier, or null if malformed
 */
function companyFromPath(filePath: string): string | null {
  const parts = filePath.split("/");
  return parts.length >= 3 && parts[1] ? parts[1] : null;
}

const onDeliveryFileUploaded = async (filePath: string, event: StorageEvent) => {
  const fileName = filePath.split("/").pop() ?? filePath;
  const company = companyFromPath(filePath);

  if (!company) {
    logger.error("Route file path missing company segment, expected imports/{company}/{file}", {
      filePath,
    });
    return;
  }

  logger.info("Processing route file", { filePath, company });

  // Create import audit doc
  const importRef = db.collection(COLLECTIONS.IMPORTS).doc();
  await importRef.set({
    company,
    fileName,
    storagePath: filePath,
    deliveryCount: 0,
    status: "processing",
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    const bucket = storage.bucket(event.data.bucket);
    const [buffer] = await bucket.file(filePath).download();

    const rows = await parseDeliveryExcel(buffer);
    logger.info(`Parsed ${rows.length} rows from ${fileName}`);

    const count = await createDeliveriesFromRows(rows, importRef.id, company);

    await importRef.update({ deliveryCount: count, status: "done" });

    logger.info(`Import done — ${count} docs created`, { importId: importRef.id, company });
  } catch (err) {
    logger.error("Import failed", { err });
    await importRef.update({ status: "error", error: String(err) });
  }
};

const onWorkerFileUploaded = async (filePath: string, event: StorageEvent) => {
  const fileName = filePath.split("/").pop() ?? filePath;
  const company = companyFromPath(filePath);

  if (!company) {
    logger.error("Workers file path missing company segment, expected workers/{company}/{file}", {
      filePath,
    });
    return;
  }

  logger.info("Processing workers file", { filePath, company });

  const importRef = db.collection(COLLECTIONS.WORKER_IMPORTS).doc();
  await importRef.set({
    company,
    fileName,
    storagePath: filePath,
    workerCount: 0,
    status: "processing",
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    const bucket = storage.bucket(event.data.bucket);
    const [buffer] = await bucket.file(filePath).download();

    const rows = await parseWorkerExcel(buffer);
    logger.info(`Parsed ${rows.length} workers from ${fileName}`);

    const batch = db.batch();
    for (const row of rows) {
      const phone = normalizePhone(row.phone);
      const ref = db.collection(COLLECTIONS.WORKERS).doc(workerDocId(company, phone));
      batch.set(
        ref,
        {
          company,
          name: row.name,
          phone,
          address: row.address,
          active: true,
        },
        { merge: true },
      );
    }
    await batch.commit();

    await importRef.update({ workerCount: rows.length, status: "done" });

    logger.info(`Added or updated ${rows.length} workers`, { company });
  } catch (err) {
    logger.error("Workers import failed", { err });
    await importRef.update({ status: "error", error: String(err) });
  }
};
