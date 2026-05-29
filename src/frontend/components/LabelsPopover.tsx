import { useState } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar } from '@/components/Avatar';
import { listLabeled, removeLabel, type Label } from '@/label-store';
import { shortPubkey } from '@/keys';

interface LabelsPopoverProps {
  onAfterChange: () => void;
}

const labelVariant = (label: Label): 'safe' | 'destructive' => {
  return label === 'trusted' ? 'safe' : 'destructive';
};

export function LabelsPopover({ onAfterChange }: LabelsPopoverProps) {
  const [, forceRerender] = useState(0);
  const entries = listLabeled();

  const handleRemove = (pubkey: string) => {
    removeLabel(pubkey);
    forceRerender((v) => v + 1);
    onAfterChange();
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pubkey labels
          </h3>
        </div>
        <span className="text-2xs text-muted-foreground">{entries.length}</span>
      </div>
      <Separator />
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50">
            <Tag className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground max-w-[14rem]">
            No labels yet. Label a sender from the inbound reply gate to trust or
            quarantine them.
          </p>
        </div>
      ) : (
        <ul className="thin-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto p-2">
          {entries.map((entry) => (
            <li
              key={entry.pubkey}
              className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
            >
              <Avatar
                name={entry.displayName}
                seed={entry.pubkey}
                size="sm"
                ring={entry.label === 'trusted' ? 'safe' : 'destructive'}
              />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-xs font-medium">{entry.displayName}</span>
                <span className="truncate font-mono text-2xs text-muted-foreground">
                  {shortPubkey(entry.pubkey)}
                </span>
              </div>
              <Badge variant={labelVariant(entry.label)} className="ml-auto shrink-0">
                {entry.label}
              </Badge>
              <Button
                size="icon-sm"
                variant="ghost"
                className="opacity-60 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemove(entry.pubkey)}
                aria-label={`Remove label for ${entry.displayName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
