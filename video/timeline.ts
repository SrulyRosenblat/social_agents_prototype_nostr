import type { DemoEvent, FlowProps } from './types';

export interface PlacedEvent {
  event: DemoEvent;
  /** Absolute video frame when this event "fires". */
  frame: number;
}

const INTRO_FRAMES = 60;
const OUTRO_FRAMES = 75;
const MIN_BEAT = 60;
const MAX_BEAT = 180;

export function buildTimeline(props: FlowProps): {
  placed: PlacedEvent[];
  totalFrames: number;
} {
  const placed: PlacedEvent[] = [];
  let frame = INTRO_FRAMES;
  for (const ev of props.events) {
    const beat = beatForEvent(ev, props.beatFrames);
    placed.push({ event: ev, frame });
    frame += beat;
  }
  return { placed, totalFrames: frame + OUTRO_FRAMES };
}

function beatForEvent(ev: DemoEvent, base: number): number {
  // Events that introduce a major scene change (gates, listening) deserve a
  // longer beat so the viewer can actually read the modal. Log entries and
  // listening-stop are quick.
  const factor =
    ev.kind === 'gate-open' ? 1.6 :
    ev.kind === 'gate-decision' ? 0.6 :
    ev.kind === 'listening-start' ? 1.1 :
    ev.kind === 'listening-stop' ? 0.5 :
    ev.kind === 'log' ? 0.4 :
    ev.kind === 'decline' ? 1.2 :
    ev.kind === 'chat' ?
      (ev.message.kind === 'system' ? 0.5 :
       ev.message.kind === 'user' ? 1.1 :
       ev.message.kind === 'agent' ? 1.5 :
       1.0)
    : 1;
  return clamp(Math.round(base * factor), MIN_BEAT, MAX_BEAT);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Derive scene state at a given frame by reducing over placed events that
 * have fired up to (and including) that frame.
 */
export function sceneAt(placed: PlacedEvent[], frame: number) {
  const fired = placed.filter((p) => p.frame <= frame);

  const chat: { event: PlacedEvent; message: Extract<DemoEvent, { kind: 'chat' }>['message'] }[] = [];
  const logs: { event: PlacedEvent; level: string; message: string }[] = [];
  const declines: {
    event: PlacedEvent;
    vendorName: string;
    vendorPubkey: string;
    reason: string;
  }[] = [];
  let composerText: string | null = null;
  let listening: { startFrame: number; windowSec: number; audience: string } | null = null;
  let activeGate:
    | {
        gate: 'outbound' | 'inbound' | 'dm';
        summary: any;
        openFrame: number;
        closeFrame: number | null;
        decision: string | null;
      }
    | null = null;

  for (const p of fired) {
    const e = p.event;
    if (e.kind === 'chat') {
      chat.push({ event: p, message: e.message });
      if (e.message.kind === 'user') {
        composerText = null;
      }
    } else if (e.kind === 'log') {
      logs.push({ event: p, level: e.level, message: e.message });
    } else if (e.kind === 'listening-start') {
      listening = { startFrame: p.frame, windowSec: e.windowSec, audience: e.audience };
    } else if (e.kind === 'listening-stop') {
      listening = null;
    } else if (e.kind === 'gate-open') {
      activeGate = {
        gate: e.gate,
        summary: e.summary,
        openFrame: p.frame,
        closeFrame: null,
        decision: null,
      };
    } else if (e.kind === 'gate-decision') {
      if (activeGate) {
        activeGate.closeFrame = p.frame;
        activeGate.decision = e.decision;
      }
    } else if (e.kind === 'decline') {
      declines.push({
        event: p,
        vendorName: e.vendorName,
        vendorPubkey: e.vendorPubkey,
        reason: e.reason,
      });
    }
  }

  // Clear the modal a few frames after the decision fires so the viewer sees
  // the "approved" highlight before it disappears.
  if (activeGate && activeGate.closeFrame !== null && frame > activeGate.closeFrame + 30) {
    activeGate = null;
  }

  return {
    chat,
    logs: logs.slice().reverse(),
    composerText,
    listening,
    activeGate,
    declines,
  };
}
