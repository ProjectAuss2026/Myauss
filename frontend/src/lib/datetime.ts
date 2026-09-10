/**
 * Datetime helpers for the admin forms' date/time picker.
 *
 * These are deliberately separated from Admin.tsx so the timezone contract is
 * unit-testable (see datetime.test.js) — the naive-string bug it guards against
 * was invisible to the suite because the test fixtures encoded the wrong
 * assumption.
 *
 * The value contract throughout the forms is a LOCAL WALL-CLOCK string,
 * "YYYY-MM-DDTHH:mm" (the same shape <input type="datetime-local"> uses). It is
 * only converted to an absolute instant at the network boundary.
 */

/**
 * Format an ISO datetime string (or Date) for the picker: local wall clock as
 * "YYYY-MM-DDTHH:mm". Uses local getters, so the value shown to the admin is in
 * their own timezone.
 */
export function formatToDatetimeLocal(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert a local wall-clock string ("YYYY-MM-DDTHH:mm", in the admin's own
 * timezone) to an absolute UTC instant ("...Z").
 *
 * The old version just appended ":00" with no timezone, so the server parsed it
 * in ITS timezone. On Railway (UTC) that shifted every activity time by the
 * admin's offset — it only looked correct in local dev because the dev machine's
 * timezone matched the admin's. `new Date(local).toISOString()` anchors the
 * instant to UTC, so it round-trips regardless of server timezone.
 */
export function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const date = new Date(datetimeLocal); // parsed as the browser's local time
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}
