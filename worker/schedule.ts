export interface WeekInfo {
  key: string;
  startsOn: string;
  endsOn: string;
  unlockAt: string;
  closesAt: string;
  isUnlocked: boolean;
  isOpen: boolean;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

const weekdays: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedParts(date: Date, timeZone: string): DateParts {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((value) => value.type === type)?.value ?? "";

  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
    second: Number(part("second")),
    weekday: part("weekday"),
  };
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desiredWallTime;

  // Two passes are generally enough; a third makes transitions around DST robust.
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualWallTime = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess -= actualWallTime - desiredWallTime;
  }

  return new Date(guess);
}

export function weekForDate(now: Date, timeZone: string): WeekInfo {
  const local = zonedParts(now, timeZone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = (weekdays[local.weekday] + 6) % 7;
  const monday = new Date(localDate);
  monday.setUTCDate(localDate.getUTCDate() - daysSinceMonday);

  return weekForKey(dateKey(monday), now, timeZone);
}

export function weekForKey(key: string, now: Date, timeZone: string): WeekInfo {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error("Invalid week key");
  }
  const monday = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(monday.getTime()) || monday.getUTCDay() !== 1) {
    throw new Error("Week key must be a Monday");
  }

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  const unlock = localDateTimeToUtc(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
    10,
    0,
    timeZone,
  );
  const close = localDateTimeToUtc(
    nextMonday.getUTCFullYear(),
    nextMonday.getUTCMonth() + 1,
    nextMonday.getUTCDate(),
    0,
    0,
    timeZone,
  );

  return {
    key,
    startsOn: key,
    endsOn: dateKey(sunday),
    unlockAt: unlock.toISOString(),
    closesAt: close.toISOString(),
    isUnlocked: now.getTime() >= unlock.getTime(),
    isOpen: now.getTime() < close.getTime(),
  };
}
