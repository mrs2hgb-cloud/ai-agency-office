/** Israel-specific helpers shared by the tools */

export const OFFICE_TIME_ZONE = "Asia/Jerusalem";
export const VAT_RATE = 0.18;

const DAY_MS = 86_400_000;

/** Digits in international format (9725XXXXXXXX), or null if it doesn't look like a phone number */
export function normalizeIsraeliPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Calendar parts of a date in the office time zone */
export function officeDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    monthDay: `${get("month")}-${get("day")}`,
    weekday: get("weekday"),
  };
}

/** Today's date in Israel, offset by a number of days */
export const officeDay = (offset = 0) => officeDate(new Date(Date.now() + offset * DAY_MS));

/** Maps "MM-DD" to "YYYY-MM-DD" for today and each of the next `days` days */
export function upcomingMonthDays(days: number): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i <= days; i++) {
    const { iso, monthDay } = officeDay(i);
    result.set(monthDay, iso);
  }
  return result;
}

/** "2026-10-20T14:00" in Israel time -> epoch milliseconds (DST-aware) */
export function israelLocalToEpoch(local: string): number {
  const asUtc = Date.parse(`${local.length === 10 ? `${local}T09:00` : local.slice(0, 16)}:00Z`);
  if (Number.isNaN(asUtc)) return NaN;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: OFFICE_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(asUtc))
    .find((p) => p.type === "timeZoneName")!.value; // e.g. "GMT+03:00"
  const [, sign, hours, minutes] = /GMT([+-])(\d{2}):(\d{2})/.exec(offset) ?? [, "+", "00", "00"];
  const offsetMs = (Number(hours) * 60 + Number(minutes)) * 60_000 * (sign === "-" ? -1 : 1);
  return asUtc - offsetMs;
}

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const formatShekels = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n);

/**
 * Normalizes a CRM date to YYYY-MM-DD in Israel time. Timestamps are converted
 * (a birthday saved as Israeli midnight is the previous day in UTC); plain
 * dates and DD/MM/YYYY are taken as written.
 */
export function toOfficeIsoDate(value: string): string {
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Only timestamps with an explicit zone need converting; others are local already
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : officeDate(parsed).iso;
}
