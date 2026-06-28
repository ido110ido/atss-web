import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase-admin";

// Parsing happens server-side (functions/src/handlers/onRouteFileUploaded.ts) —
// the client only uploads the raw file. The Cloud Function picks it up from
// this exact path, creates an `imports` audit doc, and fans the rows out into
// `deliveries`.
export async function uploadDeliveriesFile(file, company) {
  const safeFileName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `imports/${company}/${Date.now()}-${safeFileName}`;
  await uploadBytes(ref(storage, storagePath), file);
  return storagePath;
}
