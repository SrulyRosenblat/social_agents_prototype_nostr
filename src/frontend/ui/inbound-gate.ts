// Thin adapter — see /lib/gate-bridge.ts and /components/gates/InboundGate.tsx.

import type { AgentReply, VendorProfile } from '../../shared/types';
import { pushGateRequest, type InboundGateResult } from '../lib/gate-bridge';

export type InboundDecisionAction = InboundGateResult;

export function showInboundGate(
  reply: AgentReply,
  profile: VendorProfile,
  claimedType: 'friend' | 'shoe-seller' | 'teammate' | 'unknown',
): Promise<InboundDecisionAction> {
  return pushGateRequest<InboundDecisionAction>((resolve) => ({
    kind: 'inbound',
    reply,
    profile,
    claimedType,
    resolve,
  }));
}
