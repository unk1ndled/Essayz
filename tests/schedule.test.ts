import { describe, expect, it } from "vitest";
import { weekForDate, weekForKey } from "../worker/schedule";

describe("weekly reveal schedule", () => {
  it("uses Monday as the week key in Europe/Paris", () => {
    const week = weekForDate(new Date("2026-08-01T14:00:00.000Z"), "Europe/Paris");
    expect(week.key).toBe("2026-07-27");
    expect(week.endsOn).toBe("2026-08-02");
    expect(week.unlockAt).toBe("2026-08-02T08:00:00.000Z");
    expect(week.closesAt).toBe("2026-08-02T22:00:00.000Z");
    expect(week.isUnlocked).toBe(false);
    expect(week.isOpen).toBe(true);
  });

  it("unlocks exactly at Sunday 10:00 local time", () => {
    const before = weekForKey(
      "2026-07-27",
      new Date("2026-08-02T07:59:59.999Z"),
      "Europe/Paris",
    );
    const atDeadline = weekForKey(
      "2026-07-27",
      new Date("2026-08-02T08:00:00.000Z"),
      "Europe/Paris",
    );
    expect(before.isUnlocked).toBe(false);
    expect(atDeadline.isUnlocked).toBe(true);
    expect(atDeadline.isOpen).toBe(true);
  });

  it("keeps the same writing week open after the Sunday reveal", () => {
    const sundayEvening = weekForDate(
      new Date("2026-08-02T20:30:00.000Z"),
      "Europe/Paris",
    );
    expect(sundayEvening.key).toBe("2026-07-27");
    expect(sundayEvening.isUnlocked).toBe(true);
    expect(sundayEvening.isOpen).toBe(true);
  });

  it("starts a new writing week at local Monday midnight", () => {
    const previous = weekForKey(
      "2026-07-27",
      new Date("2026-08-02T22:00:00.000Z"),
      "Europe/Paris",
    );
    const current = weekForDate(
      new Date("2026-08-02T22:00:00.000Z"),
      "Europe/Paris",
    );
    expect(previous.isOpen).toBe(false);
    expect(current.key).toBe("2026-08-03");
    expect(current.isOpen).toBe(true);
  });

  it("accounts for Paris winter time", () => {
    const week = weekForKey(
      "2026-01-05",
      new Date("2026-01-05T12:00:00.000Z"),
      "Europe/Paris",
    );
    expect(week.unlockAt).toBe("2026-01-11T09:00:00.000Z");
  });

  it("accounts for the spring daylight-saving transition", () => {
    const week = weekForKey(
      "2026-03-23",
      new Date("2026-03-23T12:00:00.000Z"),
      "Europe/Paris",
    );
    expect(week.unlockAt).toBe("2026-03-29T08:00:00.000Z");
  });

  it("rejects a non-Monday week key", () => {
    expect(() => weekForKey("2026-07-28", new Date(), "Europe/Paris")).toThrow(
      "Week key must be a Monday",
    );
  });
});
