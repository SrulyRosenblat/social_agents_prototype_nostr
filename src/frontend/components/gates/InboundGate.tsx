import { Check, MessageSquareDot, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/form-label';
import { Separator } from '@/components/ui/separator';
import { shortPubkey } from '@/keys';
import type { InboundGateRequest } from '@/lib/gate-bridge';

const CLAIMED_LABEL: Record<string, string> = {
  friend: 'claims: friend',
  'shoe-seller': 'claims: shoe-seller',
  teammate: 'claims: teammate',
  unknown: 'no claim',
};

export function InboundGate({ req }: { req: InboundGateRequest }) {
  const displayName = req.profile.name ?? '(no profile name)';

  return (
    <Dialog open onOpenChange={(o) => !o && req.resolve({ action: 'skip' })}>
      <DialogContent hideClose className="max-w-xl border-safe/40 shadow-safe/10">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 text-safe">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-safe/10">
                  <MessageSquareDot className="h-4 w-4" />
                </div>
                <span className="text-2xs font-semibold uppercase tracking-[0.14em]">
                  Reply received
                </span>
              </div>
              <DialogTitle>Decide what to do with this reply</DialogTitle>
              <DialogDescription>
                The sender's display name and claimed role are not verified. Only the
                pubkey is cryptographic identity.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                req.resolve({ action: 'label-and-skip', label: 'malicious' })
              }
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Mark malicious
            </Button>
          </div>
        </DialogHeader>

        <Separator />

        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-3">
          <Avatar name={displayName} seed={req.reply.vendorPubkey} size="lg" ring="muted" />
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-sm font-medium">{displayName}</span>
              <Badge variant="muted" className="shrink-0">
                {CLAIMED_LABEL[req.claimedType] ?? 'no claim'}
              </Badge>
            </div>
            <span className="truncate font-mono text-2xs text-muted-foreground">
              {shortPubkey(req.reply.vendorPubkey)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Reply content (plain text)</Label>
          <div className="thin-scrollbar max-h-72 overflow-y-auto rounded-md border border-border bg-secondary/30 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {req.reply.text}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => req.resolve({ action: 'skip' })}>
            <X className="h-3.5 w-3.5" />
            Skip
          </Button>
          <Button
            variant="secondary"
            onClick={() => req.resolve({ action: 'include' })}
          >
            <Check className="h-3.5 w-3.5" />
            Include once
          </Button>
          <Button
            variant="safe"
            onClick={() =>
              req.resolve({ action: 'label-and-include', label: 'trusted' })
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust &amp; include
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
