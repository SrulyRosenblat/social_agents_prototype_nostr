import './ui/styles.css';
import { initUserAgent, runTurn, type ChatMessage, type LogLevel, type ListeningState } from './user-agent';
import { listLabeled, removeLabel } from './label-store';
import { shortPubkey } from './keys';

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <header class="topbar">
    <h1>agent.me / nostr</h1>
    <div class="right">
      <span class="pk">you: <span id="user-pk">connecting…</span></span>
      <button class="icon" id="labels-btn">Labels</button>
    </div>
  </header>

  <main class="split">
    <section class="chat-pane">
      <div class="chat-banner" id="banner">
        <strong>Public relays:</strong> queries, pubkeys, and replies are visible on Nostr. Audience filtering is opt-in for agents, not enforced cryptographically.
      </div>
      <div class="chat-scroll" id="chat"></div>
      <div id="listening-slot"></div>
      <div class="composer">
        <textarea id="question" placeholder="Tell your agent what you want…" rows="1" disabled></textarea>
        <button id="send" disabled>Send</button>
      </div>
    </section>

    <aside class="sidebar">
      <header>
        <span>Permissions log</span>
        <button id="clear-log">Clear</button>
      </header>
      <div class="log" id="log"></div>
    </aside>
  </main>
`;

const chatEl = document.querySelector<HTMLDivElement>('#chat')!;
const logEl = document.querySelector<HTMLDivElement>('#log')!;
const sendBtn = document.querySelector<HTMLButtonElement>('#send')!;
const questionEl = document.querySelector<HTMLTextAreaElement>('#question')!;
const userPkEl = document.querySelector<HTMLSpanElement>('#user-pk')!;
const labelsBtn = document.querySelector<HTMLButtonElement>('#labels-btn')!;
const clearLogBtn = document.querySelector<HTMLButtonElement>('#clear-log')!;
const listeningSlot = document.querySelector<HTMLDivElement>('#listening-slot')!;

function log(message: string, level: LogLevel = 'info'): void {
  const entry = document.createElement('div');
  entry.className = `entry ${level === 'info' ? 'system' : level}`;
  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = new Date().toLocaleTimeString([], { hour12: false });
  const msg = document.createElement('span');
  msg.className = 'msg';
  msg.textContent = message;
  entry.appendChild(ts);
  entry.appendChild(msg);
  logEl.insertBefore(entry, logEl.firstChild);
}

function appendChat(msg: ChatMessage): void {
  const bubble = document.createElement('div');
  if (msg.kind === 'user') {
    bubble.className = 'bubble user';
    bubble.textContent = msg.text;
  } else if (msg.kind === 'vendor') {
    // Visual style driven by USER-side label, not agent's self-claim.
    const labelClass = msg.label === 'friend' ? 'friend' : msg.label === 'shoe-seller' ? 'shoe-seller' : 'unlabeled';
    // Collapsed by default — clicking the header expands the body.
    bubble.className = `bubble vendor ${labelClass} collapsed`;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'bubble-header';

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▸';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = msg.displayName;
    const pk = document.createElement('span');
    pk.className = 'pk';
    pk.textContent = shortPubkey(msg.pubkey);
    const badge = document.createElement('span');
    badge.className = `badge ${labelClass}`;
    badge.textContent =
      msg.label === 'friend'
        ? 'friend'
        : msg.label === 'shoe-seller'
          ? 'shoe-seller'
          : 'unlabeled';
    const preview = document.createElement('span');
    preview.className = 'preview';
    preview.textContent =
      msg.text.length > 80 ? `${msg.text.slice(0, 80).replace(/\s+/g, ' ')}…` : msg.text;

    header.appendChild(chevron);
    header.appendChild(name);
    header.appendChild(pk);
    header.appendChild(badge);
    header.appendChild(preview);

    const body = document.createElement('div');
    body.className = 'bubble-body';
    body.textContent = msg.text;

    header.onclick = () => {
      const isCollapsed = bubble.classList.toggle('collapsed');
      chevron.textContent = isCollapsed ? '▸' : '▾';
    };

    bubble.appendChild(header);
    bubble.appendChild(body);
  } else if (msg.kind === 'agent') {
    bubble.className = 'bubble agent';
    const meta = document.createElement('div');
    meta.className = 'bubble-meta';
    meta.textContent = 'your agent';
    const body = document.createElement('div');
    body.textContent = msg.text;
    bubble.appendChild(meta);
    bubble.appendChild(body);
  } else {
    bubble.className = 'bubble system';
    bubble.textContent = msg.text;
  }
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

let listeningCleanup: (() => void) | null = null;

function setListening(state: ListeningState | null): void {
  if (listeningCleanup) {
    listeningCleanup();
    listeningCleanup = null;
  }
  listeningSlot.innerHTML = '';
  if (!state) return;

  const banner = document.createElement('div');
  banner.className = 'listening-banner';

  const left = document.createElement('div');
  left.className = 'listening-left';
  const dot = document.createElement('span');
  dot.className = 'pulse-dot';
  const text = document.createElement('span');
  const audLabel =
    state.audience === 'any' ? 'everyone' : state.audience === 'friend' ? 'friends' : 'shoe sellers';
  text.textContent = `listening to ${audLabel}…`;
  const counter = document.createElement('span');
  counter.className = 'countdown';
  let remaining = state.windowSec;
  counter.textContent = `${remaining}s`;
  left.appendChild(dot);
  left.appendChild(text);
  left.appendChild(counter);

  const stopBtn = document.createElement('button');
  stopBtn.className = 'stop-btn';
  stopBtn.textContent = 'Stop listening';
  stopBtn.onclick = () => state.cancel();

  banner.appendChild(left);
  banner.appendChild(stopBtn);
  listeningSlot.appendChild(banner);

  const intv = setInterval(() => {
    remaining -= 1;
    if (remaining < 0) remaining = 0;
    counter.textContent = `${remaining}s`;
  }, 1000);
  listeningCleanup = () => clearInterval(intv);
}

function refreshLabelView(): void {
  /* labels popover renders fresh each open */
}

let popoverEl: HTMLElement | null = null;
labelsBtn.onclick = () => {
  if (popoverEl) {
    popoverEl.remove();
    popoverEl = null;
    return;
  }
  popoverEl = renderLabelsPopover();
};

function renderLabelsPopover(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'popover-backdrop';
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
      popoverEl = null;
    }
  };

  const pop = document.createElement('div');
  pop.className = 'popover';

  const render = () => {
    pop.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = 'Pubkey labels';
    pop.appendChild(h);
    const entries = listLabeled();
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No labels yet. Label a sender from the inbound modal.';
      pop.appendChild(empty);
      return;
    }
    const ul = document.createElement('ul');
    for (const entry of entries) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.displayName;
      const pk = document.createElement('span');
      pk.className = 'pk-short';
      pk.textContent = shortPubkey(entry.pubkey);
      const lbl = document.createElement('span');
      lbl.className = `inline-badge ${entry.label}`;
      lbl.textContent = entry.label;
      left.appendChild(name);
      left.appendChild(pk);
      left.appendChild(lbl);
      const btn = document.createElement('button');
      btn.textContent = 'Remove';
      btn.onclick = () => {
        removeLabel(entry.pubkey);
        render();
      };
      li.appendChild(left);
      li.appendChild(btn);
      ul.appendChild(li);
    }
    pop.appendChild(ul);
  };

  render();
  backdrop.appendChild(pop);
  document.body.appendChild(backdrop);
  return backdrop;
}

clearLogBtn.onclick = () => {
  logEl.innerHTML = '';
};

questionEl.addEventListener('input', () => {
  questionEl.style.height = 'auto';
  questionEl.style.height = `${Math.min(questionEl.scrollHeight, 160)}px`;
});

questionEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

(async () => {
  let state;
  try {
    state = await initUserAgent();
  } catch (err) {
    log(`failed to reach server: ${String(err)} — is it running?`, 'warn');
    userPkEl.textContent = '(offline)';
    return;
  }
  userPkEl.textContent = shortPubkey(state.userPubkey);
  log(`user agent ready · pubkey ${state.userPubkey.slice(0, 16)}…`, 'system');

  async function handleSend(): Promise<void> {
    const question = questionEl.value.trim();
    if (!question) return;
    sendBtn.disabled = true;
    questionEl.disabled = true;
    questionEl.value = '';
    questionEl.style.height = 'auto';
    try {
      await runTurn(state!, question, { log, appendChat, refreshLabelView, setListening });
    } catch (err) {
      log(`error: ${String(err)}`, 'warn');
    } finally {
      sendBtn.disabled = false;
      questionEl.disabled = false;
      questionEl.focus();
    }
  }
  sendBtn.onclick = handleSend;

  sendBtn.disabled = false;
  questionEl.disabled = false;
  questionEl.focus();
})();
