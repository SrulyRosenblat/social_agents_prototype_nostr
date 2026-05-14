import type { AgentReply, VendorProfile } from '../../shared/types';
import { shortPubkey } from '../keys';

export type InboundDecisionAction =
  | { action: 'include' }
  | { action: 'skip' }
  | { action: 'label-and-include'; label: 'trusted' }
  | { action: 'label-and-skip'; label: 'malicious' };

const CLAIMED_LABEL: Record<string, string> = {
  friend: 'claims: friend',
  'shoe-seller': 'claims: shoe-seller',
  unknown: 'no claim',
};

export function showInboundGate(
  reply: AgentReply,
  profile: VendorProfile,
  claimedType: 'friend' | 'shoe-seller' | 'unknown',
): Promise<InboundDecisionAction> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal inbound';

    const displayName = profile.name ?? '(no profile name)';

    modal.innerHTML = `
      <div class="modal-header-row">
        <h2>Reply received <span class="trust-badge untrusted">unlabeled</span></h2>
        <button class="corner-danger" id="ib-malicious" title="Label this pubkey as malicious — its replies will be auto-skipped from now on">
          ⚠ Mark malicious
        </button>
      </div>
      <div class="field">
        <label>From (display name &mdash; not verified)</label>
        <div class="value">${escapeHtml(displayName)} <span class="muted-claim">${escapeHtml(CLAIMED_LABEL[claimedType] ?? 'no claim')}</span></div>
      </div>
      <div class="field">
        <label>Pubkey (identity)</label>
        <div class="value">${escapeHtml(shortPubkey(reply.vendorPubkey))}</div>
      </div>
      <div class="field">
        <label>Reply content (plain text)</label>
        <div class="reply-content" id="ib-content"></div>
      </div>
      <div class="actions">
        <button class="secondary" id="ib-skip">Skip</button>
        <button id="ib-include">Include once</button>
        <button class="safe" id="ib-trust">Label as trusted &amp; include</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const contentEl = modal.querySelector<HTMLDivElement>('#ib-content')!;
    contentEl.textContent = reply.text;

    const close = (decision: InboundDecisionAction) => {
      backdrop.remove();
      resolve(decision);
    };

    modal.querySelector<HTMLButtonElement>('#ib-skip')!.onclick = () => close({ action: 'skip' });
    modal.querySelector<HTMLButtonElement>('#ib-include')!.onclick = () =>
      close({ action: 'include' });
    modal.querySelector<HTMLButtonElement>('#ib-trust')!.onclick = () =>
      close({ action: 'label-and-include', label: 'trusted' });
    modal.querySelector<HTMLButtonElement>('#ib-malicious')!.onclick = () =>
      close({ action: 'label-and-skip', label: 'malicious' });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
