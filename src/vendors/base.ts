import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import type { Event } from 'nostr-tools/pure';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import {
  DM_GIFT_WRAP_KIND,
  PROFILE_KIND,
  QUERY_KIND,
} from '../shared/kinds';
import { TOPIC_ROOT, categoryTag, DEFAULT_RELAYS } from '../shared/topics';
import { buildResultTemplate, parseQuery } from '../shared/nip90';
import { unwrapDm, wrapDm } from '../shared/nip17';
import type { AgentQuery } from '../shared/types';
import { loadUserPubkey } from './user-pubkey';

useWebSocketImplementation(WebSocket as unknown as typeof globalThis.WebSocket);

const KEY_DIR = path.join(process.cwd(), '.vendor-keys');

function loadOrCreateSecret(name: string): Uint8Array {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });
  const keyFile = path.join(KEY_DIR, `${name}.hex`);
  if (fs.existsSync(keyFile)) {
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    return Uint8Array.from(Buffer.from(hex, 'hex'));
  }
  const sk = generateSecretKey();
  fs.writeFileSync(keyFile, Buffer.from(sk).toString('hex'));
  return sk;
}

export type RespondDecision =
  | { kind: 'reply'; text: string }
  | { kind: 'silent'; reason?: string }; // reason is local log only — never published

// Self-claimed role tag — used only as a HINT for audience filtering and
// for the user's first-time label suggestion. Trust is decided client-side.
export type AgentType = 'friend' | 'shoe-seller';

/**
 * A self-contained private follow-up addressed only to this agent (after
 * decryption). `senderPk` is the application user's pubkey; we verify this
 * before invoking the agent's `decideDm` to avoid responding to random DMs
 * from third parties.
 */
export interface AgentDmRequest {
  senderPk: string;
  content: string;
  threadId: string;
  expiresAt: number;
}

export interface VendorConfig {
  name: string;
  displayName: string;
  about: string;
  /** Self-claimed type. Treated as a hint only; user-side labels are authoritative. */
  agentType: AgentType;
  /**
   * Optional: only respond when the query carries this category tag.
   * Friends/contacts omit this and respond to any category.
   * All agents are ALWAYS scoped to the application user's pubkey
   * (loaded from .user-key.hex) — they never reply to broadcasts from
   * other people on the relays.
   */
  category?: string;
  /**
   * Decide how this agent responds (or doesn't) to a given query.
   * Default: always reply with `defaultReply`.
   */
  decide?: (query: AgentQuery) => RespondDecision | Promise<RespondDecision>;
  /**
   * Optional: how this agent responds to a private follow-up DM.
   * If omitted, the agent reuses `decide` (with a synthesized AgentQuery
   * whose category is 'dm'). DMs are always 1:1 and self-contained.
   */
  decideDm?: (dm: AgentDmRequest) => RespondDecision | Promise<RespondDecision>;
  /** Fallback reply text used when `decide` is not provided. */
  defaultReply?: string;
}

