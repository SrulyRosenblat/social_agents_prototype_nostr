// NIP-17 private direct messages, layered on NIP-59 gift wrap + NIP-44 encryption.
//
// Shape of one DM:
//
//   kind 1059 (gift wrap)      <- signed by a fresh ephemeral key; relays see only this
//     content = nip44(stringify(seal), ephemeralSk ↔ recipientPk)
//     tags    = [["p", recipientPk]]
//     created_at = randomized ±2d (per NIP-59)
//
//     -> kind 13 (seal)        <- signed by the REAL sender's key
//          content = nip44(stringify(rumor), senderSk ↔ recipientPk)
//          tags    = []
//
//          -> kind 14 (rumor)  <- unsigned; carries the actual message
//               content = plaintext message
//               tags    = [["p", recipientPk],
//                          ["x", DM_TOPIC],
//                          ["subject", threadId],     (correlates request/reply)
//                          ["expiration", <unix ts>]] (NIP-40)
//
// We rely on nostr-tools' nip59 helpers for the cryptographic plumbing and
// only define our own rumor shape on top (tags + thread correlation). The
// `wrapEvent` helper accepts an arbitrary kind-14 template, so we can include
// our `x` topic tag, `subject` thread id, and `expiration` directly in it.

import type { Event, UnsignedEvent } from 'nostr-tools/pure';
import { wrapEvent as nip59Wrap, unwrapEvent as nip59Unwrap } from 'nostr-tools/nip59';
import { DM_TOPIC } from './kinds';

export interface DmRumor {
  /** The original sender's pubkey (recovered from the seal's signature). */
  senderPk: string;
  recipientPk: string;
  content: string;
  /**
   * Thread correlation id. The sender chooses it; the receiver echoes it back
   * on its reply so the sender's listener can route the reply to the open
   * tool call without having to track encrypted event ids.
   */
  threadId: string;
  /** Unix seconds; rumors past this should be dropped (NIP-40). */
  expiresAt: number;
  createdAt: number;
  /** Optional: kind 14 rumor object as returned by nip59. */
  raw?: UnsignedEvent & { pubkey: string };
}

/**
 * Wrap a plaintext DM for a single recipient. Returns a kind-1059 gift wrap
 * event ready to publish to relays.
 */
export function wrapDm(
  senderSk: Uint8Array,
  recipientPk: string,
  content: string,
  threadId: string,
  expiresAt: number,
): Event {
  const rumor: Partial<UnsignedEvent> = {
    kind: 14,
    content,
    tags: [
      ['p', recipientPk],
      ['x', DM_TOPIC],
      ['subject', threadId],
      ['expiration', String(expiresAt)],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
  // nip59.wrapEvent: (template, senderSk, recipientPk) -> kind 1059 event
  return nip59Wrap(rumor as UnsignedEvent, senderSk, recipientPk);
}

/**
 * Unwrap a kind-1059 gift wrap we received. Returns the parsed rumor + the
 * true sender pubkey (from the inner seal's signature). Returns null if the
 * event isn't ours (wrong topic, malformed, can't decrypt).
 */
export function unwrapDm(gift: Event, recipientSk: Uint8Array): DmRumor | null {
  let rumor: (UnsignedEvent & { pubkey: string }) | null = null;
  try {
    rumor = nip59Unwrap(gift, recipientSk) as UnsignedEvent & { pubkey: string };
  } catch {
    return null;
  }
  if (!rumor || rumor.kind !== 14) return null;

  // Only consider rumors that carry our agent-me-dm topic tag.
  const xTag = rumor.tags.find((t) => t[0] === 'x');
  if (!xTag || xTag[1] !== DM_TOPIC) return null;

  const pTag = rumor.tags.find((t) => t[0] === 'p');
  if (!pTag || !pTag[1]) return null;

  const subjectTag = rumor.tags.find((t) => t[0] === 'subject');
  if (!subjectTag || !subjectTag[1]) return null;

  const expTag = rumor.tags.find((t) => t[0] === 'expiration');
  const expiresAt = expTag ? Number(expTag[1]) : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;

  return {
    senderPk: rumor.pubkey,
    recipientPk: pTag[1],
    content: rumor.content,
    threadId: subjectTag[1],
    expiresAt,
    createdAt: rumor.created_at,
    raw: rumor,
  };
}
