interface ComposerProps {
  pending: boolean;
  text: string | null;
}

export function Composer({ pending, text }: ComposerProps) {
  const placeholder = 'Tell your agent what you want…';
  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-8 py-5">
      <div
        className="flex items-end gap-3 rounded-2xl border border-[hsl(var(--border))] p-2 shadow-md"
        style={{ background: 'hsl(var(--secondary) / 0.3)' }}
      >
        <div className="min-h-[48px] flex-1 px-3 py-3 text-base leading-relaxed">
          {text ? (
            <span className="whitespace-pre-wrap">{text}</span>
          ) : (
            <span className="text-[hsl(var(--muted-foreground))]/60">{placeholder}</span>
          )}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-[hsl(var(--primary))]/25"
          style={{ background: 'hsl(var(--primary))', opacity: pending ? 0.7 : 1 }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
          </svg>
        </div>
      </div>
      <div className="mt-2 px-1 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 px-1.5 py-0.5 font-mono">
          ↵
        </span>{' '}
        to send ·{' '}
        <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 px-1.5 py-0.5 font-mono">
          ⇧↵
        </span>{' '}
        for a newline
      </div>
    </div>
  );
}
