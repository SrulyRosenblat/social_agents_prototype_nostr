// Thin adapter — see /lib/gate-bridge.ts and /components/gates/DmGate.tsx.

import { pushGateRequest, type DmGateResult } from '../lib/gate-bridge';

export interface DmRecipientView {
  pubkey: string;
  /** Display name pulled from chat history / labels; empty string if unknown. */
  displayName: string;
}

export type DmGateDecision = DmGateResult;

export function showDmGate(
  proposedRecipients: DmRecipientView[],
  proposedContent: string,
  proposedListenWindowSec: number,
  proposedExpirationSec: number,
): Promise<DmGateDecision> {
  return pushGateRequest<DmGateDecision>((resolve) => ({
    kind: 'dm',
    recipients: proposedRecipients,
    proposedContent,
    proposedWindowSec: proposedListenWindowSec,
    proposedExpirationSec,
    resolve,
  }));
}
