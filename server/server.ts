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
  getUserPubkey,
  getRelays,
} from './nostr-bridge';

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
    "Publish a question publicly to the user's network of agents (friends + shoe-sellers) over Nostr, listen for replies for a bounded time, and return them. Pick a listen_window_seconds that fits the question. Use the audience parameter when it's clear who should answer (e.g., shopping for shoes → 'shoe-seller', asking for personal recommendations → 'friend'). Use 'any' when you want to hear from everyone.",
    {
      question: z
        .string()
        .max(200)
        .describe('Concise public broadcast question. No personal identifiers unless the user clearly chose to disclose them.'),
      category: z
        .enum(ALLOWED_CATEGORIES)
        .describe('Topic category — a hint used for routing.'),
      audience: z
        .enum(['any', 'friend', 'shoe-seller'])
        .default('any')
        .describe("Who should answer. 'friend' = personal contacts only; 'shoe-seller' = shoe vendors only; 'any' = everyone."),
      listen_window_seconds: z
        .number()
        .int()
        .min(5)
        .max(90)
        .default(30)
        .describe('How long (seconds) to wait for replies before returning. The user may stop early.'),
    },
    async ({ question, category, audience, listen_window_seconds }, extra) => {
      const progressToken = extra._meta?.progressToken;
      let progressCount = 0;
      const total = listen_window_seconds; // best-guess upper bound

      const result = await nostrBroadcast(question, category, {
        listenWindowMs: listen_window_seconds * 1000,
        signal: extra.signal,
        audience,
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

// Map of agent name (the local file under .vendor-keys/) → friend pubkey hex.
// Used to suggest initial labels to the client UI on first load.
// Vendors are intentionally NOT exposed — they should appear unlabeled (unknown)
// to the user, who decides whether to recognize them.
function listKnownFriendAgents(): Array<{ name: string; pubkey: string }> {
  const keyDir = nodePath.join(process.cwd(), '.vendor-keys');
  if (!fs.existsSync(keyDir)) return [];
  const friendFiles = ['alex', 'sam', 'pat', 'jordan'];
  return friendFiles
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

app.get('/me', (c) =>
  c.json({
    pubkey: getUserPubkey(),
    relays: getRelays(),
    categories: ALLOWED_CATEGORIES,
    audiences: ['any', 'friend', 'shoe-seller'],
    knownFriends: listKnownFriendAgents(),
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
