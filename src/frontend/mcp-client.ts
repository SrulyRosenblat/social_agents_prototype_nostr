import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
export type Audience = 'any' | 'friend' | 'shoe-seller';

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

export async function callBroadcast(
  args: BroadcastArgs,
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
