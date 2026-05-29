// Mirrors src/frontend/lib/demo-recorder.ts but kept here so the Remotion
// bundle has no dependency on the live app's source tree. The server
// serializes events to JSON and they arrive on this side as inputProps.

export type DemoEvent =
  | { kind: 'chat'; t: number; message: ChatMessage }
  | { kind: 'log'; t: number; level: string; message: string }
  | {
      kind: 'listening-start';
      t: number;
      windowSec: number;
      audience: string;
    }
  | { kind: 'listening-stop'; t: number }
  | {
      kind: 'gate-open';
      t: number;
      gate: 'outbound' | 'inbound' | 'dm';
      summary: GateSummary;
    }
  | {
      kind: 'gate-decision';
      t: number;
      gate: 'outbound' | 'inbound' | 'dm';
      decision: string;
    }
  | {
      kind: 'decline';
      t: number;
      vendorName: string;
      vendorPubkey: string;
      reason: string;
    };

export type ChatMessage =
  | { kind: 'user'; text: string }
  | { kind: 'agent'; text: string }
  | {
      kind: 'vendor';
      text: string;
      displayName: string;
      pubkey: string;
      label: 'trusted' | 'malicious' | undefined;
      claimedType: 'friend' | 'shoe-seller' | 'teammate' | 'unknown';
    }
  | { kind: 'system'; text: string };

export type GateSummary =
  | {
      gate: 'outbound';
      question: string;
      category: string;
      audience: string;
      listenWindowSec: number;
      expirationSec: number;
      userInput: string;
    }
  | {
      gate: 'inbound';
      senderName: string;
      senderPubkey: string;
      replyText: string;
    }
  | {
      gate: 'dm';
      recipients: { pubkey: string; displayName: string }[];
      content: string;
      listenWindowSec: number;
      expirationSec: number;
    };

export interface FlowProps {
  events: DemoEvent[];
  /** Frames per beat — how slowly each event scene is paced. Default 75 (2.5s @ 30fps). */
  beatFrames: number;
}
