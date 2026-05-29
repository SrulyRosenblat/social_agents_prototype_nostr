import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CircleDashed,
  CircleDot,
  Slash,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogEntry as LogEntryType } from '@/hooks/useUserAgent';

const LEVEL_META: Record<
  LogEntryType['level'],
  { icon: LucideIcon; tone: string; border: string }
> = {
  out: {
    icon: ArrowUpRight,
    tone: 'text-primary',
    border: 'border-l-primary',
  },
  in: {
    icon: ArrowDownLeft,
    tone: 'text-safe',
    border: 'border-l-safe',
  },
  skip: {
    icon: Slash,
    tone: 'text-muted-foreground',
    border: 'border-l-destructive/70',
  },
  decline: {
    icon: CircleDashed,
    tone: 'text-muted-foreground/90',
    border: 'border-l-muted-foreground/40',
  },
  warn: {
    icon: AlertTriangle,
    tone: 'text-warn',
    border: 'border-l-warn',
  },
  system: {
    icon: CircleDot,
    tone: 'text-muted-foreground',
    border: 'border-l-border',
  },
  info: {
    icon: CircleDot,
    tone: 'text-muted-foreground',
    border: 'border-l-border',
  },
};

export function LogEntryRow({ entry }: { entry: LogEntryType }) {
  const meta = LEVEL_META[entry.level] ?? LEVEL_META.system;
  const Icon = meta.icon;
  const ts = entry.ts.toLocaleTimeString([], { hour12: false });

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border-l-2 bg-secondary/30 px-2.5 py-2 text-xs',
        meta.border,
      )}
    >
      <Icon className={cn('mt-0.5 h-3 w-3 shrink-0', meta.tone)} />
      <span className="mt-px shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
        {ts}
      </span>
      <span className="break-words text-foreground/90 leading-snug">{entry.message}</span>
    </div>
  );
}