export async function runVendor(cfg: VendorConfig): Promise<void> {
  const sk = loadOrCreateSecret(cfg.name);
  const pk = getPublicKey(sk);
  const pool = new SimplePool();
  const relays = DEFAULT_RELAYS;

  const userPubkey = loadUserPubkey();

  console.log(`[${cfg.displayName}] pubkey: ${pk}`);
  console.log(
    `[${cfg.displayName}] scoped to user ${userPubkey.slice(0, 12)}…${cfg.category ? `, category=${cfg.category}` : ' (all categories)'}`,
  );

  const profileEvent = finalizeEvent(
    {
      kind: PROFILE_KIND,
      content: JSON.stringify({
        name: cfg.displayName,
        about: cfg.about,
        agent_type: cfg.agentType,
      }),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    },
    sk,
  );
  await Promise.allSettled(pool.publish(relays, profileEvent));
  console.log(`[${cfg.displayName}] published profile (kind 0)`);

  const seen = new Set<string>();
  const startedAt = Math.floor(Date.now() / 1000);

  // Two REQ subscriptions over the same WebSocket connection (SimplePool
  // reuses one socket per relay). nostr-tools' subscribeMany takes one Filter
  // each, and the public broadcast filter (kinds:[5050], authors:[user]) and
  // the DM filter (kinds:[1059], #p:[me]) can't be merged into a single Filter
  // because Filter fields are AND'd. So: two REQs, one shared connection.
  //
  // Gift wraps randomize created_at by ±2 days per NIP-59, so no `since` on
  // the DM filter — we de-dup by event id and drop stale rumors via their own
  // NIP-40 expiration tag.
  const broadcastFilter = cfg.category
    ? {
        kinds: [QUERY_KIND],
        authors: [userPubkey],
        '#t': [categoryTag(cfg.category)],
        since: startedAt,
      }
    : {
        kinds: [QUERY_KIND],
        authors: [userPubkey],
        '#t': [TOPIC_ROOT],
        since: startedAt,
      };

  pool.subscribeMany(
    relays,
    broadcastFilter,
    {
      onevent: async (event: Event) => {
        if (seen.has(event.id)) return;
        seen.add(event.id);
        const query = parseQuery(event);
        if (!query) return;

        const expirationTag = event.tags.find((t) => t[0] === 'expiration');
        if (expirationTag) {
          const expiresAt = Number(expirationTag[1]);
          if (Number.isFinite(expiresAt) && Date.now() / 1000 > expiresAt) return;
        }

        // Audience-tag filtering. If the broadcast specifies an audience and
        // this agent isn't in that audience, stay silent. No audience tag = open.
        const audienceTag = event.tags.find((t) => t[0] === 'audience');
        if (audienceTag) {
          const audience = audienceTag[1];
          if (audience !== 'any' && audience !== cfg.agentType) {
            console.log(
              `[${cfg.displayName}] not in audience '${audience}' — skipping ${event.id.slice(0, 8)}`,
            );
            return;
          }
        }

        const decision = cfg.decide
          ? await cfg.decide(query)
          : ({ kind: 'reply', text: cfg.defaultReply ?? '' } as RespondDecision);

        if (decision.kind === 'silent') {
          // Silent decline: no event published. The "reason" stays in this process's logs
          // so a vendor operator can audit their own choices, but it never hits the wire.
          // Anyone listening sees only the absence of a reply, not the fact of a decision.
          console.log(
            `[${cfg.displayName}] silent on ${event.id.slice(0, 8)}${decision.reason ? ` (local: ${decision.reason})` : ''}`,
          );
          return;
        }

        console.log(
          `[${cfg.displayName}] received query ${event.id.slice(0, 8)}: "${query.question}"`,
        );
        const replyEvent = finalizeEvent(
          buildResultTemplate(event, decision.text),
          sk,
        );
        await Promise.allSettled(pool.publish(relays, replyEvent));
        console.log(`[${cfg.displayName}] published reply ${replyEvent.id.slice(0, 8)}`);
      },
    },
  );

  pool.subscribeMany(
    relays,
    {
      kinds: [DM_GIFT_WRAP_KIND],
      '#p': [pk],
    },
    {
      onevent: async (event: Event) => {
        if (seen.has(event.id)) return;
        seen.add(event.id);
        await handleDm(event);
      },
    },
  );

  async function handleDm(event: Event): Promise<void> {
    const rumor = unwrapDm(event, sk);
    if (!rumor) return;
    // Only respond to DMs from the application user. We deliberately do not
    // engage with random third parties even though gift wraps from anyone
    // are deliverable to us.
    if (rumor.senderPk !== userPubkey) {
      console.log(
        `[${cfg.displayName}] dm from non-user ${rumor.senderPk.slice(0, 8)} — ignoring`,
      );
      return;
    }
    if (rumor.expiresAt > 0 && Date.now() / 1000 > rumor.expiresAt) {
      console.log(`[${cfg.displayName}] dm expired — dropping`);
      return;
    }

    const dmReq: AgentDmRequest = {
      senderPk: rumor.senderPk,
      content: rumor.content,
      threadId: rumor.threadId,
      expiresAt: rumor.expiresAt,
    };
    const synthQuery: AgentQuery = {
      id: event.id,
      pubkey: rumor.senderPk,
      question: rumor.content,
      category: 'dm',
      createdAt: rumor.createdAt,
      raw: event,
    };
    const decide = cfg.decideDm
      ? () => cfg.decideDm!(dmReq)
      : cfg.decide
        ? () => cfg.decide!(synthQuery)
        : null;
    if (!decide) {
      if (cfg.defaultReply) {
        await publishDmReply(rumor.senderPk, rumor.threadId, cfg.defaultReply, rumor.expiresAt);
      }
      return;
    }

    const decision = await decide();
    if (decision.kind === 'silent') {
      console.log(
        `[${cfg.displayName}] silent on dm thread ${rumor.threadId.slice(0, 8)}${decision.reason ? ` (local: ${decision.reason})` : ''}`,
      );
      return;
    }

    console.log(
      `[${cfg.displayName}] received dm thread ${rumor.threadId.slice(0, 8)}: "${rumor.content.slice(0, 60)}…"`,
    );
    await publishDmReply(rumor.senderPk, rumor.threadId, decision.text, rumor.expiresAt);
  }

  async function publishDmReply(
    recipientPk: string,
    threadId: string,
    text: string,
    inboundExpiresAt: number,
  ): Promise<void> {
    // Reuse the inbound's TTL as a sensible reply TTL; clamp to ≥60s in case
    // the inbound has already nearly expired.
    const minTtl = Math.floor(Date.now() / 1000) + 60;
    const expiresAt = Math.max(minTtl, inboundExpiresAt);
    const wrap = wrapDm(sk, recipientPk, text, threadId, expiresAt);
    await Promise.allSettled(pool.publish(relays, wrap));
    console.log(
      `[${cfg.displayName}] published dm reply on thread ${threadId.slice(0, 8)} (${wrap.id.slice(0, 8)})`,
    );
  }

  console.log(`[${cfg.displayName}] subscribed.`);

  // Keep the Node event loop alive even when the relay connections idle.
  // Without this, the process can exit cleanly after the first reply on some Node versions.
  setInterval(() => {}, 1 << 30);
}
