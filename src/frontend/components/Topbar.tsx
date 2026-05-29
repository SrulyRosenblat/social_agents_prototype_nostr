import { useState } from 'react';
import { Sparkles, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelsPopover } from '@/components/LabelsPopover';
import { RenderDemoButton } from '@/components/RenderDemoButton';
import { shortPubkey } from '@/keys';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/hooks/useUserAgent';

interface TopbarProps {
  status: ConnectionStatus;
  userPubkey: string | null;
  labelsVersion: number;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'connecting…',
  ready: 'connected',
  offline: 'offline',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-warn animate-soft-pulse',
  ready: 'bg-safe',
  offline: 'bg-destructive',
};

export function Topbar({ status, userPubkey, labelsVersion }: TopbarProps) {
  const [labelsOpen, setLabelsOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/90 via-primary/60 to-primary/30 shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-semibold tracking-tight">agent</span>
          <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
            nostr · prototype
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/40 py-1 pl-2.5 pr-3 text-xs sm:flex">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
              <span className="text-muted-foreground capitalize">{STATUS_LABEL[status]}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Backend connection status</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="font-mono text-2xs normal-case tracking-normal">
              {userPubkey ? shortPubkey(userPubkey) : '(no key)'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Your nostr pubkey</TooltipContent>
        </Tooltip>

        <RenderDemoButton />

        <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Labels</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
            <LabelsPopover key={labelsVersion} onAfterChange={() => {}} />
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
