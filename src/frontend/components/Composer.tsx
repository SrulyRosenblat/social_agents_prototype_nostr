import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComposerProps {
  disabled: boolean;
  pending: boolean;
  onSubmit: (text: string) => void;
}

export interface ComposerHandle {
  setValue(text: string): void;
  focus(): void;
}

const MAX_HEIGHT_PX = 180;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  ({ disabled, pending, onSubmit }, ref) => {
    const taRef = useRef<HTMLTextAreaElement>(null);

    const resize = () => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`;
    };

    useImperativeHandle(ref, () => ({
      setValue(text) {
        const ta = taRef.current;
        if (!ta) return;
        ta.value = text;
        resize();
        ta.focus();
      },
      focus() {
        taRef.current?.focus();
      },
    }));

    const submit = () => {
      const ta = taRef.current;
      if (!ta) return;
      const text = ta.value.trim();
      if (!text || disabled || pending) return;
      ta.value = '';
      resize();
      onSubmit(text);
    };

    return (
      <div className="border-t border-border bg-card/60 px-4 py-3 sm:px-6">
        <div
          className={cn(
            'group flex items-end gap-2 rounded-xl border border-border bg-secondary/30 p-1.5 shadow-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
            disabled && 'opacity-60',
          )}
        >
          <textarea
            ref={taRef}
            rows={1}
            disabled={disabled}
            placeholder="Tell your agent what you want…"
            onInput={resize}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="thin-scrollbar min-h-[36px] max-h-[180px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed"
          />
          <Button
            type="button"
            size="icon"
            disabled={disabled || pending}
            onClick={submit}
            aria-label="Send message"
            className="h-9 w-9 shrink-0 rounded-lg shadow-md shadow-primary/20"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-2xs text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-secondary/60 px-1 py-px font-mono">↵</kbd>{' '}
            to send ·{' '}
            <kbd className="rounded border border-border bg-secondary/60 px-1 py-px font-mono">⇧↵</kbd>{' '}
            for a newline
          </span>
          {pending && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              agent thinking…
            </span>
          )}
        </div>
      </div>
    );
  },
);
Composer.displayName = 'Composer';
