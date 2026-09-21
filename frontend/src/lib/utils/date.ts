/**
 * Date helpers that operate in the BROWSER'S LOCAL TIMEZONE.
 *
 * `new Date().toISOString().split('T')[0]` — the pattern previously scattered
 * across the app for computing "today" as a YYYY-MM-DD string — actually
 * returns the date in UTC, not the user's local date. Depending on the user's
 * offset from UTC, this silently shifts the calculated "today" by a day:
 *   - Users AHEAD of UTC (e.g. UTC+8 in the evening) get tomorrow's UTC date,
 *     so date pickers capped with `max={today}` would still let them pick a
 *     date that is, locally, "the day after tomorrow".
 *   - Users BEHIND UTC (e.g. UTC-5 late at night) get yesterday's UTC date,
 *     so `max={today}` blocks them from picking their own actual "today".
 *
 * `getLocalDateString()` reads the Date object's local getFullYear/getMonth/
 * getDate accessors (which already reflect the browser's timezone) instead of
 * normalizing through UTC, so the computed date always matches the date the
 * user sees on their own wall clock.
 */

/**
 * Returns a Date (or the current moment, if omitted) as a `YYYY-MM-DD` string
 * in the LOCAL timezone — safe to use directly as the `value`/`min`/`max` of
 * `<input type="date">` elements.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns a Date (or the current moment, if omitted) as a
 * `YYYY-MM-DDTHH:mm` string in the LOCAL timezone — safe to use directly as
 * the `value`/`min`/`max` of `<input type="datetime-local">` elements.
 */
export function getLocalDateTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${getLocalDateString(date)}T${hours}:${minutes}`
}

/** Today's date as a `YYYY-MM-DD` string in the user's local timezone. */
export function getTodayLocalDateString(): string {
  return getLocalDateString(new Date())
}
