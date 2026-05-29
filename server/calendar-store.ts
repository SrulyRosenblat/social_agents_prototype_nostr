// In-memory per-pubkey calendar used by the teammate agents.
// Backs the `check_availability` and `book_slot` MCP tools. State is process-
// local and resets when the server restarts — that's the "dummy" in "dummy
// calendar MCP". Seeded with realistic-feeling busy slots this week so the
// teammate LLMs hit real conflicts when the user proposes meeting times.

import { randomUUID } from 'node:crypto';

export interface CalendarEvent {
  id: string;
  /** Inclusive start, ISO 8601 local time (no tz). */
  startIso: string;
  /** Exclusive end, ISO 8601 local time. */
  endIso: string;
  title: string;
}

interface InternalEvent {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
}

const calendars = new Map<string, InternalEvent[]>();

// ─── ISO helpers (local time, no timezone suffix) ───────────────────────────
// We keep ISO strings without a tz designator so the LLM sees "2026-05-28T15:00"
// and reasons in the user's local timezone. Internally we convert to ms via
// Date.parse on an ISO that we construct from local-time components.

function toLocalIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function fromLocalIso(iso: string): number | null {
  // Parse "YYYY-MM-DDTHH:mm[:ss]" as local time. Date.parse() of a string
  // without a tz suffix is implementation-defined; we hand-parse to be safe.
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(iso.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  return date.getTime();
}

function toEvent(e: InternalEvent): CalendarEvent {
  return {
    id: e.id,
    startIso: toLocalIso(e.startMs),
    endIso: toLocalIso(e.endMs),
    title: e.title,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function checkAvailability(
  pubkey: string,
  startIso: string,
  endIso: string,
): { ok: true; conflicts: CalendarEvent[] } | { ok: false; error: string } {
  const startMs = fromLocalIso(startIso);
  const endMs = fromLocalIso(endIso);
  if (startMs === null || endMs === null) {
    return { ok: false, error: 'start_iso and end_iso must be ISO 8601 strings (e.g. "2026-05-28T15:00:00")' };
  }
  if (endMs <= startMs) {
    return { ok: false, error: 'end_iso must be after start_iso' };
  }
  const events = calendars.get(pubkey) ?? [];
  const conflicts = events
    .filter((e) => e.startMs < endMs && e.endMs > startMs)
    .map(toEvent);
  return { ok: true, conflicts };
}

export function bookSlot(
  pubkey: string,
  startIso: string,
  durationMinutes: number,
  title: string,
):
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string; conflicts?: CalendarEvent[] } {
  const startMs = fromLocalIso(startIso);
  if (startMs === null) {
    return { ok: false, error: 'start_iso must be an ISO 8601 string (e.g. "2026-05-28T15:00:00")' };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 480) {
    return { ok: false, error: 'duration_minutes must be a positive number ≤ 480' };
  }
  const trimmedTitle = String(title ?? '').trim();
  if (!trimmedTitle) {
    return { ok: false, error: 'title must be a non-empty string' };
  }
  const endMs = startMs + durationMinutes * 60_000;
  const events = calendars.get(pubkey) ?? [];
  const conflicts = events
    .filter((e) => e.startMs < endMs && e.endMs > startMs)
    .map(toEvent);
  if (conflicts.length > 0) {
    return { ok: false, error: 'conflict', conflicts };
  }
  const newEvent: InternalEvent = {
    id: randomUUID(),
    startMs,
    endMs,
    title: trimmedTitle,
  };
  events.push(newEvent);
  calendars.set(pubkey, events);
  return { ok: true, event: toEvent(newEvent) };
}

export function listEvents(pubkey: string): CalendarEvent[] {
  return (calendars.get(pubkey) ?? []).map(toEvent);
}

// ─── Seeding ────────────────────────────────────────────────────────────────

interface SeedBlock {
  /** 1 = Monday, 2 = Tuesday, ..., 5 = Friday. */
  weekday: 1 | 2 | 3 | 4 | 5;
  /** Local-time start "HH:mm". */
  start: string;
  /** Local-time end "HH:mm". */
  end: string;
  title: string;
}

function startOfThisWorkWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 Sun..6 Sat
  // Roll back to Monday this week.
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0);
  return monday;
}

function timeFromHHMM(base: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0);
}

const SEED_BY_NAME: Record<string, SeedBlock[]> = {
  priya: [
    { weekday: 1, start: '09:00', end: '09:15', title: 'eng standup' },
    { weekday: 2, start: '09:00', end: '09:15', title: 'eng standup' },
    { weekday: 3, start: '09:00', end: '09:15', title: 'eng standup' },
    { weekday: 4, start: '09:00', end: '09:15', title: 'eng standup' },
    { weekday: 5, start: '09:00', end: '09:15', title: 'eng standup' },
    { weekday: 2, start: '10:00', end: '11:00', title: 'roadmap review (PM team)' },
    { weekday: 3, start: '14:00', end: '15:00', title: 'Ironwood customer sync' },
    { weekday: 4, start: '11:00', end: '12:00', title: '1:1 with Marcus' },
  ],
  marcus: [
    { weekday: 1, start: '13:00', end: '15:00', title: 'leadership weekly' },
    { weekday: 3, start: '09:00', end: '12:00', title: 'interview loop (sr backend)' },
    { weekday: 4, start: '11:00', end: '12:00', title: '1:1 with Priya' },
    { weekday: 4, start: '14:00', end: '14:30', title: '1:1 with Jen' },
    { weekday: 4, start: '15:00', end: '15:30', title: '1:1 with Diego' },
    { weekday: 5, start: '14:00', end: '15:00', title: 'all-hands' },
  ],
  jen: [
    { weekday: 1, start: '09:00', end: '12:00', title: 'heads-down (no meetings)' },
    { weekday: 2, start: '10:00', end: '12:00', title: 'code review block' },
    { weekday: 3, start: '13:00', end: '14:30', title: 'billing migration planning' },
    { weekday: 4, start: '14:00', end: '14:30', title: '1:1 with Marcus' },
    { weekday: 5, start: '13:00', end: '17:00', title: 'heads-down (no meetings)' },
  ],
  diego: [
    { weekday: 2, start: '10:00', end: '11:00', title: 'Latticework all-hands' },
    { weekday: 3, start: '14:00', end: '16:00', title: 'design crit' },
    { weekday: 4, start: '00:00', end: '23:59', title: 'OOO — working from home (no meetings)' },
    { weekday: 4, start: '15:00', end: '15:30', title: '1:1 with Marcus' },
  ],
};

/**
 * Seed a teammate's calendar with this-work-week recurring blocks.
 * Idempotent per pubkey: clears any prior seed before writing.
 */
export function seedTeammateCalendar(pubkey: string, name: string): void {
  const blocks = SEED_BY_NAME[name];
  if (!blocks) return;
  const monday = startOfThisWorkWeek();
  const events: InternalEvent[] = blocks.map((b) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (b.weekday - 1));
    const startMs = timeFromHHMM(day, b.start).getTime();
    const endMs = timeFromHHMM(day, b.end).getTime();
    return { id: randomUUID(), startMs, endMs, title: b.title };
  });
  calendars.set(pubkey, events);
}

export function isKnownTeammate(name: string): boolean {
  return name in SEED_BY_NAME;
}

export function knownTeammateNames(): readonly string[] {
  return Object.keys(SEED_BY_NAME);
}
