// Server-side Nostr bridge used by the MCP `broadcast` tool.
// Holds the user's secret key, publishes queries, listens for replies,
// resolves vendor profiles. Keys live in `.user-key.hex` (gitignored).

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  type Event,
} from 'nostr-tools/pure';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import { PROFILE_KIND, QUERY_KIND, RESULT_KIND } from '../src/shared/kinds';
import { categoryTag, DEFAULT_RELAYS } from '../src/shared/topics';
import { buildQueryTemplate, type Audience } from '../src/shared/nip90';

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
    onReply?: (reply: BroadcastReply) => void;
  } = {},
): Promise<BroadcastResult> {
  const requested = options.listenWindowMs ?? DEFAULT_LISTEN_MS;
  const listenWindowMs = Math.max(2_000, Math.min(MAX_LISTEN_MS, requested));
  const template = buildQueryTemplate(question, category, options.audience ?? 'any');
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
