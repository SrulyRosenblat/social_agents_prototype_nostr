import * as R from 'remotion';
import { Avatar } from './Avatar';
import { shortPubkey } from '../avatar';
import type { ChatMessage } from '../types';

interface BubbleProps {
  msg: ChatMessage;
  /** Absolute frame at which this bubble appeared. */
  enterFrame: number;
}

function useEntryAnim(enterFrame: number) {
  const frame = R.useCurrentFrame();
  const { fps } = R.useVideoConfig();
  const local = Math.max(0, frame - enterFrame);
  const s = R.spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });
  const opacity = R.interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = R.interpolate(s, [0, 1], [16, 0]);
  return { opacity, translateY };
}

export function Bubble({ msg, enterFrame }: BubbleProps) {
  const { opacity, translateY } = useEntryAnim(enterFrame);
  const style = { opacity, transform: `translateY(${translateY}px)` };

  if (msg.kind === 'user') {
    return (
      <div className="flex justify-end" style={style}>
        <div className="flex max-w-[78%] items-end gap-3">
          <div
            className="rounded-2xl rounded-br-sm border border-[hsl(var(--primary))]/40 px-5 py-3 text-base leading-relaxed shadow-md whitespace-pre-wrap break-words"
            style={{ background: 'hsl(var(--primary) / 0.18)' }}
          >
            {msg.text}
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'hsl(var(--primary) / 0.22)', color: 'hsl(var(--primary))' }}
          >
            <span className="text-sm font-bold">You</span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === 'agent') {
    return (
      <div className="flex justify-start" style={style}>
        <div className="flex max-w-[80%] items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-lg shadow-[hsl(var(--primary))]/25"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.4) 100%)',
              color: 'white',
            }}
          >
            <Sparkle />
          </div>
          <div className="rounded-2xl rounded-bl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 shadow-md">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--primary))' }}>
              Your agent
            </div>
            <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-[hsl(var(--foreground))]">
              {msg.text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === 'system') {
    return (
      <div className="flex justify-center" style={style}>
        <div className="rounded-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--secondary))]/30 px-4 py-1.5 text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {msg.text}
        </div>
      </div>
    );
  }

  // vendor
  const tone =
    msg.label === 'trusted'
      ? { color: 'hsl(var(--safe))', ring: 'safe' as const, label: 'trusted' }
      : msg.label === 'malicious'
        ? { color: 'hsl(var(--destructive))', ring: 'destructive' as const, label: 'malicious' }
        : { color: 'hsl(var(--muted-foreground))', ring: 'muted' as const, label: 'unlabeled' };

  return (
    <div className="flex justify-start pl-10" style={style}>
      <div
        className="relative max-w-[88%] overflow-hidden rounded-xl border bg-[hsl(var(--card))] shadow-md"
        style={{ borderColor: `${tone.color}` }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background: `linear-gradient(180deg, ${tone.color}1a 0%, transparent 100%)`,
          }}
        />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <Avatar name={msg.displayName} seed={msg.pubkey} size="sm" ring={tone.ring} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-base font-medium">{msg.displayName}</span>
            <span className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
              {shortPubkey(msg.pubkey)}
            </span>
          </div>
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: tone.color, borderColor: `${tone.color}80` }}
          >
            {tone.label}
          </span>
        </div>
        <div className="relative whitespace-pre-wrap break-words border-t border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]/40 px-5 py-3 text-base leading-relaxed">
          {msg.text}
        </div>
      </div>
    </div>
  );
}

function Sparkle() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
