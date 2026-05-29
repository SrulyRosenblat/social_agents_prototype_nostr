import { useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { demoRecorder } from '@/lib/demo-recorder';
import { useDemoRecorderSize } from '@/hooks/useDemoRecorder';

const BACKEND_URL = 'http://localhost:3000';

type State = 'idle' | 'rendering' | 'error';

export function RenderDemoButton() {
  const size = useDemoRecorderSize();
  const [state, setState] = useState<State>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);

  const onClick = async () => {
    const events = demoRecorder.getTimeline();
    if (events.length === 0) return;
    setState('rendering');
    setErrorText(null);
    try {
      const res = await fetch(`${BACKEND_URL}/demo/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`server ${res.status}: ${body.slice(0, 160)}`);
      }
      const data = (await res.json()) as { url: string; filename: string };
      // Open in a new tab — the server sets Content-Disposition: attachment
      // so the browser will download it directly.
      window.open(`${BACKEND_URL}${data.url}`, '_blank', 'noopener');
      setState('idle');
    } catch (err) {
      setState('error');
      setErrorText(String(err));
      // Auto-clear the error chip after a few seconds.
      setTimeout(() => {
        setState((s) => (s === 'error' ? 'idle' : s));
        setErrorText(null);
      }, 5000);
    }
  };

  const disabled = size === 0 || state === 'rendering';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className="gap-1.5"
        >
          {state === 'rendering' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Film className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {state === 'rendering' ? 'Rendering…' : 'Render demo'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {state === 'rendering'
          ? 'Bundling + rendering Remotion composition (this may take 30–90s on first call)'
          : state === 'error'
            ? errorText ?? 'Render failed — see server logs'
            : size === 0
              ? 'Send a message first — there’s nothing to replay'
              : `Replay the current flow (${size} event${size === 1 ? '' : 's'}) as an MP4`}
      </TooltipContent>
    </Tooltip>
  );
}
