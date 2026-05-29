// Unified Hono server hosting:
//   - POST /chat       — LLM proxy with OpenAI native tool calling
//   - * /mcp           — MCP server (Streamable HTTP) exposing the `broadcast` tool
//   - GET  /me         — returns the user's pubkey + relay list (for UI display)
//   - GET  /health
//
// Anthropic SDK is not used here per the user's preference; LLM calls go via OpenRouter.

import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  broadcast as nostrBroadcast,
  sendDms as nostrSendDms,
  getUserPubkey,
  getRelays,
} from './nostr-bridge';
import {
  checkAvailability as calCheckAvailability,
  bookSlot as calBookSlot,
  seedTeammateCalendar,
  knownTeammateNames,
} from './calendar-store';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
const model = process.env.OPENROUTER_MODEL ?? 'google/gemma-4-26b-a4b-it';

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:5173',
    'X-Title': 'agent.me nostr prototype',
  },
});

const ALLOWED_CATEGORIES = ['shoes', 'travel', 'food', 'tech', 'general'] as const;

// ─── MCP server factory (one McpServer + transport per session) ────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agent-me-nostr',
    version: '0.1.0',
  });

  server.tool(
    'broadcast',
    "Publish a question PUBLICLY on Nostr to the open network of agents and return replies. Use this for outreach to a wide / untrusted pool (vendors, public Q&A). The audience tag is just a ROUTING SUGGESTION so the right kind of vendor self-selects — it is not enforced. To reach the user's friends, use `dm` instead.",
    {
      question: z
        .string()
        .max(200)
        .describe('Concise public broadcast question. No personal identifiers unless the user clearly chose to disclose them.'),
      category: z
        .enum(ALLOWED_CATEGORIES)
        .describe('Topic category — a hint used for routing.'),
      audience: z
        .enum([
          'any',
          'shoe-seller',
          'travel-agent',
          'food-vendor',
          'tech-vendor',
          'general-merchant',
        ])
        .default('any')
        .describe("Routing suggestion (not enforced). Pick the vendor type that best matches the question; pick 'any' when unsure or when you want broad input. Friends are reached via `dm`, never here."),
      listen_window_seconds: z
        .number()
        .int()
        .min(5)
        .max(90)
        .default(30)
        .describe('How long (seconds) to wait for replies before returning. The user may stop early.'),
      expiration_seconds: z
        .number()
        .int()
        .min(60)
        .max(3600)
        .default(120)
        .describe('When the broadcast event expires (NIP-40). Agents that see it after this drop it. Keep short for ephemeral asks.'),
    },
    async (
      { question, category, audience, listen_window_seconds, expiration_seconds },
      extra,
    ) => {
      const progressToken = extra._meta?.progressToken;
      let progressCount = 0;
      const total = listen_window_seconds; // best-guess upper bound

      const result = await nostrBroadcast(question, category, {
        listenWindowMs: listen_window_seconds * 1000,
        signal: extra.signal,
        audience,
        expirationSec: expiration_seconds,
        onReply: (reply) => {
          if (progressToken === undefined) return;
          progressCount += 1;
          // Stream each reply back to the client via a progress notification.
          // We stuff the reply payload into `message` as JSON so the client
          // can run the inbound approval gate immediately.
          void extra
            .sendNotification({
              method: 'notifications/progress',
              params: {
                progressToken,
                progress: progressCount,
                total,
                message: JSON.stringify({ kind: 'reply', reply }),
              },
            })
            .catch((err) => console.error('sendNotification failed:', err));
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    },
  );

  // ─── Teammate calendar tools ──────────────────────────────────────────────
  // These are NOT used by the user's me-agent (the frontend filters its tool
  // list to broadcast + dm). They're called by the teammate-agent processes,
  // each connecting an MCP client at startup. The teammate passes its own
  // pubkey on every call — there's no per-session identity binding, this is
  // an in-process prototype.

  server.tool(
    'check_availability',
    "Check a calendar owner's busy events overlapping [start_iso, end_iso). For teammate agents to consult their own schedule before agreeing to a meeting. Pass YOUR OWN pubkey as `pubkey` — the one printed in your process startup log.",
    {
      pubkey: z
        .string()
        .regex(/^[0-9a-f]{64}$/i, 'must be 64-char hex pubkey')
        .describe('The calendar owner\'s pubkey. Teammates pass their own.'),
      start_iso: z
        .string()
        .describe('ISO 8601 local-time start, e.g. "2026-05-28T15:00:00". No timezone suffix — interpreted as the local timezone.'),
      end_iso: z
        .string()
        .describe('ISO 8601 local-time end, exclusive.'),
    },
    async ({ pubkey, start_iso, end_iso }) => {
      ensureCalendarSeeded(pubkey);
      const result = calCheckAvailability(pubkey, start_iso, end_iso);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'book_slot',
    "Add an event to a calendar. Use AFTER `check_availability` confirms the slot is free. Returns ok+event on success, or error+conflicts if the slot is taken. Pass YOUR OWN pubkey.",
    {
      pubkey: z
        .string()
        .regex(/^[0-9a-f]{64}$/i, 'must be 64-char hex pubkey'),
      start_iso: z
        .string()
        .describe('ISO 8601 local-time start, e.g. "2026-05-28T15:00:00".'),
      duration_minutes: z
        .number()
        .int()
        .min(5)
        .max(480),
      title: z
        .string()
        .min(1)
        .max(120)
        .describe('Short title for the event, e.g. "sync with Casey on auth migration".'),
    },
    async ({ pubkey, start_iso, duration_minutes, title }) => {
      ensureCalendarSeeded(pubkey);
      const result = calBookSlot(pubkey, start_iso, duration_minutes, title);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'dm',
    "Send a private, end-to-end encrypted message to one or more agents and listen for their encrypted replies. Use this AFTER a `broadcast` when the user wants to follow up privately with a subset of responders, OR when the user already has the pubkeys of agents they want to contact directly. The message content is encrypted (NIP-44) and the sender identity is hidden from relays via gift-wrapping (NIP-59). IMPORTANT: recipients may be stateless and will NOT remember a prior broadcast — make `content` self-contained. Do not include personal identifiers unless the user explicitly approved them for this DM. Every send and every reply still passes through the user's approval gate.",
    {
      recipient_pubkeys: z
        .array(z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64-char hex pubkey'))
        .min(1)
        .max(10)
        .describe('1–10 recipient pubkeys (hex). Typically a subset of the pubkeys returned by a prior broadcast.'),
      content: z
        .string()
        .min(1)
        .max(800)
        .describe('Self-contained message body. Will be shown to the user for approval before sending.'),
      listen_window_seconds: z
        .number()
        .int()
        .min(5)
        .max(90)
        .default(45)
        .describe('How long (seconds) to wait for encrypted replies before returning. The user may stop early.'),
      expiration_seconds: z
        .number()
        .int()
        .min(60)
        .max(3600)
        .default(600)
        .describe('When the DM rumor expires (NIP-40). Recipients that decrypt past this drop it.'),
    },
    async (
      { recipient_pubkeys, content, listen_window_seconds, expiration_seconds },
      extra,
    ) => {
      const progressToken = extra._meta?.progressToken;
      let progressCount = 0;
      const total = listen_window_seconds;

      const result = await nostrSendDms(recipient_pubkeys, content, {
        listenWindowMs: listen_window_seconds * 1000,
        signal: extra.signal,
        expirationSec: expiration_seconds,
        onReply: (reply) => {
          if (progressToken === undefined) return;
          progressCount += 1;
          // Reuse the same `{kind: 'reply', reply}` envelope as the broadcast
          // tool so the frontend can share its reply-queue plumbing.
          void extra
            .sendNotification({
              method: 'notifications/progress',
              params: {
                progressToken,
                progress: progressCount,
                total,
                message: JSON.stringify({ kind: 'reply', reply }),
              },
            })
            .catch((err) => console.error('sendNotification (dm) failed:', err));
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    },
  );

  return server;
}

// Per-session transports keyed by session ID.
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

async function handleMcp(req: Request): Promise<Response> {
  const sessionIdHeader = req.headers.get('mcp-session-id') ?? undefined;
  const method = req.method;

  // GET / DELETE require an existing session.
  if (method !== 'POST') {
    if (!sessionIdHeader || !transports.has(sessionIdHeader)) {
      return new Response('Session not found', { status: 404 });
    }
    return transports.get(sessionIdHeader)!.handleRequest(req);
  }

  // POST: either an existing session, or a new initialize.
  if (sessionIdHeader && transports.has(sessionIdHeader)) {
    return transports.get(sessionIdHeader)!.handleRequest(req);
  }

  // No session header — must be an initialize request.
  // Peek at the body without consuming it.
  const cloned = req.clone();
  let body: unknown;
  try {
    body = await cloned.json();
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!isInitializeRequest(body)) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Bad Request: no session and not an initialize request',
        },
        id: null,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Create a fresh transport + server pair for this new session.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    // SSE-streamed responses (default). Required so progress notifications
    // delivered during a long-running tool call reach the client *during*
    // execution, not just bundled at the end.
    enableJsonResponse: false,
    onsessioninitialized: (sid) => {
      transports.set(sid, transport);
      console.log(`[mcp] session initialized: ${sid}`);
    },
    onsessionclosed: (sid) => {
      transports.delete(sid);
      console.log(`[mcp] session closed: ${sid}`);
    },
  });

  const server = buildMcpServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

// ─── Hono routing ───────────────────────────────────────────────────────────

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'mcp-session-id', 'mcp-protocol-version'],
    exposeHeaders: ['mcp-session-id'],
  }),
);

app.post('/mcp', (c) => handleMcp(c.req.raw));
app.get('/mcp', (c) => handleMcp(c.req.raw));
app.delete('/mcp', (c) => handleMcp(c.req.raw));

import fs from 'node:fs';
import nodePath from 'node:path';
import { getPublicKey } from 'nostr-tools/pure';

// Resolve a list of local agent names into { name, pubkey } pairs by reading
// .vendor-keys/<name>.hex. Used to suggest initial trusted-labels to the
// client UI on first load. Shoe-sellers (and other open-network vendors) are
// intentionally NOT exposed — they should appear unlabeled to the user, who
// decides whether to recognize them.
function resolveContactAgents(
  names: readonly string[],
): Array<{ name: string; pubkey: string; role?: string }> {
  const keyDir = nodePath.join(process.cwd(), '.vendor-keys');
  if (!fs.existsSync(keyDir)) return [];
  return names
    .map((name) => {
      const file = nodePath.join(keyDir, `${name}.hex`);
      if (!fs.existsSync(file)) return null;
      try {
        const hex = fs.readFileSync(file, 'utf8').trim();
        const pk = getPublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));
        return { name, pubkey: pk };
      } catch {
        return null;
      }
    })
    .filter((x): x is { name: string; pubkey: string } => x !== null);
}

