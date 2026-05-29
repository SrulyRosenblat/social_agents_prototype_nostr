// Captures every user-visible event during a session so we can replay the
// flow inside Remotion. Records chat appends, permissions-log entries,
// listening start/stop, and gate open/decision events with relative
// timestamps (ms from the first event).

import type { ChatMessage, ListeningState, LogLevel } from '../user-agent';

export type DemoEvent =
  | { kind: 'chat'; t: number; message: ChatMessage }
  | { kind: 'log'; t: number; level: LogLevel | 'info'; message: string }
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
      /** Free-text reason the vendor gave (may be empty when none provided). */
      reason: string;
    };

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

let started: number | null = null;
const events: DemoEvent[] = [];
type Listener = (size: number) => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l(events.length);
}

function now(): number {
  if (started === null) {
    started = Date.now();
    return 0;
  }
  return Date.now() - started;
}

function push(event: DemoEvent): void {
  events.push(event);
  notify();
}

export const demoRecorder = {
  chat(message: ChatMessage): void {
    push({ kind: 'chat', t: now(), message });
  },
  log(level: LogLevel | 'info', message: string): void {
    push({ kind: 'log', t: now(), level, message });
  },
  listeningStart(windowSec: number, audience: string): void {
    push({ kind: 'listening-start', t: now(), windowSec, audience });
  },
  listeningStop(): void {
    push({ kind: 'listening-stop', t: now() });
  },
  gateOpen(gate: 'outbound' | 'inbound' | 'dm', summary: GateSummary): void {
    push({ kind: 'gate-open', t: now(), gate, summary });
  },
  gateDecision(gate: 'outbound' | 'inbound' | 'dm', decision: string): void {
    push({ kind: 'gate-decision', t: now(), gate, decision });
  },
  decline(vendorName: string, vendorPubkey: string, reason: string): void {
    push({ kind: 'decline', t: now(), vendorName, vendorPubkey, reason });
  },
  reset(): void {
    events.length = 0;
    started = null;
    notify();
  },
  getTimeline(): DemoEvent[] {
    return events.slice();
  },
  size(): number {
    return events.length;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(events.length);
    return () => {
      listeners.delete(listener);
    };
  },
};

