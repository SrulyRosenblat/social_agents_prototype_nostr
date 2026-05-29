import { useState } from 'react';
import { Lock, Send, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar } from '@/components/Avatar';
import type { DmGateRequest } from '@/lib/gate-bridge';
import { getLabel, type Label as LabelKind } from '@/label-store';
import { shortPubkey } from '@/keys';

const labelVariant = (l: LabelKind | undefined): 'safe' | 'destructive' | 'muted' =>
  l === 'trusted' ? 'safe' : l === 'malicious' ? 'destructive' : 'muted';

const labelRing = (l: LabelKind | undefined): 'safe' | 'destructive' | 'muted' =>
  l === 'trusted' ? 'safe' : l === 'malicious' ? 'destructive' : 'muted';

export function DmGate({ req }: { req: DmGateRequest }) {
  const safeWindow = Math.max(5, Math.min(90, req.proposedWindowSec));
  const safeExpiration = Math.max(60, Math.min(3600, req.proposedExpirationSec));
  const [content, setContent] = useState(req.proposedContent);
  const [windowSec, setWindowSec] = useState(safeWindow);
  const [expirationSec, setExpirationSec] = useState(safeExpiration);

  const cancel = () =>
    req.resolve({
      approved: false,
      recipients: req.recipients.map((r) => r.pubkey),
      content: req.proposedContent,
      listenWindowSec: safeWindow,
      expirationSec: safeExpiration,
    });

  const send = () => {
    const text = content.trim();
    if (!text) return;
    req.resolve({
      approved: true,
      recipients: req.recipients.map((r) => r.pubkey),
      content: text,
      listenWindowSec: Math.max(5, Math.min(90, windowSec || safeWindow)),
      expirationSec: Math.max(60, Math.min(3600, expirationSec || safeExpiration)),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && cancel()}>
      <DialogContent hideClose className="max-w-xl border-safe/40 shadow-safe/10">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-safe">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-safe/10">
              <Lock className="h-4 w-4" />
            </div>
            <span className="text-2xs font-semibold uppercase tracking-[0.14em]">
              Encrypted DM
            </span>
          </div>
          <DialogTitle>Agent wants to send a private DM</DialogTitle>
          <DialogDescription>
            Each recipient receives a separately encrypted copy. Review the content
            before it leaves your machine.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Recipients</Label>
            <Badge variant="secondary" className="font-mono text-2xs normal-case">
              {req.recipients.length}
            </Badge>
          </div>
          <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto thin-scrollbar">
            {req.recipients.map((r) => {
              const lbl = getLabel(r.pubkey);
              return (
                <li
                  key={r.pubkey}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-secondary/30 px-2.5 py-2"
                >
                  <Avatar
                    name={r.displayName || '?'}
                    seed={r.pubkey}
                    size="sm"
                    ring={labelRing(lbl)}
                  />
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {r.displayName || '(unknown)'}
                    </span>
                    <span className="truncate font-mono text-2xs text-muted-foreground">
                      {shortPubkey(r.pubkey)}
                    </span>
                  </div>
                  <Badge variant={labelVariant(lbl)} className="ml-auto shrink-0">
                    {lbl ?? 'unlabeled'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label>Message content (editable — encrypted before sending)</Label>
          <Textarea
            value={content}
            rows={5}
            onChange={(e) => setContent(e.target.value)}
            className="font-sans"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Listen for replies</Label>
            <NumberWithSuffix
              value={windowSec}
              onChange={setWindowSec}
              min={5}
              max={90}
              suffix="sec"
            />
          </div>
          <div className="space-y-1.5">
            <Label>DM expires in</Label>
            <NumberWithSuffix
              value={expirationSec}
              onChange={setExpirationSec}
              min={60}
              max={3600}
              suffix="sec"
            />
          </div>
        </div>

        <Alert variant="safe">
          <ShieldCheck />
          <AlertTitle>Encrypted (NIP-44 + NIP-59 gift wrap)</AlertTitle>
          <AlertDescription>
            Message body is end-to-end encrypted and your sender identity is hidden
            from relays. Still observable: your receiving pubkey (replies come to you),
            and anything recipients choose to log or repeat.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={cancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button variant="safe" onClick={send} disabled={!content.trim()}>
            <Send className="h-3.5 w-3.5" />
            Send DM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberWithSuffix({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="pr-12 font-mono"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-2xs uppercase tracking-wider text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