const FRIEND_NAMES = ['alex', 'sam', 'pat', 'jordan'] as const;
const TEAMMATE_ROLES: Record<string, string> = {
  priya: 'product manager (billing + onboarding)',
  marcus: 'engineering manager',
  jen: 'peer engineer (SRE-leaning)',
  diego: 'product designer',
};

// Seed each known teammate's in-memory calendar at server startup so the
// calendar MCP tools return realistic conflicts before any teammate has
// actually called them.
function seedAllTeammateCalendars(): void {
  const keyDir = nodePath.join(process.cwd(), '.vendor-keys');
  if (!fs.existsSync(keyDir)) return;
  for (const name of knownTeammateNames()) {
    const file = nodePath.join(keyDir, `${name}.hex`);
    if (!fs.existsSync(file)) continue;
    try {
      const hex = fs.readFileSync(file, 'utf8').trim();
      const pk = getPublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));
      seedTeammateCalendar(pk, name);
      seededPubkeys.add(pk);
      console.log(`[calendar] seeded ${name} (${pk.slice(0, 8)}…) with this-week busy slots`);
    } catch (err) {
      console.error(`[calendar] failed to seed ${name}:`, err);
    }
  }
}

// Lazy seed fallback: if the server boots before the teammate processes have
// generated their .vendor-keys files (first-time install), the startup seed
// finds nothing. On the first calendar MCP call for a pubkey we don't know
// yet, rescan .vendor-keys and seed if the pubkey belongs to a known
// teammate name.
const seededPubkeys = new Set<string>();
function ensureCalendarSeeded(pubkey: string): void {
  if (seededPubkeys.has(pubkey)) return;
  seededPubkeys.add(pubkey); // mark even on miss to avoid repeat rescans
  const keyDir = nodePath.join(process.cwd(), '.vendor-keys');
  if (!fs.existsSync(keyDir)) return;
  for (const name of knownTeammateNames()) {
    const file = nodePath.join(keyDir, `${name}.hex`);
    if (!fs.existsSync(file)) continue;
    try {
      const hex = fs.readFileSync(file, 'utf8').trim();
      const pk = getPublicKey(Uint8Array.from(Buffer.from(hex, 'hex')));
      if (pk === pubkey) {
        seedTeammateCalendar(pk, name);
        console.log(`[calendar] lazy-seeded ${name} (${pk.slice(0, 8)}…) on first calendar call`);
        return;
      }
    } catch {
      /* ignore */
    }
  }
}

