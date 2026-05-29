// Thin adapter — preserves the original Promise-returning signature so
// user-agent.ts is unaware that the modal now lives in React. See
// /lib/gate-bridge.ts and /components/gates/OutboundGate.tsx.

import { pushGateRequest, type OutboundGateResult } from '../lib/gate-bridge';
import type { Audience } from '../mcp-client';

export type OutboundDecision = OutboundGateResult;

export function showOutboundGate(
  userInput: string,
  proposedQuestion: string,
  proposedCategory: string,
  proposedAudience: Audience,
  proposedWindowSec: number,
  proposedExpirationSec: number,
  userPubkey: string,
): Promise<OutboundDecision> {
  return pushGateRequest<OutboundDecision>((resolve) => ({
    kind: 'outbound',
    userInput,
    proposedQuestion,
    proposedCategory,
    proposedAudience,
    proposedWindowSec,
    proposedExpirationSec,
    userPubkey,
    resolve,
  }));
}
