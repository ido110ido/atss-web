import ExcelJS from "exceljs";
import { DELIVERY_COL, WORKER_COL } from "../config/constants.js";

export interface DeliveryRow {
  driverName: string;
  licensePlate: string;
  boxCount: number;
  storeBranch: string;
  address: string;
  date: string; // YYYY-MM-DD
  expectedTime: string; // HH:MM
}

/**
 * Converts a value to a YYYY-MM-DD date string, or null if not a Date.
 * @param {unknown} val - The value to convert.
 * @return {string | null} Formatted date string or null.
 */
function toDateString(val: unknown): string | null {
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Converts a value to an HH:MM time string, or null if not a Date or number.
 * @param {unknown} val - The value to convert.
 * @return {string | null} Formatted time string or null.
 */
function toTimeString(val: unknown): string | null {
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, "0");
    const m = String(val.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof val === "number") {
    // Fractional day: 0.333... = 08:00
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Parses a delivery Excel buffer and returns an array of DeliveryRow.
 * @param {Buffer} buffer - The raw Excel file bytes.
 * @return {Promise<DeliveryRow[]>} Parsed delivery rows.
 */
export async function parseDeliveryExcel(buffer: Buffer): Promise<DeliveryRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];

  const results: DeliveryRow[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // row.values is 1-indexed; index 0 is always undefined
    const values = row.values as Array<unknown>;

    if (rowNumber === 1) {
      headers = values.map((v) => (typeof v === "string" ? v : ""));
      return;
    }

    const cell = (key: string): unknown => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (values[idx] ?? null) : null;
    };

    const driverName = String(cell(DELIVERY_COL.DRIVER_NAME) ?? "").trim();
    const licensePlate = String(cell(DELIVERY_COL.LICENSE_PLATE) ?? "").trim();
    const boxCount = Number(cell(DELIVERY_COL.BOX_COUNT) ?? 0);
    const storeBranch = String(cell(DELIVERY_COL.STORE_BRANCH) ?? "").trim();
    // Optional — display-only, so a missing/wrong header doesn't break the import.
    const address = String(cell(DELIVERY_COL.ADDRESS) ?? "").trim();
    const date = toDateString(cell(DELIVERY_COL.DATE));
    const expectedTime = toTimeString(cell(DELIVERY_COL.EXPECTED_TIME));

    if (!driverName || !storeBranch || !date || !expectedTime) return;

    results.push({ driverName, licensePlate, boxCount, storeBranch, address, date, expectedTime });
  });

  return results;
}

export interface WorkerRow {
  name: string;
  phone: string;
  address: string;
}

/**
 * Parses a workers Excel buffer and returns an array of WorkerRow.
 * @param {Buffer} buffer - The raw Excel file bytes.
 * @return {Promise<WorkerRow[]>} Parsed worker rows.
 */
export async function parseWorkerExcel(buffer: Buffer): Promise<WorkerRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];

  const results: WorkerRow[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as Array<unknown>;

    if (rowNumber === 1) {
      headers = values.map((v) => (typeof v === "string" ? v : ""));
      return;
    }

    const cell = (key: string): unknown => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (values[idx] ?? null) : null;
    };

    const name = String(cell(WORKER_COL.NAME) ?? "").trim();
    const phone = String(cell(WORKER_COL.PHONE) ?? "").trim();
    const address = String(cell(WORKER_COL.ADDRESS) ?? "").trim();

    if (!name || !phone || !address) return;

    results.push({ name, phone, address });
  });

  return results;
}
