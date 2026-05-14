// Outbound approval gate for the `dm` tool. Mirrors outbound-gate.ts but for
// private encrypted messages. Shows the recipient list (with whatever the user
// has already labeled them as), the editable content, expiration, and listen
// window. The privacy note for DMs is GREEN-positive rather than RED-warning
// because the message itself is encrypted and the sender identity is hidden —
// but it still flags what stays leaky (recipients can log/share, the user's
// receiving pubkey is still observable).

import { shortPubkey } from '../keys';
import { getLabel, type Label } from '../label-store';

export interface DmRecipientView {
  pubkey: string;
  /** Display name pulled from chat history / labels; empty string if unknown. */
  displayName: string;
}

export interface DmGateDecision {
  approved: boolean;
  recipients: string[];
  content: string;
  listenWindowSec: number;
  expirationSec: number;
}

export function showDmGate(
  proposedRecipients: DmRecipientView[],
  proposedContent: string,
  proposedListenWindowSec: number,
  proposedExpirationSec: number,
): Promise<DmGateDecision> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal outbound dm';

    const safeWindow = Math.max(5, Math.min(90, proposedListenWindowSec));
    const safeExpiration = Math.max(60, Math.min(3600, proposedExpirationSec));

    modal.innerHTML = `
      <h2>Agent wants to send a private DM</h2>
      <div class="field">
        <label>Recipients (${proposedRecipients.length} — encrypted separately for each)</label>
        <ul class="dm-recipients" id="dm-recipients"></ul>
      </div>
      <div class="field">
        <label>Message content (editable — encrypted before sending)</label>
        <textarea id="dm-content" class="dm-content" rows="5"></textarea>
      </div>
      <div class="row-fields">
        <div class="field">
          <label>Listen for replies (sec)</label>
          <input type="number" id="dm-window" min="5" max="90" value="${safeWindow}" />
        </div>
        <div class="field">
          <label>DM expires in (sec)</label>
          <input type="number" id="dm-expiration" min="60" max="3600" value="${safeExpiration}" />
        </div>
      </div>
      <div class="privacy-note safe">
        <strong>Encrypted:</strong> message body is end-to-end encrypted (NIP-44). Your
        identity as sender is hidden from relays via gift wrap (NIP-59).
        Still observable: <em>your receiving pubkey</em> (replies come to you), and
        anything the recipients choose to log or repeat. Each recipient gets a
        separately-encrypted copy.
      </div>
      <div class="actions">
        <button class="secondary" id="dm-cancel">Cancel</button>
        <button id="dm-send">Send DM</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const recipientsList = modal.querySelector<HTMLUListElement>('#dm-recipients')!;
    for (const r of proposedRecipients) {
      const li = document.createElement('li');
      const label: Label | undefined = getLabel(r.pubkey);
      const labelClass =
        label === 'trusted' ? 'trusted' : label === 'malicious' ? 'malicious' : 'unlabeled';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = r.displayName || '(unknown)';

      const pkSpan = document.createElement('span');
      pkSpan.className = 'pk-short';
      pkSpan.textContent = shortPubkey(r.pubkey);

      const badge = document.createElement('span');
      badge.className = `inline-badge ${labelClass}`;
      badge.textContent = label ?? 'unlabeled';

      li.appendChild(nameSpan);
      li.appendChild(pkSpan);
      li.appendChild(badge);
      recipientsList.appendChild(li);
    }

    const contentEl = modal.querySelector<HTMLTextAreaElement>('#dm-content')!;
    contentEl.value = proposedContent;

    const windowInput = modal.querySelector<HTMLInputElement>('#dm-window')!;
    const expirationInput = modal.querySelector<HTMLInputElement>('#dm-expiration')!;

    const sendBtn = modal.querySelector<HTMLButtonElement>('#dm-send')!;
    const cancelBtn = modal.querySelector<HTMLButtonElement>('#dm-cancel')!;

    const close = (decision: DmGateDecision) => {
      backdrop.remove();
      resolve(decision);
    };

    sendBtn.onclick = () => {
      const content = contentEl.value.trim();
      if (!content) return;
      const win = Math.max(5, Math.min(90, parseInt(windowInput.value, 10) || safeWindow));
      const exp = Math.max(60, Math.min(3600, parseInt(expirationInput.value, 10) || safeExpiration));
      close({
        approved: true,
        recipients: proposedRecipients.map((r) => r.pubkey),
        content,
        listenWindowSec: win,
        expirationSec: exp,
      });
    };

    cancelBtn.onclick = () =>
      close({
        approved: false,
        recipients: proposedRecipients.map((r) => r.pubkey),
        content: proposedContent,
        listenWindowSec: safeWindow,
        expirationSec: safeExpiration,
      });
  });
}
