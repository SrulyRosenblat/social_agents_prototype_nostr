import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AUDIENCES, type Audience } from '../shared/nip90';

let clientPromise: Promise<Client> | null = null;

export async function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(
        new URL('http://localhost:3000/mcp'),
      );
      const client = new Client({ name: 'agent-me-frontend', version: '0.1.0' });
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export async function listTools(): Promise<McpTool[]> {
  const client = await getMcpClient();
  const result = await client.listTools();
  return result.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));
}

export type AgentType = 'friend' | 'shoe-seller' | 'unknown';
export { AUDIENCES, type Audience };

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

export interface BroadcastArgs {
  question: string;
  category: string;
  audience?: Audience;
  listen_window_seconds?: number;
}

export interface BroadcastArgsFull extends BroadcastArgs {
  expiration_seconds?: number;
}

export async function callBroadcast(
  args: BroadcastArgsFull,
  options?: {
    signal?: AbortSignal;
    onReply?: (reply: BroadcastReply) => void;
  },
): Promise<BroadcastResult> {
  const client = await getMcpClient();
  const listenSec = args.listen_window_seconds ?? 30;
  const requestTimeoutMs = listenSec * 1000 + 30_000;

  const result = await client.callTool(
    {
      name: 'broadcast',
      arguments: args as unknown as Record<string, unknown>,
    },
    undefined,
    {
      signal: options?.signal,
      timeout: requestTimeoutMs,
      // Reset timeout on each progress notification so a steady stream of
      // replies keeps the request alive even past the base timeout.
      resetTimeoutOnProgress: true,
      onprogress: (progress) => {
        if (!options?.onReply) return;
        const msg = progress.message;
        if (!msg) return;
        try {
          const parsed = JSON.parse(msg) as { kind?: string; reply?: BroadcastReply };
          if (parsed.kind === 'reply' && parsed.reply) {
            options.onReply(parsed.reply);
          }
        } catch {
          /* ignore malformed progress messages */
        }
      },
    },
  );
  const content = (result.content as Array<{ type: string; text?: string }> | undefined) ?? [];
  const text = content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text) as BroadcastResult;
}

// ─── DM (NIP-17 encrypted private message) ──────────────────────────────────
//
// The reply shape on the wire is identical to BroadcastReply (the server
// decrypts gift wraps and emits the same `{kind: 'reply', reply}` envelope),
// so the frontend can route both through the same queue + inbound gate.

export interface DmReply extends BroadcastReply {}

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

export interface DmArgs {
  recipient_pubkeys: string[];
  content: string;
  listen_window_seconds?: number;
  expiration_seconds?: number;
}

export async function callDm(
  args: DmArgs,
  options?: {
    signal?: AbortSignal;
    onReply?: (reply: DmReply) => void;
  },
): Promise<DmResult> {
  const client = await getMcpClient();
  const listenSec = args.listen_window_seconds ?? 45;
  const requestTimeoutMs = listenSec * 1000 + 30_000;

  const result = await client.callTool(
    {
      name: 'dm',
      arguments: args as unknown as Record<string, unknown>,
    },
    undefined,
    {
      signal: options?.signal,
      timeout: requestTimeoutMs,
      resetTimeoutOnProgress: true,
      onprogress: (progress) => {
        if (!options?.onReply) return;
        const msg = progress.message;
        if (!msg) return;
        try {
          const parsed = JSON.parse(msg) as { kind?: string; reply?: DmReply };
          if (parsed.kind === 'reply' && parsed.reply) {
            options.onReply(parsed.reply);
          }
        } catch {
          /* ignore malformed progress messages */
        }
      },
    },
  );
  const content = (result.content as Array<{ type: string; text?: string }> | undefined) ?? [];
  const text = content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text) as DmResult;
}
