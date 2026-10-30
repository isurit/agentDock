import type { Event } from './index.ts';
// Group transient chunks per run/item; completed messages replace their own chunks only.
export function timelineEvents(events: Event[]): Event[] {
  const key = (event: Event) => `${event.runId ?? ''}:${String(event.data.itemId ?? event.seq)}`;
  const completed = new Set(events.filter(e => e.type === 'message').map(key));
  const grouped = new Map<string, Event>(); const result: Event[] = [];
  for (const event of events) {
    if (event.type !== 'message.delta') { result.push(event); continue; }
    const id = key(event); if (completed.has(id)) continue;
    const previous = grouped.get(id);
    if (previous) previous.data.text = String(previous.data.text ?? '') + String(event.data.text ?? '');
    else { const value = { ...event, data: { ...event.data } }; grouped.set(id, value); result.push(value); }
  }
  return result;
}
// Only one refresh runs at a time. Bursts coalesce to the latest requested callback.
export function createRefreshQueue() {
  let active: Promise<void> | null = null;
  let pending: (() => Promise<void>) | null = null;
  return (job: () => Promise<void>): Promise<void> => {
    pending = job;
    if (active) return active;
    active = (async () => { while (pending) { const next = pending; pending = null; await next(); } })().finally(() => { active = null; });
    return active;
  };
}
