// Server-side Nostr bridge used by the MCP `broadcast` tool.
// Holds the user's secret key, publishes queries, listens for replies,
// resolves vendor profiles. Keys live in `.user-key.hex` (gitignored).

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  type Event,
} from 'nostr-tools/pure';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import {
  DM_GIFT_WRAP_KIND,
  PROFILE_KIND,
  QUERY_KIND,
  RESULT_KIND,
} from '../src/shared/kinds';
import { categoryTag, DEFAULT_RELAYS } from '../src/shared/topics';
import { buildQueryTemplate, type Audience } from '../src/shared/nip90';
import { unwrapDm, wrapDm } from '../src/shared/nip17';

useWebSocketImplementation(WebSocket as unknown as typeof globalThis.WebSocket);

const KEY_FILE = path.join(process.cwd(), '.user-key.hex');

function loadOrCreateUserSk(): Uint8Array {
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    return Uint8Array.from(Buffer.from(hex, 'hex'));
  }
  const sk = generateSecretKey();
  fs.writeFileSync(KEY_FILE, Buffer.from(sk).toString('hex'));
  return sk;
}

const userSk = loadOrCreateUserSk();
const userPk = getPublicKey(userSk);

const pool = new SimplePool();
const relays = DEFAULT_RELAYS;

export type AgentType = 'friend' | 'shoe-seller' | 'unknown';

interface ProfileInfo {
  name?: string;
  about?: string;
  agentType: AgentType;
}

const profileCache = new Map<string, ProfileInfo>();

async function resolveProfile(pubkey: string): Promise<ProfileInfo> {
  if (profileCache.has(pubkey)) return profileCache.get(pubkey)!;
  const event = await pool.get(relays, { kinds: [PROFILE_KIND], authors: [pubkey] });
  let profile: ProfileInfo = { agentType: 'unknown' };
  if (event) {
    try {
      const parsed = JSON.parse(event.content) as {
        name?: string;
        about?: string;
        agent_type?: string;
      };
      const rawType = parsed.agent_type ?? '';
      const agentType: AgentType =
        rawType === 'friend' || rawType === 'shoe-seller' ? rawType : 'unknown';
      profile = { name: parsed.name, about: parsed.about, agentType };
    } catch {
      /* keep empty */
    }
  }
  profileCache.set(pubkey, profile);
  return profile;
}

export interface BroadcastReply {
  id: string;
  pubkey: string;
  displayName: string;
  about?: string;
  agentType: AgentType;
  content: string;
  receivedAt: number;
}

export interface BroadcastResult {
  queryId: string;
  question: string;
  category: string;
  audience: Audience;
  broadcastedAt: number;
  listenWindowMs: number;
  cancelled: boolean;
  replies: BroadcastReply[];
}

export function getUserPubkey(): string {
  return userPk;
}

export function getRelays(): readonly string[] {
  return relays;
}

const DEFAULT_LISTEN_MS = 30_000;
const MAX_LISTEN_MS = 90_000;

