// Parse human/fuzzy date strings used in demo data into ISO strings.
// Returns null if the string cannot be interpreted.
// Supports: ISO ("2026-04-22"), "Today HH:MM", "Mon HH:MM", "Fri 22:00", etc.
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function parseFuzzyDate(s?: string | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();

  // Already ISO-like (yyyy-mm-dd or full ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const now = new Date();
  const lower = trimmed.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
  const hh = timeMatch ? parseInt(timeMatch[1], 10) : 12;
  const mm = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  if (lower.startsWith("today")) {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  }
  if (lower.startsWith("yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  }

  const wd = WEEKDAYS.findIndex((w) => lower.startsWith(w));
  if (wd >= 0) {
    // Map to most-recent occurrence of that weekday (within last 7 days)
    const today = now.getDay();
    let diff = today - wd;
    if (diff < 0) diff += 7;
    const d = new Date(now);
    d.setDate(d.getDate() - diff);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
