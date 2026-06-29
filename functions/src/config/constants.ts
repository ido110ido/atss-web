export const COLLECTIONS = {
  WORKERS: "workers",
  DELIVERIES: "deliveries",
  IMPORTS: "imports",
  WORKER_IMPORTS: "workerImports",
} as const;

export const DELIVERY_COL = {
  DRIVER_NAME: "שם הנהג",
  STORE_BRANCH: "סניף",
  ADDRESS: "כתובת",
  DATE: "תאריך",
  EXPECTED_TIME: "שעת הגעה צפויה",
  LICENSE_PLATE: "לוחית רישוי",
  BOX_COUNT: "כמות קופסאות",
} as const;

// Hebrew column headers in the workers Excel (used by seed script)
export const WORKER_COL = {
  NAME: "שם עובד",
  PHONE: "מספר טלפון",
  ADDRESS: "כתובת",
} as const;

// awaiting_photo: worker tapped "Finished unloading" but hasn't sent the
// confirmation photo yet — the delivery only reaches "done" once the photo
// is downloaded from WhatsApp and saved to Storage.
export type DeliveryStatus =
  | "pending"
  | "sent"
  | "in_progress"
  | "awaiting_photo"
  | "done"
  | "issue";

export interface WorkerDoc {
  company: string;
  name: string;
  phone: string; // E.164: "972501234567"
  address: string;
  language: string | null;
  active: boolean;
  // Set when this worker taps "Finished unloading"; cleared once their next
  // photo is saved. Assumes a worker confirms one delivery at a time.
  pendingPhotoDeliveryId?: string | null;
}

export interface DeliveryDoc {
  company: string;
  workerId: string; // FK to workers — a stable random doc ID, not derived from phone
  workerName: string;
  workerPhone: string;
  driverName: string;
  licensePlate: string;
  boxCount: number;
  storeBranch: string; // branch code, e.g. "אינטימה" — matches workers.storeBranch
  address: string;
  date: string; // YYYY-MM-DD
  expectedTime: string; // HH:MM
  status: DeliveryStatus;
  importId: string;
  photoPath?: string; // Storage path of the unloading confirmation photo
}

export interface ImportDoc {
  company: string;
  fileName: string;
  date: string;
  storagePath: string;
  deliveryCount: number;
  status: "processing" | "done" | "error";
  error?: string;
}

export interface WorkerImportDoc {
  company: string;
  fileName: string;
  storagePath: string;
  workerCount: number;
  status: "processing" | "done" | "error";
  error?: string;
}

/**
 * Normalises an Israeli phone number to E.164 digits (no + prefix).
 * Accepts "050-1234567" or "0501234567", returns "972501234567".
 * @param {string} raw raw phone number string
 * @return {string} E.164 digits without the leading +
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return "972" + digits;
}
