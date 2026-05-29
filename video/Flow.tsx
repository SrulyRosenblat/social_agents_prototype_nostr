import { useLayoutEffect, useRef } from 'react';
import * as R from 'remotion';
import './globals.css';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { Bubble } from './components/Bubble';
import { Composer } from './components/Composer';
import { ListeningBanner } from './components/ListeningBanner';
import { GateModal } from './components/GateModal';
import { DeclineRail } from './components/DeclineRail';
import { buildTimeline, sceneAt } from './timeline';
import type { FlowProps } from './types';

export function Flow(props: FlowProps) {
  const { placed } = buildTimeline(props);
  const frame = R.useCurrentFrame();
  const scene = sceneAt(placed, frame);

  return (
    <R.AbsoluteFill style={{ background: 'hsl(var(--background))' }}>
      <div className="flex h-full flex-col">
        <Topbar userPubkey="d860998e0e87…910e01" />
        <main
          className={
            scene.declines.length > 0
              ? 'grid min-h-0 flex-1 grid-cols-[320px_1fr_420px]'
              : 'grid min-h-0 flex-1 grid-cols-[1fr_420px]'
          }
        >
          {scene.declines.length > 0 && (
            <DeclineRail
              declines={scene.declines.map((d) => ({
                enterFrame: d.event.frame,
                vendorName: d.vendorName,
                vendorPubkey: d.vendorPubkey,
                reason: d.reason,
              }))}
            />
          )}
          <section className="flex min-h-0 flex-col">
            <ChatViewport empty={scene.chat.length === 0}>
              {scene.chat.map((c, i) => (
                <Bubble key={i} msg={c.message} enterFrame={c.event.frame} />
              ))}
            </ChatViewport>
            {scene.listening && (
              <ListeningBanner
                startFrame={scene.listening.startFrame}
                windowSec={scene.listening.windowSec}
                audience={scene.listening.audience}
              />
            )}
            <Composer pending={!!scene.listening} text={scene.composerText} />
          </section>
          <Sidebar
            logs={scene.logs.map((l) => ({
              enterFrame: l.event.frame,
              level: l.level,
              message: l.message,
            }))}
          />
        </main>
      </div>

      {scene.activeGate && (
        <GateModal
          gate={scene.activeGate.gate}
          summary={scene.activeGate.summary}
          openFrame={scene.activeGate.openFrame}
          closeFrame={scene.activeGate.closeFrame}
          decision={scene.activeGate.decision}
        />
      )}
    </R.AbsoluteFill>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        Ready
      </div>
      <div className="text-xl">Your agent is ready.</div>
    </div>
  );
}

/**
 * Remotion renders each frame as an independent React tree — there's no real
 * scroll state. To keep the latest chat message in view we measure the inner
 * content height in useLayoutEffect (which fires after DOM commit but before
 * paint) and translate the content up so its bottom sits at the viewport
 * bottom. This snap-scrolls each frame deterministically.
 */
function ChatViewport({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const overflow = Math.max(0, ct.scrollHeight - vp.clientHeight);
    ct.style.transform = `translateY(${-overflow}px)`;
  });

  return (
    <div ref={viewportRef} className="flex-1 overflow-hidden px-8 pt-6">
      <div ref={contentRef} className="flex flex-col gap-4 pb-4">
        {empty ? <EmptyState /> : children}
      </div>
    </div>
  );
}
