import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { COLLECTIONS, WorkerDoc, DeliveryDoc } from "../config/constants.js";
import { DeliveryRow } from "./excelParser.js";

/**
 * Fetches all active workers for a company in one query and groups them by
 * address. Company-scoped so two companies can reuse the same address
 * without their deliveries crossing over.
 * Called once per import to avoid one round-trip per store (400+ queries).
 * @param {string} company company identifier
 * @return {Promise<Map>} Map of address to the active workers at that address.
 */
async function getAllActiveWorkersByStore(
  company: string,
): Promise<Map<string, Array<WorkerDoc & { id: string }>>> {
  const snap = await db
    .collection(COLLECTIONS.WORKERS)
    .where("company", "==", company)
    .where("active", "==", true)
    .get();

  const byStore = new Map<string, Array<WorkerDoc & { id: string }>>();
  for (const d of snap.docs) {
    const worker = { id: d.id, ...(d.data() as WorkerDoc) };
    const list = byStore.get(worker.address) ?? [];
    list.push(worker);
    byStore.set(worker.address, list);
  }
  return byStore;
}

/**
 * Builds a stable key identifying a "physical" delivery, independent of
 * which worker it eventually fans out to — used to detect duplicates.
 * @param {string} date YYYY-MM-DD
 * @param {string} expectedTime HH:MM
 * @param {string} driverName driver name from the Excel row
 * @param {string} storeBranch branch code from the Excel row
 * @return {string} a stable signature string
 */
function deliverySignature(
  date: string,
  expectedTime: string,
  driverName: string,
  storeBranch: string,
): string {
  return `${date}|${expectedTime}|${driverName}|${storeBranch}`;
}

/**
 * Fetches the signatures of all existing deliveries for this company on any
 * of the given dates, so a new import can skip rows that already exist
 * (e.g. the same file re-uploaded, or overlapping rows across two files).
 * @param {string} company company identifier
 * @param {string[]} dates unique YYYY-MM-DD dates present in the new rows
 * @return {Promise<Set<string>>} signatures of existing deliveries
 */
async function getExistingDeliverySignatures(company: string, dates: string[]): Promise<Set<string>> {
  const signatures = new Set<string>();
  if (dates.length === 0) return signatures;

  // Firestore "in" queries support at most 30 values.
  for (let i = 0; i < dates.length; i += 30) {
    const batch = dates.slice(i, i + 30);
    const snap = await db
      .collection(COLLECTIONS.DELIVERIES)
      .where("company", "==", company)
      .where("date", "in", batch)
      .get();

    for (const doc of snap.docs) {
      const d = doc.data() as DeliveryDoc;
      signatures.add(deliverySignature(d.date, d.expectedTime, d.driverName, d.storeBranch));
    }
  }
  return signatures;
}

/**
 * Creates a delivery document for every (Excel row x worker) pair.
 * A row is matched to workers by address — every active worker at a store
 * gets their own delivery doc for each incoming delivery to that store.
 * Rows matching an existing delivery's date/time/driver/branch are skipped.
 *
 * Uses BulkWriter so writes above 500 are chunked automatically.
 * @param {DeliveryRow[]} rows parsed rows from the daily deliveries Excel
 * @param {string} importId doc ID of the import audit record
 * @param {string} company company identifier these deliveries belong to
 * @return {Promise<number>} total number of delivery documents created
 */
export async function createDeliveriesFromRows(
  rows: DeliveryRow[],
  importId: string,
  company: string,
): Promise<number> {
  // 1 query for all workers instead of 1 per store
  const workersByStore = await getAllActiveWorkersByStore(company);

  // Skip rows that duplicate an existing delivery (same date, time, driver,
  // and branch) — catches both re-uploads of the same file and duplicate
  // rows within a single file.
  const uniqueDates = [...new Set(rows.map((r) => r.date))];
  const seenSignatures = await getExistingDeliverySignatures(company, uniqueDates);

  // Group delivery rows by address — this must match the key used in
  // getAllActiveWorkersByStore (worker.address), since that's the actual
  // assignment relationship. storeBranch is carried through purely as a
  // display label, it's not part of the matching logic.
  const byStore = new Map<string, DeliveryRow[]>();
  let skippedDuplicates = 0;
  for (const row of rows) {
    const signature = deliverySignature(row.date, row.expectedTime, row.driverName, row.storeBranch);
    if (seenSignatures.has(signature)) {
      skippedDuplicates++;
      continue;
    }
    seenSignatures.add(signature);

    const list = byStore.get(row.address) ?? [];
    list.push(row);
    byStore.set(row.address, list);
  }

  if (skippedDuplicates > 0) {
    console.warn(
      `Skipped ${skippedDuplicates} duplicate delivery row(s) (same date, time, driver, and branch as an existing delivery)`,
    );
  }

  // BulkWriter auto-chunks at 500, runs batches in parallel, retries on error
  const writer = db.bulkWriter();
  let count = 0;

  for (const [address, storeRows] of byStore) {
    const workers = workersByStore.get(address) ?? [];

    if (workers.length === 0) {
      console.warn(`Store ${address}: no workers, skipping ${storeRows.length} rows`);
      continue;
    }

    for (const worker of workers) {
      for (const row of storeRows) {
        const ref = db.collection(COLLECTIONS.DELIVERIES).doc();
        const doc: DeliveryDoc & { createdAt: FieldValue } = {
          company,
          workerId: worker.id,
          workerName: worker.name,
          workerPhone: worker.phone,
          driverName: row.driverName,
          licensePlate: row.licensePlate,
          boxCount: row.boxCount,
          storeBranch: row.storeBranch,
          address: row.address,
          date: row.date,
          expectedTime: row.expectedTime,
          status: "pending",
          importId,
          createdAt: FieldValue.serverTimestamp(),
        };
        writer.set(ref, doc);
        count++;
      }
    }
  }

  await writer.close();
  return count;
}

/**
 * Returns all pending delivery docs for today (Jerusalem timezone),
 * optionally scoped to a single company (used by the manual trigger so a
 * dashboard user only ever pushes their own company's deliveries).
 * Used by morningPush to build each worker's delivery list.
 * @param {string} [company] restrict results to this company only
 * @return {Promise<Array>} today's pending deliveries with document IDs.
 */
export async function getTodaysPendingDeliveries(
  company?: string,
): Promise<Array<DeliveryDoc & { id: string }>> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  let q = db
    .collection(COLLECTIONS.DELIVERIES)
    .where("date", "==", today)
    .where("status", "==", "pending");
  if (company) q = q.where("company", "==", company);

  const snap = await q.get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryDoc) }));
}

export async function getAllPendingDeliveries(
  company?: string,
): Promise<Array<DeliveryDoc & { id: string }>> {
  let q = db.collection(COLLECTIONS.DELIVERIES).where("status", "==", "pending");
  if (company) q = q.where("company", "==", company);

  const snap = await q.get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryDoc) }));
}
