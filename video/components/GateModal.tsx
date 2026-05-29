import * as R from 'remotion';
import { Avatar } from './Avatar';
import { shortPubkey } from '../avatar';
import type { GateSummary } from '../types';

interface GateModalProps {
  gate: 'outbound' | 'inbound' | 'dm';
  summary: GateSummary;
  openFrame: number;
  closeFrame: number | null;
  decision: string | null;
}

function classifyDecision(d: string | null): 'approved' | 'cancelled' | null {
  if (!d) return null;
  const s = d.toLowerCase();
  if (s.includes('cancel') || s === 'skip' || s.includes('skip')) return 'cancelled';
  return 'approved';
}

const TONE = {
  outbound: {
    color: 'hsl(var(--destructive))',
    eyebrow: 'Public broadcast',
    title: 'Agent wants to broadcast a public question',
  },
  dm: {
    color: 'hsl(var(--safe))',
    eyebrow: 'Encrypted DM',
    title: 'Agent wants to send a private DM',
  },
  inbound: {
    color: 'hsl(var(--safe))',
    eyebrow: 'Reply received',
    title: 'Decide what to do with this reply',
  },
} as const;

export function GateModal({ gate, summary, openFrame, closeFrame, decision }: GateModalProps) {
  const frame = R.useCurrentFrame();
  const { fps } = R.useVideoConfig();
  const local = frame - openFrame;
  if (local < 0) return null;

  const s = R.spring({ frame: local, fps, config: { damping: 22, stiffness: 110 } });
  const opacity = R.interpolate(local, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const scale = R.interpolate(s, [0, 1], [0.96, 1]);

  // Decision flash + fade-out
  const decided = closeFrame !== null && frame >= closeFrame;
  const decidedLocal = decided ? frame - (closeFrame ?? frame) : 0;
  const fadeOut = decided ? R.interpolate(decidedLocal, [15, 30], [1, 0], { extrapolateRight: 'clamp' }) : 1;

  const tone = TONE[gate];
  const decisionKind = classifyDecision(decision);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-12 py-12"
      style={{ opacity: opacity * fadeOut, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-2 bg-[hsl(var(--card))] p-10 shadow-2xl"
        style={{
          borderColor: tone.color + '88',
          transform: `scale(${scale})`,
        }}
      >
        {decided && decisionKind && <DecidedOverlay decisionKind={decisionKind} />}

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em]"
              style={{ color: tone.color }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ background: tone.color + '1a' }}
              >
                <Icon gate={gate} />
              </span>
              {tone.eyebrow}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">{tone.title}</h2>
          </div>
        </div>

        {gate === 'outbound' && summary.gate === 'outbound' && (
          <OutboundBody summary={summary} color={tone.color} />
        )}
        {gate === 'dm' && summary.gate === 'dm' && (
          <DmBody summary={summary} color={tone.color} />
        )}
        {gate === 'inbound' && summary.gate === 'inbound' && (
          <InboundBody summary={summary} color={tone.color} />
        )}
      </div>
    </div>
  );
}

function DecidedOverlay({ decisionKind }: { decisionKind: 'approved' | 'cancelled' }) {
  // Decision feedback is always about the OUTCOME, not the modal's risk tone.
  // Green for approval / include / trust; red for cancel / skip.
  const color =
    decisionKind === 'approved' ? 'hsl(var(--safe))' : 'hsl(var(--destructive))';
  const symbol = decisionKind === 'approved' ? '✓' : '✗';
  const label = decisionKind === 'approved' ? 'Approved' : 'Cancelled';
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{ background: color + '18' }}
    >
      <div
        className="rounded-full border-2 px-8 py-3 text-2xl font-semibold uppercase tracking-[0.18em] shadow-2xl"
        style={{ borderColor: color, color, background: color + '22' }}
      >
        {symbol} {label}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ReadonlyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 px-4 py-3 text-base leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </div>
  );
}

function OutboundBody({
  summary,
  color,
}: {
  summary: Extract<GateSummary, { gate: 'outbound' }>;
  color: string;
}) {
  return (
    <>
      <Field label="Your message (kept local)">
        <ReadonlyBlock>{summary.userInput}</ReadonlyBlock>
      </Field>
      <Field label="Broadcast question (editable)">
        <ReadonlyBlock>{summary.question}</ReadonlyBlock>
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
        <Field label="Audience">
          <ReadonlyBlock>{summary.audience}</ReadonlyBlock>
        </Field>
        <Field label="Category">
          <ReadonlyBlock>{summary.category}</ReadonlyBlock>
        </Field>
        <Field label="Listen for">
          <ReadonlyBlock>{summary.listenWindowSec}s</ReadonlyBlock>
        </Field>
        <Field label="Expires in">
          <ReadonlyBlock>{summary.expirationSec}s</ReadonlyBlock>
        </Field>
      </div>
      <Footer color={color} primary="Broadcast" />
    </>
  );
}

function DmBody({
  summary,
  color,
}: {
  summary: Extract<GateSummary, { gate: 'dm' }>;
  color: string;
}) {
  return (
    <>
      <Field label={`Recipients (${summary.recipients.length})`}>
        <div className="flex max-h-32 flex-col gap-1.5 overflow-hidden">
          {summary.recipients.slice(0, 4).map((r) => (
            <div
              key={r.pubkey}
              className="flex items-center gap-2.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 px-3 py-2"
            >
              <Avatar name={r.displayName || '?'} seed={r.pubkey} size="sm" ring="safe" />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium">
                  {r.displayName || '(unknown)'}
                </span>
                <span className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  {shortPubkey(r.pubkey)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Field>
      <Field label="Message content (encrypted before sending)">
        <ReadonlyBlock>{summary.content}</ReadonlyBlock>
      </Field>
      <Footer color={color} primary="Send DM" />
    </>
  );
}

function InboundBody({
  summary,
  color,
}: {
  summary: Extract<GateSummary, { gate: 'inbound' }>;
  color: string;
}) {
  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 px-3 py-3">
        <Avatar name={summary.senderName} seed={summary.senderPubkey} size="lg" ring="muted" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-medium">{summary.senderName}</span>
          <span className="truncate font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            {shortPubkey(summary.senderPubkey)}
          </span>
        </div>
      </div>
      <Field label="Reply content">
        <ReadonlyBlock>{summary.replyText}</ReadonlyBlock>
      </Field>
      <Footer color={color} primary="Trust & include" />
    </>
  );
}

function Footer({ color, primary }: { color: string; primary: string }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      <div className="rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">
        Cancel
      </div>
      <div
        className="rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-md"
        style={{ background: color }}
      >
        {primary}
      </div>
    </div>
  );
}

function Icon({ gate }: { gate: 'outbound' | 'inbound' | 'dm' }) {
  if (gate === 'outbound') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M4.9 19.1A10 10 0 0 1 4.9 4.9" />
        <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
        <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
      </svg>
    );
  }
  if (gate === 'dm') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect width={18} height={11} x={3} y={11} rx={2} />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M14.5 9.5h.01M9.5 9.5h.01" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
