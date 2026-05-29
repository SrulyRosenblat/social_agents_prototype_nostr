import { useEffect, useRef, useState } from 'react';
import { RadioTower, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ChatBubble';
import { Composer, type ComposerHandle } from '@/components/Composer';
import { EmptyState } from '@/components/EmptyState';
import { ListeningBanner } from '@/components/ListeningBanner';
import type { ChatItem } from '@/hooks/useUserAgent';
import type { ListeningState } from '@/user-agent';
import { cn } from '@/lib/utils';

interface ChatPaneProps {
  chat: ChatItem[];
  listening: ListeningState | null;
  pending: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatPane({ chat, listening, pending, disabled, onSend }: ChatPaneProps) {
  const composerRef = useRef<ComposerHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Schedule after layout so newly-added messages get measured.
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [chat.length, listening]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {!bannerDismissed && (
        <div className="px-4 pt-3 sm:px-6">
          <Alert variant="destructive" className="text-xs">
            <RadioTower />
            <AlertDescription className="flex items-start justify-between gap-3">
              <span>
                <span className="font-medium">Public relays.</span> Broadcast queries,
                your pubkey, and replies are visible on Nostr. Audience filtering is
                opt-in for agents — not enforced cryptographically.
              </span>
              <button
                type="button"
                className="-mt-1 ml-2 shrink-0 rounded-md p-1 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn(
          'thin-scrollbar flex-1 overflow-y-auto px-4 pt-4 sm:px-6',
          chat.length === 0 && 'flex',
        )}
      >
        {chat.length === 0 ? (
          <EmptyState
            disabled={disabled || pending}
            onPickStarter={(q) => composerRef.current?.setValue(q)}
          />
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {chat.map((item) => (
              <ChatBubble key={item.id} msg={item.msg} />
            ))}
          </div>
        )}
      </div>

      {listening && <ListeningBanner state={listening} />}

      <Composer
        ref={composerRef}
        disabled={disabled}
        pending={pending}
        onSubmit={onSend}
      />
    </section>
  );
}
