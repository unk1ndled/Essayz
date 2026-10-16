import type { WeekInfo } from "./types";

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { month: "short", day: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  );
}

export function weekLabel(week: WeekInfo) {
  return `${formatDate(week.startsOn)} – ${formatDate(week.endsOn, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function relativeUnlock(unlockAt: string, now: number) {
  const remaining = new Date(unlockAt).getTime() - now;
  if (remaining <= 0) return "Unlocked now";
  const totalMinutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h until the reveal`;
  if (hours > 0) return `${hours}h ${minutes}m until the reveal`;
  return `${minutes}m until the reveal`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function wordCount(markdown: string) {
  const clean = markdown.replace(/[#>*_`\[\]()!-]/g, " ").trim();
  return clean ? clean.split(/\s+/).length : 0;
}

export function plainWordCount(value: string) {
  const text = value.trim();
  return text ? text.split(/\s+/u).length : 0;
}