app.get('/me', (c) =>
  c.json({
    pubkey: getUserPubkey(),
    relays: getRelays(),
    categories: ALLOWED_CATEGORIES,
    audiences: [
      'any',
      'shoe-seller',
      'travel-agent',
      'food-vendor',
      'tech-vendor',
      'general-merchant',
    ],
    knownFriends: resolveContactAgents(FRIEND_NAMES),
    knownTeammates: resolveContactAgents(knownTeammateNames()).map((c) => ({
      ...c,
      role: TEAMMATE_ROLES[c.name] ?? 'coworker',
    })),
    model,
  }),
);

app.get('/health', (c) => c.json({ ok: true, model, mcpSessions: transports.size }));

// ─── LLM chat proxy ─────────────────────────────────────────────────────────

interface ChatBody {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
}

app.post('/chat', async (c) => {
  let body: ChatBody;
  try {
    body = (await c.req.json()) as ChatBody;
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: 'need messages[]' }, 400);
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: body.messages,
      tools: body.tools,
      tool_choice: body.tools && body.tools.length > 0 ? 'auto' : undefined,
    });
    return c.json({
      message: response.choices[0]?.message ?? null,
      finish_reason: response.choices[0]?.finish_reason,
      model,
    });
  } catch (err) {
    console.error('OpenRouter chat error:', err);
    return c.json({ error: 'llm call failed', detail: String(err) }, 500);
  }
});

// ─── Boot ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PROXY_PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`[server] listening on http://localhost:${port}`);
console.log(`[server] model: ${model}`);
console.log(`[server] user pubkey: ${getUserPubkey()}`);
console.log(`[server] mcp endpoint: http://localhost:${port}/mcp`);
seedAllTeammateCalendars();
