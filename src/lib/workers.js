import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase-admin";

// Mirrors functions/src/config/constants.ts normalizePhone — keep in sync.
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return "972" + digits;
}

// The worker doc ID is an opaque random ID, not derived from phone — phone
// is just a regular field, matched by querying rather than by predicting
// the ID. That means it can change later (see updateWorker) without ever
// orphaning anything. Mirrors functions/src/handlers/onRouteFileUploaded.ts'
// onWorkerFileUploaded, which does the same phone-query upsert for the
// batch Excel import.
export async function addWorker({ company, name, phone, address, language }) {
  const normalizedPhone = normalizePhone(phone);
  const data = {
    company,
    name: name.trim(),
    phone: normalizedPhone,
    address: address.trim(),
    language: language?.trim() || null,
    active: true,
  };

  const existing = await getDocs(
    query(collection(db, "workers"), where("company", "==", company), where("phone", "==", normalizedPhone)),
  );

  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    await setDoc(ref, data, { merge: true });
    return ref.id;
  }

  const newRef = doc(collection(db, "workers"));
  await setDoc(newRef, data);
  return newRef.id;
}

// Editing phone here just updates the field on this same stable doc ID — a
// Cloud Function trigger (onWorkerPhoneChanged) automatically propagates the
// new number to this worker's not-yet-done deliveries. One thing to know:
// the recurring Excel roster still matches workers by phone, so if this
// worker is re-imported later under their OLD number (e.g. the Excel wasn't
// updated too), that creates a new, separate worker record rather than
// updating this one — keep the Excel in sync when changing a number.
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
