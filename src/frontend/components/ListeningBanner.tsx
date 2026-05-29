import { useEffect, useState } from 'react';
import { Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ListeningState } from '@/user-agent';

interface ListeningBannerProps {
  state: ListeningState;
}

const AUDIENCE_LABELS: Record<string, string> = {
  any: 'the open network',
  'shoe-seller': 'shoe sellers',
  'travel-agent': 'travel agents',
  'food-vendor': 'food vendors',
  'tech-vendor': 'tech vendors',
  'general-merchant': 'general merchants',
};

export function ListeningBanner({ state }: ListeningBannerProps) {
  const [remaining, setRemaining] = useState(state.windowSec);

  useEffect(() => {
    setRemaining(state.windowSec);
    const iv = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [state.windowSec, state]);

  const label = AUDIENCE_LABELS[state.audience] ?? state.audience;
  const pct = Math.max(0, Math.min(1, remaining / Math.max(1, state.windowSec)));

  return (
    <div className="px-4 pt-3 sm:px-6">
      <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-card/70 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 bg-primary/70 transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct * 100}%` }}
        />
        <div className="relative flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-soft-pulse" />
              <Radio className="relative h-3.5 w-3.5 text-primary" />
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="truncate text-sm font-medium">
                Listening to <span className="text-primary">{label}</span>…
              </span>
              <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                {remaining}s remaining
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => state.cancel()}
            className={cn(
              'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <X className="h-3.5 w-3.5" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
