import { format, isValid } from "date-fns";

export function formatDateIn(date: Date | string | number, pattern: string): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (!isValid(d)) return "—";
    return format(d, pattern);
  } catch {
    return "—";
  }
}

export function fmtDate(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "dd/MM/yyyy");
}

export function fmtDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "dd/MM/yyyy, hh:mm a");
}

export function fmtDateShort(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "dd/MM/yyyy");
}

export function fmtDateTimeShort(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "dd/MM, hh:mm a");
}

export function fmtTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "hh:mm a");
}

export function fmtMonthYear(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "MMMM yyyy");
}

export function fmtDayMonthYear(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return formatDateIn(date, "EEEE, dd/MM/yyyy");
}

export function fmtDateRange(start: Date | string | number | null | undefined, end: Date | string | number | null | undefined): string {
  if (!start || !end) return "—";
  return `${formatDateIn(start, "dd/MM/yyyy")} — ${formatDateIn(end, "dd/MM/yyyy")}`;
}