export async function broadcast(
  question: string,
  category: string,
  options: {
    listenWindowMs?: number;
    signal?: AbortSignal;
    audience?: Audience;
    expirationSec?: number;
    onReply?: (reply: BroadcastReply) => void;
  } = {},
): Promise<BroadcastResult> {
  const requested = options.listenWindowMs ?? DEFAULT_LISTEN_MS;
  const listenWindowMs = Math.max(2_000, Math.min(MAX_LISTEN_MS, requested));
  const template = buildQueryTemplate(
    question,
    category,
    options.audience ?? 'any',
    options.expirationSec,
  );
  const event = finalizeEvent(template, userSk);
  await Promise.allSettled(pool.publish(relays, event));

  const replies: BroadcastReply[] = [];
  const seen = new Set<string>();

  return new Promise<BroadcastResult>((resolve) => {
    let resolved = false;
    const finish = (cancelled: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        sub.close();
      } catch {
        /* ignore */
      }
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
      resolve({
        queryId: event.id,
        question,
        category,
        audience: options.audience ?? 'any',
        broadcastedAt: event.created_at,
        listenWindowMs,
        cancelled,
        replies,
      });
    };

    const onAbort = () => finish(true);
    if (options.signal) {
      if (options.signal.aborted) {
        // Still subscribe briefly? No — just publish and bail. Replies wouldn't have time.
        // But we've already published; just return zero replies.
        setTimeout(() => finish(true), 0);
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    const sub = pool.subscribeMany(
      relays,
      {
        kinds: [RESULT_KIND],
        '#e': [event.id],
        '#p': [userPk],
      },
      {
        onevent: async (ev: Event) => {
          if (resolved) return;
          if (seen.has(ev.id)) return;
          seen.add(ev.id);
          const profile = await resolveProfile(ev.pubkey);
          const enriched: BroadcastReply = {
            id: ev.id,
            pubkey: ev.pubkey,
            displayName: profile.name ?? `(${ev.pubkey.slice(0, 8)})`,
            about: profile.about,
            agentType: profile.agentType,
            content: ev.content,
            receivedAt: Math.floor(Date.now() / 1000),
          };
          replies.push(enriched);
          if (options.onReply) {
            try {
              options.onReply(enriched);
            } catch (err) {
              console.error('onReply callback failed:', err);
            }
          }
        },
      },
    );

    const timer = setTimeout(() => finish(false), listenWindowMs);
  });
}

// ─── Private DMs (NIP-17 over NIP-44 + NIP-59) ──────────────────────────────

export interface DmReply {
  /** Gift-wrap event id of the incoming reply (for de-dup). */
  id: string;
  /** True sender's pubkey, recovered from the inner seal — NOT the 1059 signer. */
  pubkey: string;
  displayName: string;
  about?: string;
  agentType: AgentType;
  content: string;
  receivedAt: number;
}

export interface DmRecipientSent {
  pubkey: string;
  wrapEventId: string;
}

export interface DmResult {
  threadId: string;
  recipients: DmRecipientSent[];
  sentAt: number;
  listenWindowMs: number;
  cancelled: boolean;
  replies: DmReply[];
}

const DEFAULT_DM_EXPIRATION_SEC = 600;
const MIN_DM_EXPIRATION_SEC = 60;
const MAX_DM_EXPIRATION_SEC = 3600;

/**
 * Send a NIP-17 gift-wrapped DM to each of `recipients` (one wrap per recipient),
 * then listen for encrypted replies on kind 1059 events that decrypt to a rumor
 * carrying our `subject` thread id. Replies stream out via `onReply` and are
 * returned in aggregate at the end of the listen window (or on cancel).
 */
export async function sendDms(
  recipients: string[],
  content: string,
  options: {
    listenWindowMs?: number;
    signal?: AbortSignal;
    expirationSec?: number;
    onReply?: (reply: DmReply) => void;
  } = {},
): Promise<DmResult> {
  if (recipients.length === 0) {
    throw new Error('sendDms: at least one recipient required');
  }
  const requested = options.listenWindowMs ?? DEFAULT_LISTEN_MS;
  const listenWindowMs = Math.max(2_000, Math.min(MAX_LISTEN_MS, requested));
  const expirationSec = Math.max(
    MIN_DM_EXPIRATION_SEC,
    Math.min(MAX_DM_EXPIRATION_SEC, options.expirationSec ?? DEFAULT_DM_EXPIRATION_SEC),
  );
  const expiresAt = Math.floor(Date.now() / 1000) + expirationSec;
  const threadId = randomUUID();

  // Fan out: one gift-wrap per recipient. NIP-44 is resistant to related-
  // plaintext attacks, so encrypting identical content to many recipients is
  // cryptographically safe.
  const sent: DmRecipientSent[] = [];
  for (const recipientPk of recipients) {
    const wrap = wrapDm(userSk, recipientPk, content, threadId, expiresAt);
    await Promise.allSettled(pool.publish(relays, wrap));
    sent.push({ pubkey: recipientPk, wrapEventId: wrap.id });
  }
  const sentAt = Math.floor(Date.now() / 1000);

  const replies: DmReply[] = [];
  const seenGifts = new Set<string>();
  // Track which recipients have replied at least once. Once everyone we
  // DM'd has answered, there's no reason to keep listening — return early.
  // (Repeated replies from the same pubkey don't double-count.)
  const repliersHeardFrom = new Set<string>();
  const recipientSet = new Set(recipients);

  return new Promise<DmResult>((resolve) => {
    let resolved = false;
    const finish = (cancelled: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        sub.close();
      } catch {
        /* ignore */
      }
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
      resolve({
        threadId,
        recipients: sent,
        sentAt,
        listenWindowMs,
        cancelled,
        replies,
      });
    };

    const onAbort = () => finish(true);
    if (options.signal) {
      if (options.signal.aborted) {
        setTimeout(() => finish(true), 0);
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    // Listen for any gift wraps addressed to us, then filter down to those
    // whose decrypted rumor carries our threadId. No `since` filter — relays
    // randomize created_at by ±2 days for gift wraps, so a strict `since`
    // would drop legitimate replies.
    const sub = pool.subscribeMany(
      relays,
      {
        kinds: [DM_GIFT_WRAP_KIND],
        '#p': [userPk],
      },
      {
        onevent: async (ev: Event) => {
          if (resolved) return;
          if (seenGifts.has(ev.id)) return;
          seenGifts.add(ev.id);
          const rumor = unwrapDm(ev, userSk);
          if (!rumor) return;
          if (rumor.threadId !== threadId) return;
          if (rumor.expiresAt > 0 && Date.now() / 1000 > rumor.expiresAt) return;

          const profile = await resolveProfile(rumor.senderPk);
          const enriched: DmReply = {
            id: ev.id,
            pubkey: rumor.senderPk,
            displayName: profile.name ?? `(${rumor.senderPk.slice(0, 8)})`,
            about: profile.about,
            agentType: profile.agentType,
            content: rumor.content,
            receivedAt: Math.floor(Date.now() / 1000),
          };
          replies.push(enriched);
          if (options.onReply) {
            try {
              options.onReply(enriched);
            } catch (err) {
              console.error('onReply (dm) callback failed:', err);
            }
          }
          if (recipientSet.has(rumor.senderPk)) {
            repliersHeardFrom.add(rumor.senderPk);
            if (repliersHeardFrom.size >= recipientSet.size) {
              // All recipients have replied — no point waiting out the rest
              // of the listen window.
              finish(false);
            }
          }
        },
      },
    );

    const timer = setTimeout(() => finish(false), listenWindowMs);
  });
}
