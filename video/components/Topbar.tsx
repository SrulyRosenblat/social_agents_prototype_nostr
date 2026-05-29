interface TopbarProps {
  userPubkey: string;
}

export function Topbar({ userPubkey }: TopbarProps) {
  return (
    <header className="flex h-20 items-center justify-between gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-8">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl shadow-xl shadow-[hsl(var(--primary))]/25"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.6) 50%, hsl(var(--primary)/0.25) 100%)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-semibold tracking-tight">agent</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            nostr · prototype
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 py-1.5 pl-3 pr-4 text-sm">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--safe))]" />
          <span className="text-[hsl(var(--muted-foreground))]">Connected</span>
        </div>
        <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--foreground))]/90">
          {userPubkey}
        </span>
        <span className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          Labels
        </span>
      </div>
    </header>
  );
}
