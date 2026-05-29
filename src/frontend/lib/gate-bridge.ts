// Imperative pub-sub bridge that lets the (non-React) user-agent code keep
// awaiting Promise-returning gate functions while the actual modal UI is
// rendered by React. Each gate request carries a `resolve` callback the modal
// invokes when the user makes a decision.

import type { AgentReply, VendorProfile } from '../../shared/types';
import type { Audience } from '../mcp-client';
import { demoRecorder, type GateSummary } from './demo-recorder';

export interface OutboundGateRequest {
  kind: 'outbound';
  userInput: string;
  proposedQuestion: string;
  proposedCategory: string;
  proposedAudience: Audience;
  proposedWindowSec: number;
  proposedExpirationSec: number;
  userPubkey: string;
  resolve: (decision: OutboundGateResult) => void;
}

export interface OutboundGateResult {
  approved: boolean;
  question: string;
  category: string;
  audience: Audience;
  listenWindowSec: number;
  expirationSec: number;
}

export interface DmGateRequest {
  kind: 'dm';
  recipients: ReadonlyArray<{ pubkey: string; displayName: string }>;
  proposedContent: string;
  proposedWindowSec: number;
  proposedExpirationSec: number;
  resolve: (decision: DmGateResult) => void;
}

export interface DmGateResult {
  approved: boolean;
  recipients: string[];
  content: string;
  listenWindowSec: number;
  expirationSec: number;
}

export interface InboundGateRequest {
  kind: 'inbound';
  reply: AgentReply;
  profile: VendorProfile;
  claimedType: 'friend' | 'shoe-seller' | 'teammate' | 'unknown';
  resolve: (decision: InboundGateResult) => void;
}

export type InboundGateResult =
  | { action: 'include' }
  | { action: 'skip' }
  | { action: 'label-and-include'; label: 'trusted' }
  | { action: 'label-and-skip'; label: 'malicious' };

export type GateRequest = OutboundGateRequest | DmGateRequest | InboundGateRequest;

type Listener = (req: GateRequest | null) => void;

let active: GateRequest | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l(active);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}

export function getActive(): GateRequest | null {
  return active;
}

export function pushGateRequest<R>(
  build: (resolve: (r: R) => void) => GateRequest,
): Promise<R> {
  return new Promise<R>((resolve) => {
    const req = build((value) => {
      // Only clear if the resolved request is still the active one;
      // otherwise a queued request might race-clear a different active modal.
      if (active === req) {
        active = null;
        notify();
      }
      demoRecorder.gateDecision(req.kind, summarizeDecision(req, value as unknown));
      resolve(value);
    });
    active = req;
    demoRecorder.gateOpen(req.kind, summarizeRequest(req));
    notify();
  });
}

function summarizeRequest(req: GateRequest): GateSummary {
  if (req.kind === 'outbound') {
    return {
      gate: 'outbound',
      userInput: req.userInput,
      question: req.proposedQuestion,
      category: req.proposedCategory,
      audience: req.proposedAudience,
      listenWindowSec: req.proposedWindowSec,
      expirationSec: req.proposedExpirationSec,
    };
  }
  if (req.kind === 'dm') {
    return {
      gate: 'dm',
      recipients: req.recipients.map((r) => ({
        pubkey: r.pubkey,
        displayName: r.displayName,
      })),
      content: req.proposedContent,
      listenWindowSec: req.proposedWindowSec,
      expirationSec: req.proposedExpirationSec,
    };
  }
  return {
    gate: 'inbound',
    senderName: req.profile.name ?? '(no name)',
    senderPubkey: req.reply.vendorPubkey,
    replyText: req.reply.text,
  };
}

function summarizeDecision(req: GateRequest, value: unknown): string {
  if (req.kind === 'outbound') {
    const v = value as { approved: boolean };
    return v.approved ? 'broadcast approved' : 'cancelled';
  }
  if (req.kind === 'dm') {
    const v = value as { approved: boolean };
    return v.approved ? 'dm approved' : 'cancelled';
  }
  const v = value as { action: string };
  return v.action;
}
