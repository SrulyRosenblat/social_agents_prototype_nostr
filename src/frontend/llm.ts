const SERVER_URL = 'http://localhost:3000';

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
}

export type ChatMessageParam =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatResponse {
  message: AssistantMessage;
  finish_reason: string | null;
  model: string;
}

export async function chat(
  messages: ChatMessageParam[],
  tools?: ToolDef[],
): Promise<ChatResponse> {
  const res = await fetch(`${SERVER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, tools }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`chat failed: ${res.status} ${body}`);
  }
  return (await res.json()) as ChatResponse;
}

export interface KnownFriend {
  name: string;
  pubkey: string;
}

export interface ServerIdentity {
  pubkey: string;
  relays: string[];
  categories: string[];
  audiences: string[];
  knownFriends: KnownFriend[];
  model: string;
}

export async function fetchIdentity(): Promise<ServerIdentity> {
  const res = await fetch(`${SERVER_URL}/me`);
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return (await res.json()) as ServerIdentity;
}
