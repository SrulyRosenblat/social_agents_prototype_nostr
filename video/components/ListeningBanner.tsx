import * as R from 'remotion';

interface ListeningBannerProps {
  startFrame: number;
  windowSec: number;
  audience: string;
}

const AUDIENCE_LABELS: Record<string, string> = {
  any: 'the open network',
  'shoe-seller': 'shoe sellers',
  'travel-agent': 'travel agents',
  'food-vendor': 'food vendors',
  'tech-vendor': 'tech vendors',
  'general-merchant': 'general merchants',
};

export function ListeningBanner({ startFrame, windowSec, audience }: ListeningBannerProps) {
  const frame = R.useCurrentFrame();
  const { fps } = R.useVideoConfig();
  const local = Math.max(0, frame - startFrame);
  const elapsedFakeSec = local / fps;
  // Squash the 5–90s windowSec to a stylized 8-second drain that fits demo pacing.
  const drainSpan = 8;
  const pct = Math.max(0, 1 - elapsedFakeSec / drainSpan);
  const fakeRemaining = Math.max(0, Math.ceil(windowSec * pct));
  const opacity = R.interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const y = R.interpolate(local, [0, 12], [12, 0], { extrapolateRight: 'clamp' });
  const label = AUDIENCE_LABELS[audience] ?? audience;
  // Stylized pulse: slowly oscillate
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin((local / fps) * 2));

  return (
    <div className="px-8 pt-4" style={{ opacity, transform: `translateY(${y}px)` }}>
      <div
        className="relative overflow-hidden rounded-2xl border bg-[hsl(var(--card))]/70 shadow-md"
        style={{ borderColor: 'hsl(var(--primary)/0.5)' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, hsl(var(--primary)/0.12) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-[3px]"
          style={{
            width: `${pct * 100}%`,
            background: 'hsl(var(--primary)/0.85)',
          }}
        />
        <div className="relative flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'hsl(var(--primary)/0.3)',
                  transform: `scale(${0.7 + 0.3 * pulse})`,
                  opacity: pulse,
                }}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative h-4 w-4"
                style={{ color: 'hsl(var(--primary))' }}
              >
                <path d="M4.9 19.1A10 10 0 0 1 4.9 4.9" />
                <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
                <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
              </svg>
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base">
                Listening to{' '}
                <span style={{ color: 'hsl(var(--primary))' }}>{label}</span>…
              </span>
              <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
                {fakeRemaining}s remaining
              </span>
            </div>
          </div>
          <div
            className="rounded-md border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'hsl(var(--destructive)/0.5)',
              color: 'hsl(var(--destructive))',
            }}
          >
            Stop
          </div>
        </div>
      </div>
    </div>
  );
}
