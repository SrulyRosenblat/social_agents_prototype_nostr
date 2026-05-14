import type { Event, EventTemplate } from 'nostr-tools/pure';
import { QUERY_KIND, RESULT_KIND } from './kinds';
import { TOPIC_ROOT, TOPIC_REPLY, categoryTag } from './topics';
import type { AgentQuery, AgentReply } from './types';

const QUERY_TTL_SECONDS = 120;

export type Audience = 'any' | 'friend' | 'shoe-seller';

export function buildQueryTemplate(
  question: string,
  category: string,
  audience: Audience = 'any',
): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['i', question, 'text'],
    ['output', 'text/plain'],
    ['t', TOPIC_ROOT],
    ['t', categoryTag(category)],
    ['expiration', String(now + QUERY_TTL_SECONDS)],
  ];
  if (audience !== 'any') tags.push(['audience', audience]);
  else tags.push(['audience', 'any']);
  return {
    kind: QUERY_KIND,
    content: '',
    created_at: now,
    tags,
  };
}

export function buildResultTemplate(
  query: Event,
  replyText: string,
): EventTemplate {
  return {
    kind: RESULT_KIND,
    content: replyText,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', query.id],
      ['p', query.pubkey],
      ['request', JSON.stringify(query)],
      ['t', TOPIC_REPLY],
    ],
  };
}

export function parseQuery(event: Event): AgentQuery | null {
  if (event.kind !== QUERY_KIND) return null;
  const iTag = event.tags.find((t) => t[0] === 'i');
  if (!iTag || !iTag[1]) return null;
  const catTag = event.tags.find((t) => t[0] === 't' && t[1].startsWith(`${TOPIC_ROOT}-cat-`));
  const category = catTag ? catTag[1].replace(`${TOPIC_ROOT}-cat-`, '') : 'unknown';
  return {
    id: event.id,
    pubkey: event.pubkey,
    question: iTag[1],
    category,
    createdAt: event.created_at,
    raw: event,
  };
}

export function parseResult(event: Event): AgentReply | null {
  if (event.kind !== RESULT_KIND) return null;
  const eTag = event.tags.find((t) => t[0] === 'e');
  if (!eTag) return null;
  return {
    id: event.id,
    vendorPubkey: event.pubkey,
    queryId: eTag[1],
    text: event.content,
    createdAt: event.created_at,
    raw: event,
  };
}

export function queryHasCategory(event: Event, category: string): boolean {
  const target = categoryTag(category);
  return event.tags.some((t) => t[0] === 't' && t[1] === target);
}
