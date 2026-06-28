import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase-admin";

// Runs the real production morning-push logic on demand, scoped server-side
// to the caller's own company (functions/src/handlers/morningPush.ts).
export async function triggerMorningPush() {
  const fn = httpsCallable(functions, "triggerMorningPush");
  const result = await fn();
  return result.data;
}
