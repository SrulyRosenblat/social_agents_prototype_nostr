import { categoryTag, DEFAULT_RELAYS, TOPIC_ROOT } from '../../shared/topics';
import { AUDIENCES } from '../../shared/nip90';
import { shortPubkey } from '../keys';
import type { Audience } from '../mcp-client';

export interface OutboundDecision {
  approved: boolean;
  question: string;
  category: string;
  audience: Audience;
  listenWindowSec: number;
  /** NIP-40 expiration on the published broadcast event, in seconds from now. */
  expirationSec: number;
}

const ALLOWED_CATEGORIES = ['shoes', 'travel', 'food', 'tech', 'general'];
const ALLOWED_AUDIENCES: readonly Audience[] = AUDIENCES;
const AUDIENCE_LABEL: Record<Audience, string> = {
  any: 'everyone',
  'shoe-seller': 'shoe sellers',
  'travel-agent': 'travel agents',
  'food-vendor': 'food vendors',
  'tech-vendor': 'tech vendors',
  'general-merchant': 'general merchants',
};

export function showOutboundGate(
  userInput: string,
  proposedQuestion: string,
  proposedCategory: string,
  proposedAudience: Audience,
  proposedWindowSec: number,
  proposedExpirationSec: number,
  userPubkey: string,
): Promise<OutboundDecision> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal outbound';

    const safeCategory = ALLOWED_CATEGORIES.includes(proposedCategory)
      ? proposedCategory
      : 'general';
    const safeAudience: Audience = ALLOWED_AUDIENCES.includes(proposedAudience)
      ? proposedAudience
      : 'any';
    const safeWindow = Math.max(5, Math.min(90, proposedWindowSec));
    const safeExpiration = Math.max(60, Math.min(3600, proposedExpirationSec));

    modal.innerHTML = `
      <h2>Agent wants to broadcast</h2>
      <div class="field">
        <label>Your message (kept local, not broadcast)</label>
        <div class="value" id="ob-user-input"></div>
      </div>
      <div class="field">
        <label>Agent's proposed broadcast question (editable)</label>
        <div class="question" contenteditable="true" id="ob-question"></div>
      </div>
      <div class="row-fields">
        <div class="field">
          <label>Audience</label>
          <select id="ob-audience">
            ${ALLOWED_AUDIENCES.map(
              (a) => `<option value="${a}"${a === safeAudience ? ' selected' : ''}>${AUDIENCE_LABEL[a]}</option>`,
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label>Category</label>
          <select id="ob-category">
            ${ALLOWED_CATEGORIES.map(
              (c) => `<option value="${c}"${c === safeCategory ? ' selected' : ''}>${c}</option>`,
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label>Listen for (sec)</label>
          <input type="number" id="ob-window" min="5" max="90" value="${safeWindow}" />
        </div>
        <div class="field">
          <label>Expires in (sec)</label>
          <input type="number" id="ob-expiration" min="60" max="3600" value="${safeExpiration}" />
        </div>
      </div>
      <div class="field">
        <label>Tags / metadata</label>
        <div class="value">
          <code>#t: ${TOPIC_ROOT}</code> &nbsp;
          <code>#t: <span id="ob-cat-tag"></span></code> &nbsp;
          <code>#audience: <span id="ob-aud-tag"></span></code>
        </div>
      </div>
      <div class="field">
        <label>Relays</label>
        <div class="value">${DEFAULT_RELAYS.map(escapeHtml).join(', ')}</div>
      </div>
      <div class="field">
        <label>Your pubkey (visible publicly with this broadcast)</label>
        <div class="value">${escapeHtml(shortPubkey(userPubkey))}</div>
      </div>
      <div class="privacy-note">
        <strong>Public:</strong> question, tags, your pubkey, and replies are all visible on the relays.
        Audience filtering is an honor-system hint — non-targeted agents <em>can</em> still see the event; they just opt out of responding.
      </div>
      <div class="actions">
        <button class="secondary" id="ob-cancel">Cancel</button>
        <button id="ob-broadcast">Broadcast</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const userInputEl = modal.querySelector<HTMLDivElement>('#ob-user-input')!;
    userInputEl.textContent = userInput;

    const questionEl = modal.querySelector<HTMLDivElement>('#ob-question')!;
    questionEl.textContent = proposedQuestion;

    const categorySelect = modal.querySelector<HTMLSelectElement>('#ob-category')!;
    const audienceSelect = modal.querySelector<HTMLSelectElement>('#ob-audience')!;
    const windowInput = modal.querySelector<HTMLInputElement>('#ob-window')!;
    const expirationInput = modal.querySelector<HTMLInputElement>('#ob-expiration')!;
    const catTagEl = modal.querySelector<HTMLSpanElement>('#ob-cat-tag')!;
    const audTagEl = modal.querySelector<HTMLSpanElement>('#ob-aud-tag')!;

    const updateTags = () => {
      catTagEl.textContent = categoryTag(categorySelect.value);
      audTagEl.textContent = audienceSelect.value;
    };
    updateTags();
    categorySelect.onchange = updateTags;
    audienceSelect.onchange = updateTags;

    const broadcastBtn = modal.querySelector<HTMLButtonElement>('#ob-broadcast')!;
    const cancelBtn = modal.querySelector<HTMLButtonElement>('#ob-cancel')!;

    const close = (decision: OutboundDecision) => {
      backdrop.remove();
      resolve(decision);
    };

    broadcastBtn.onclick = () => {
      const question = (questionEl.textContent ?? '').trim();
      if (!question) return;
      const win = Math.max(5, Math.min(90, parseInt(windowInput.value, 10) || 30));
      const exp = Math.max(60, Math.min(3600, parseInt(expirationInput.value, 10) || safeExpiration));
      close({
        approved: true,
        question,
        category: categorySelect.value,
        audience: audienceSelect.value as Audience,
        listenWindowSec: win,
        expirationSec: exp,
      });
    };
    cancelBtn.onclick = () =>
      close({
        approved: false,
        question: proposedQuestion,
        category: proposedCategory,
        audience: safeAudience,
        listenWindowSec: safeWindow,
        expirationSec: safeExpiration,
      });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
