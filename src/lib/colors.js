const PALETTE = ["#0073ea", "#a25ddc", "#00c875", "#fdab3d", "#ff158a", "#323338", "#579bfc", "#e2445c"];

export function colorForIndex(i) {
  return PALETTE[i % PALETTE.length];
}

export function colorForKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
