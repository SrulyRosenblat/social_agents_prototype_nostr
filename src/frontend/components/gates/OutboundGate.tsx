import { useMemo, useState } from 'react';
import { Radio, RadioTower, Send, X } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { OutboundGateRequest } from '@/lib/gate-bridge';
import { AUDIENCES } from '../../../shared/nip90';
import { categoryTag, DEFAULT_RELAYS, TOPIC_ROOT } from '../../../shared/topics';
import { shortPubkey } from '@/keys';
import type { Audience } from '@/mcp-client';

const ALLOWED_CATEGORIES = ['shoes', 'travel', 'food', 'tech', 'general'] as const;
const ALLOWED_AUDIENCES = AUDIENCES;
const AUDIENCE_LABEL: Record<Audience, string> = {
  any: 'everyone',
  'shoe-seller': 'shoe sellers',
  'travel-agent': 'travel agents',
  'food-vendor': 'food vendors',
  'tech-vendor': 'tech vendors',
  'general-merchant': 'general merchants',
};

export function OutboundGate({ req }: { req: OutboundGateRequest }) {
  const safeCategory = useMemo(
    () =>
      (ALLOWED_CATEGORIES as readonly string[]).includes(req.proposedCategory)
        ? req.proposedCategory
        : 'general',
    [req.proposedCategory],
  );
  const safeAudience: Audience = useMemo(
    () =>
      (ALLOWED_AUDIENCES as readonly string[]).includes(req.proposedAudience)
        ? req.proposedAudience
        : 'any',
    [req.proposedAudience],
  );
  const safeWindow = Math.max(5, Math.min(90, req.proposedWindowSec));
  const safeExpiration = Math.max(60, Math.min(3600, req.proposedExpirationSec));

  const [question, setQuestion] = useState(req.proposedQuestion);
  const [category, setCategory] = useState(safeCategory);
  const [audience, setAudience] = useState<Audience>(safeAudience);
  const [windowSec, setWindowSec] = useState(safeWindow);
  const [expirationSec, setExpirationSec] = useState(safeExpiration);

  const onCancel = () =>
    req.resolve({
      approved: false,
      question: req.proposedQuestion,
      category: safeCategory,
      audience: safeAudience,
      listenWindowSec: safeWindow,
      expirationSec: safeExpiration,
    });

  const onBroadcast = () => {
    const q = question.trim();
    if (!q) return;
    req.resolve({
      approved: true,
      question: q,
      category,
      audience,
      listenWindowSec: Math.max(5, Math.min(90, windowSec || 30)),
      expirationSec: Math.max(60, Math.min(3600, expirationSec || safeExpiration)),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        hideClose
        className="max-w-xl border-destructive/40 shadow-destructive/10"
      >
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-destructive">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <RadioTower className="h-4 w-4" />
            </div>
            <span className="text-2xs font-semibold uppercase tracking-[0.14em]">
              Public broadcast
            </span>
          </div>
          <DialogTitle>Agent wants to broadcast a public question</DialogTitle>
          <DialogDescription>
            Review and edit before it leaves your machine. Your pubkey will be visible
            with the broadcast.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <Field label="Your message (kept local, not broadcast)">
          <ReadonlyBlock>{req.userInput}</ReadonlyBlock>
        </Field>

        <Field label="Broadcast question (editable)">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={200}
            className="font-sans"
          />
          <div className="mt-1 text-right text-2xs text-muted-foreground tabular-nums">
            {question.length}/200
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Audience">
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Listen for replies">
            <NumberWithSuffix
              value={windowSec}
              onChange={setWindowSec}
              min={5}
              max={90}
              suffix="sec"
            />
          </Field>
          <Field label="Expires in">
            <NumberWithSuffix
              value={expirationSec}
              onChange={setExpirationSec}
              min={60}
              max={3600}
              suffix="sec"
            />
          </Field>
        </div>

        <Field label="Tags & relays">
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 p-2.5 text-xs">
            <div className="flex flex-wrap gap-1">
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-2xs">
                #t: {TOPIC_ROOT}
              </code>
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-2xs">
                #t: {categoryTag(category)}
              </code>
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-2xs">
                #audience: {audience}
              </code>
            </div>
            <Separator className="my-1" />
            <span className="text-2xs text-muted-foreground">
              Relays:{' '}
              <span className="font-mono">{DEFAULT_RELAYS.join(', ')}</span>
            </span>
            <span className="text-2xs text-muted-foreground">
              Your pubkey:{' '}
              <span className="font-mono">{shortPubkey(req.userPubkey)}</span>
            </span>
          </div>
        </Field>

        <Alert variant="destructive">
          <Radio />
          <AlertTitle>Public</AlertTitle>
          <AlertDescription>
            Question, tags, your pubkey, and replies are all visible on the relays.
            Audience filtering is an honor-system hint — non-targeted agents can still
            see the event; they just opt out of responding.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onBroadcast}
            disabled={!question.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40"
          >
            <Send className="h-3.5 w-3.5" />
            Broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReadonlyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </div>
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
