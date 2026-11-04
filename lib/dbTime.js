// Postgres `timestamp without time zone` — parse it as UTC.
//
// Neon returns such a column as "2026-11-04 23:50:42.25" with no offset. JS
// parses that shape as LOCAL time, so `Date.now() - new Date(value)` was off by
// the server's UTC offset (+8h in Asia/Shanghai). Every freshness check built on
// it (admin bot-status `online`, live-bot lists) reported a running bot as
// offline, and the operator had no way to tell the difference from a real outage.
const NAIVE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function dbTime(value) {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  const s = String(value).trim();
  if (!s) return 0;
  if (NAIVE.test(s)) return Date.parse(s.replace(' ', 'T') + 'Z');
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
