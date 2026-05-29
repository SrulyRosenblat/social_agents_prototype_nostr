import { useMemo, useState } from 'react';
import { ListFilter, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LogEntryRow } from '@/components/LogEntry';
import type { LogEntry } from '@/hooks/useUserAgent';
import { cn } from '@/lib/utils';

type FilterValue = 'all' | 'out' | 'in' | 'skip' | 'warn' | 'decline';

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'out', label: 'Outbound' },
  { value: 'in', label: 'Inbound' },
  { value: 'skip', label: 'Skipped' },
  { value: 'decline', label: 'Declined' },
  { value: 'warn', label: 'Warnings' },
];

interface SidebarProps {
  log: LogEntry[];
  onClear: () => void;
  className?: string;
}

export function Sidebar({ log, onClear, className }: SidebarProps) {
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return log;
    return log.filter((e) => e.level === filter);
  }, [log, filter]);

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-l border-border bg-card/40',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <h2 className="truncate text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Permissions log
          </h2>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              disabled={log.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear log</TooltipContent>
        </Tooltip>
      </div>

      <div className="border-b border-border px-3 py-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <SelectTrigger className="h-8 text-xs">
            <div className="flex items-center gap-1.5">
              <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="thin-scrollbar flex flex-col gap-1 p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ShieldCheck className="h-5 w-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground max-w-[16rem]">
                Approvals, replies, and warnings stream here in real time.
              </p>
            </div>
          ) : (
            filtered.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
