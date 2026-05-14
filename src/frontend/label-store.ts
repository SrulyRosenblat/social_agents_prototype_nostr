// User-side labels for agent pubkeys.
// Labels are the user's authoritative trust assignments — agents' self-claimed
// `agent_type` is only a hint. Storage is localStorage; this is your machine.

const STORAGE_KEY = 'agent-me/labels';

/**
 * The user's authoritative trust assignment for a pubkey:
 * - `trusted`: replies from this pubkey auto-include without modal.
 * - `malicious`: replies are auto-skipped without modal (never shown).
 * - unlabeled (no entry): the standard inbound gate runs.
 *
 * Granularity beyond this comes from the agent's self-claimed `agent_type`,
 * which is displayed in the gate but not load-bearing for trust decisions.
 */
export type Label = 'trusted' | 'malicious';

export interface LabeledPubkey {
  pubkey: string;
  displayName: string;
  label: Label;
  addedAt: number;
}

function load(): LabeledPubkey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      pubkey: string;
      displayName: string;
      label: string;
      addedAt: number;
    }>;
    // Legacy migration: pre-trust-consolidation entries used 'friend' /
    // 'shoe-seller'. Treat both as 'trusted' going forward (user can drop
    // the trust via the Labels popover if they no longer want auto-include).
    let migrated = false;
    const out: LabeledPubkey[] = parsed.map((e) => {
      if (e.label === 'trusted' || e.label === 'malicious') return e as LabeledPubkey;
      migrated = true;
      return { ...e, label: 'trusted' as const };
    });
    if (migrated) save(out);
    return out;
  } catch {
    return [];
  }
}

function save(entries: LabeledPubkey[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function listLabeled(): LabeledPubkey[] {
  return load();
}

export function getLabel(pubkey: string): Label | undefined {
  return load().find((e) => e.pubkey === pubkey)?.label;
}

export function setLabel(pubkey: string, displayName: string, label: Label): void {
  const entries = load();
  const existing = entries.find((e) => e.pubkey === pubkey);
  if (existing) {
    existing.label = label;
    existing.displayName = displayName;
  } else {
    entries.push({ pubkey, displayName, label, addedAt: Date.now() });
  }
  save(entries);
}

export function removeLabel(pubkey: string): void {
  save(load().filter((e) => e.pubkey !== pubkey));
}

/**
 * Apply suggested labels for pubkeys that are not yet labeled.
 * Used at app startup to bootstrap friend recognition from the server's
 * hint without overwriting any user-made labels.
 */
export function applySuggestedLabels(
  suggestions: Array<{ pubkey: string; displayName: string; label: Label }>,
): void {
  const entries = load();
  const seen = new Set(entries.map((e) => e.pubkey));
  let changed = false;
  for (const s of suggestions) {
    if (seen.has(s.pubkey)) continue;
    entries.push({ pubkey: s.pubkey, displayName: s.displayName, label: s.label, addedAt: Date.now() });
    changed = true;
  }
  if (changed) save(entries);
}
