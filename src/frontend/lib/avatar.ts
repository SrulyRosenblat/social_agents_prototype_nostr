/** Deterministic 2-char initials from a display name. */
export function initialsOf(name: string | undefined | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic hue derived from any string — used for avatar tint. */
export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
