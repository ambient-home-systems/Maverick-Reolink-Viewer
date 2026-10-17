// Display helpers. Times arrive as UTC epoch milliseconds and are shown in
// Home Assistant's time zone (hass.config.time_zone), which for a camera on
// the same site is the camera's zone too.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone ?? ""}|${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat(undefined, { ...options, ...(timeZone ? { timeZone } : {}) });
    } catch {
      // Unknown zone name: fall back to the browser's zone.
      fmt = new Intl.DateTimeFormat(undefined, options);
    }
    formatters.set(key, fmt);
  }
  return fmt;
}

export function formatClock(ms: number, timeZone?: string, seconds = false): string {
  return formatter(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).format(ms);
}

export function formatDay(ms: number, timeZone?: string): string {
  return formatter(timeZone, { weekday: "short", month: "short", day: "numeric" }).format(ms);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}

/** Calendar date (YYYY-MM-DD) of a time in a zone. */
export function dateIn(ms: number, timeZone?: string): string {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** UTC offset of a zone at a time, in ms (east positive). */
export function offsetAt(ms: number, timeZone?: string): number {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** First day of the week for a locale (0 = Sunday, 1 = Monday). */
export function firstDayOfWeek(language?: string): number {
  try {
    const locale = new Intl.Locale(language ?? navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    // Older engines: fall through.
  }
  return /^en-(US|CA)|^ja|^he/.test(language ?? navigator.language) ? 0 : 1;
}
