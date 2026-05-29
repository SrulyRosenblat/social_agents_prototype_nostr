import { useState } from 'react';
import {
  ChevronRight,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  User,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/Avatar';
import { shortPubkey } from '@/keys';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/user-agent';

const VENDOR_TRUST = {
  trusted: {
    badgeVariant: 'safe' as const,
    icon: ShieldCheck,
    ring: 'safe' as const,
    border: 'border-safe/50',
    glow: 'bg-gradient-to-b from-safe/[0.06] to-transparent',
  },
  malicious: {
    badgeVariant: 'destructive' as const,
    icon: ShieldAlert,
    ring: 'destructive' as const,
    border: 'border-destructive/60 border-l-[3px]',
    glow: 'bg-gradient-to-b from-destructive/[0.08] to-transparent',
  },
  unlabeled: {
    badgeVariant: 'muted' as const,
    icon: ShieldQuestion,
    ring: 'muted' as const,
    border: 'border-border border-l-[3px] border-l-dashed border-l-muted-foreground/40',
    glow: '',
  },
};

function preview(text: string): string {
  if (text.length <= 80) return text.replace(/\s+/g, ' ');
  return `${text.slice(0, 80).replace(/\s+/g, ' ')}…`;
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[78%] items-end gap-2">
          <div className="rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm whitespace-pre-wrap break-words">
            {msg.text}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === 'agent') {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[80%] items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary/30 text-primary-foreground shadow-md shadow-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.14em] text-primary/90">
              Your agent
            </div>
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {msg.text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === 'system') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-border/60 bg-secondary/30 px-3 py-1 text-2xs uppercase tracking-wider text-muted-foreground">
          {msg.text}
        </div>
      </div>
    );
  }

  // vendor
  return <VendorBubble msg={msg} />;
}

function VendorBubble({
  msg,
}: {
  msg: Extract<ChatMessage, { kind: 'vendor' }>;
}) {
  const [open, setOpen] = useState(false);
  const labelKey: keyof typeof VENDOR_TRUST =
    msg.label === 'trusted'
      ? 'trusted'
      : msg.label === 'malicious'
        ? 'malicious'
        : 'unlabeled';
  const trust = VENDOR_TRUST[labelKey];
  const Icon = trust.icon;

  return (
    <div className="flex justify-start pl-8 sm:pl-10">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn(
          'relative max-w-[88%] overflow-hidden rounded-xl border bg-card shadow-sm transition-colors',
          trust.border,
        )}
      >
        {trust.glow && (
          <div
            aria-hidden="true"
            className={cn('pointer-events-none absolute inset-x-0 top-0 h-12', trust.glow)}
          />
        )}
        <CollapsibleTrigger
          className={cn(
            'group relative z-10 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]',
          )}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-90',
            )}
          />
          <Avatar name={msg.displayName} seed={msg.pubkey} size="sm" ring={trust.ring} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium">{msg.displayName}</span>
            <span className="hidden truncate font-mono text-2xs text-muted-foreground sm:inline">
              {shortPubkey(msg.pubkey)}
            </span>
          </div>
          <Badge variant={trust.badgeVariant} className="hidden shrink-0 sm:inline-flex">
            <Icon className="h-3 w-3" />
            {msg.label ?? 'unlabeled'}
          </Badge>
          {!open && (
            <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[20rem]">
              {preview(msg.text)}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="relative z-10 whitespace-pre-wrap break-words border-t border-border/60 bg-background/30 px-4 py-3 text-sm leading-relaxed text-foreground">
            {msg.text}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Kept for future "summary" message kind if user-agent re-introduces it.
export function SummaryBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-stretch">
      <div className="w-full rounded-xl border border-primary/40 bg-gradient-to-b from-primary/[0.08] to-transparent p-4 shadow-sm">
        <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.14em] text-primary">
          <ScrollText className="h-3 w-3" />
          Summary
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
