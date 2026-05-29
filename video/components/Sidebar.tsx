import * as R from 'remotion';

interface SidebarLog {
  enterFrame: number;
  level: string;
  message: string;
}

interface SidebarProps {
  logs: SidebarLog[];
}

const LEVEL_TONE: Record<string, { border: string; tone: string; sym: string }> = {
  out: { border: 'hsl(var(--primary))', tone: 'hsl(var(--primary))', sym: '↗' },
  in: { border: 'hsl(var(--safe))', tone: 'hsl(var(--safe))', sym: '↙' },
  skip: { border: 'hsl(var(--destructive)/0.7)', tone: 'hsl(var(--muted-foreground))', sym: '×' },
  warn: { border: 'hsl(var(--warn))', tone: 'hsl(var(--warn))', sym: '!' },
  system: { border: 'hsl(var(--border))', tone: 'hsl(var(--muted-foreground))', sym: '·' },
  info: { border: 'hsl(var(--border))', tone: 'hsl(var(--muted-foreground))', sym: '·' },
};

export function Sidebar({ logs }: SidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]/40">
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-5 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          Permissions log
        </span>
        <span className="rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          {logs.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden p-4">
        {logs.length === 0 ? (
          <div className="px-2 pt-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Approvals, replies, and warnings stream here.
          </div>
        ) : (
          logs.slice(0, 14).map((l, i) => <LogRow key={i} log={l} />)
        )}
      </div>
    </aside>
  );
}

function LogRow({ log }: { log: SidebarLog }) {
  const frame = R.useCurrentFrame();
  const tone = LEVEL_TONE[log.level] ?? LEVEL_TONE.system;
  const local = Math.max(0, frame - log.enterFrame);
  const opacity = R.interpolate(local, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const x = R.interpolate(local, [0, 10], [10, 0], { extrapolateRight: 'clamp' });
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        background: 'hsl(var(--secondary) / 0.35)',
        borderLeft: `3px solid ${tone.border}`,
      }}
    >
      <span className="mt-0.5 font-mono text-sm" style={{ color: tone.tone }}>
        {tone.sym}
      </span>
      <span className="break-words leading-snug">{log.message}</span>
    </div>
  );
}
