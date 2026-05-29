import * as R from 'remotion';
import { Avatar } from './Avatar';
import { shortPubkey } from '../avatar';

interface DeclineEntry {
  enterFrame: number;
  vendorName: string;
  vendorPubkey: string;
  reason: string;
}

interface DeclineRailProps {
  declines: DeclineEntry[];
}

export function DeclineRail({ declines }: DeclineRailProps) {
  const frame = R.useCurrentFrame();
  const fadeIn = R.interpolate(
    frame - (declines[0]?.enterFrame ?? 0),
    [-15, 0, 12],
    [0, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (declines.length === 0) return null;

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-3 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]/30 p-5"
      style={{ opacity: fadeIn }}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <CircleDashedIcon />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Declined to answer
          </span>
        </div>
        <span className="rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
          {declines.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden">
        {declines.slice(-6).map((d) => (
          <DeclineCard key={d.vendorPubkey + ':' + d.enterFrame} entry={d} />
        ))}
      </div>
    </aside>
  );
}

function DeclineCard({ entry }: { entry: DeclineEntry }) {
  const frame = R.useCurrentFrame();
  const { fps } = R.useVideoConfig();
  const local = Math.max(0, frame - entry.enterFrame);
  const s = R.spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });
  const opacity = R.interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const x = R.interpolate(s, [0, 1], [-24, 0]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-dashed border-[hsl(var(--muted-foreground))]/40 bg-[hsl(var(--card))]/85 px-3 py-2.5 shadow-md backdrop-blur"
      style={{ opacity, transform: `translateX(${x}px)` }}
    >
      <div className="flex items-center gap-2.5">
        <Avatar
          name={entry.vendorName}
          seed={entry.vendorPubkey}
          size="sm"
          ring="muted"
        />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-[hsl(var(--foreground))]/90">
            {entry.vendorName}
          </span>
          <span className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
            {shortPubkey(entry.vendorPubkey)}
          </span>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-[hsl(var(--muted-foreground))]/40 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          declined
        </span>
      </div>
      {entry.reason ? (
        <div className="mt-2 text-xs italic leading-snug text-[hsl(var(--muted-foreground))]">
          “{entry.reason}”
        </div>
      ) : (
        <div className="mt-2 text-xs italic text-[hsl(var(--muted-foreground))]/70">
          (no reason given)
        </div>
      )}
    </div>
  );
}

function CircleDashedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="2 3"
      className="h-3 w-3 text-[hsl(var(--muted-foreground))]"
    >
      <circle cx={12} cy={12} r={9} />
    </svg>
  );
}
