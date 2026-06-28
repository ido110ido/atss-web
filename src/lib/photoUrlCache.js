// Confirmation photos never change once a delivery is done, so the resolved
// download URL (and the token in it) is stable — caching it means a repeat
// visit to the Completed page doesn't need a fresh getDownloadURL() round
// trip to Storage for every photo, every time.
const STORAGE_KEY = "completedPhotoUrlCache";

export function loadPhotoUrlCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePhotoUrlCache(cache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable — caching is just an optimization.
  }
}
