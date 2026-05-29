import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STARTERS = [
  'Find me a good pair of running shoes under $150',
  'Ask Priya for her take on the billing scope cut',
  'Schedule a 30-minute design review with the team this week',
];

interface EmptyStateProps {
  disabled: boolean;
  onPickStarter: (q: string) => void;
}

export function EmptyState({ disabled, onPickStarter }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 via-primary/60 to-primary/20 shadow-xl shadow-primary/30">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-lg font-semibold tracking-tight">Your agent is ready.</h2>
        <p className="text-sm text-muted-foreground">
          Ask it anything. It will choose whether to answer directly, ping a trusted
          contact privately, or broadcast to the open Nostr vendor network — always with
          your explicit approval.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {STARTERS.map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            disabled={disabled}
            className="rounded-full text-xs font-normal text-muted-foreground hover:text-foreground"
            onClick={() => onPickStarter(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}
