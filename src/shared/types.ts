import type { Event } from 'nostr-tools/pure';

export interface AgentQuery {
  id: string;
  pubkey: string;
  question: string;
  category: string;
  createdAt: number;
  raw: Event;
}

export interface AgentReply {
  id: string;
  vendorPubkey: string;
  queryId: string;
  text: string;
  createdAt: number;
  raw: Event;
}

export interface VendorProfile {
  pubkey: string;
  name?: string;
  about?: string;
  picture?: string;
}
