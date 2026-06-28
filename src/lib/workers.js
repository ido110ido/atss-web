import { doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase-admin";

// Mirrors functions/src/config/constants.ts normalizePhone — keep in sync.
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return "972" + digits;
}

// Mirrors functions/src/config/constants.ts workerDocId — keep in sync.
export function workerDocId(company, phone) {
  return `${company}_${phone}`;
}

export async function addWorker({ company, name, phone, address, language }) {
  const normalizedPhone = normalizePhone(phone);
  const id = workerDocId(company, normalizedPhone);
  await setDoc(
    doc(db, "workers", id),
    {
      company,
      name: name.trim(),
      phone: normalizedPhone,
      address: address.trim(),
      language: language?.trim() || null,
      active: true,
    },
    { merge: true },
  );
  return id;
}

// Note: the worker doc ID is `${company}_${phone}` as of creation time, but
// Firestore doc IDs can't be renamed — editing phone here only updates the
// field, the ID keeps its original value. That's fine for everything in this
// app (lookups are by ID or by the live `phone` field, never by parsing the
// ID). The one thing to watch: if this worker is still listed under their
// old phone number in the recurring Excel roster, the next batch import will
// upsert by that old number and silently revert this edit — update the
// Excel too when changing a worker's number.
export async function updateWorker(id, { name, phone, address, language, active }) {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (phone !== undefined) data.phone = normalizePhone(phone);
  if (address !== undefined) data.address = address.trim();
  if (language !== undefined) data.language = language?.trim() || null;
  if (active !== undefined) data.active = active;
  await updateDoc(doc(db, "workers", id), data);
}

// Parsing happens server-side (functions/src/handlers/onRouteFileUploaded.ts) —
// the client only uploads the raw file. The Cloud Function picks it up from
// this exact path, creates a `workerImports` audit doc, and upserts `workers`.
export async function uploadWorkersFile(file, company) {
  const safeFileName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `workers/${company}/${Date.now()}-${safeFileName}`;
  await uploadBytes(ref(storage, storagePath), file);
  return storagePath;
}
