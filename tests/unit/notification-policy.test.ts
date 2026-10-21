import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_POLICY,
  reminderDue,
  reminderSummary,
} from "../../src/lib/notification-policy";

describe("reminder timing and limits", () => {
  it("allows the initial alert immediately, even with zero reminders", () => {
    expect(
      reminderDue(
        { intervalMinutes: 1440, maxReminders: 0 },
        { successes: 0, lastSuccessAt: null },
        100,
      ),
    ).toBe(true);
    expect(
      reminderDue(
        { intervalMinutes: 1440, maxReminders: 0 },
        { successes: 1, lastSuccessAt: 0 },
        100_000_000,
      ),
    ).toBe(false);
  });
  it("waits the full configured interval since the last successful reminder", () => {
    expect(
      reminderDue(
        DEFAULT_NOTIFICATION_POLICY,
        { successes: 1, lastSuccessAt: 100 },
        300099,
      ),
    ).toBe(false);
    expect(
      reminderDue(
        DEFAULT_NOTIFICATION_POLICY,
        { successes: 1, lastSuccessAt: 100 },
        300100,
      ),
    ).toBe(true);
  });
  it("counts reminders after the first alert and allows increasing the limit", () => {
    const previous = { successes: 4, lastSuccessAt: 0 };
    expect(
      reminderDue({ intervalMinutes: 1, maxReminders: 3 }, previous, 60000),
    ).toBe(false);
    expect(
      reminderDue({ intervalMinutes: 1, maxReminders: 4 }, previous, 60000),
    ).toBe(true);
    expect(
      reminderDue(
        { intervalMinutes: 1, maxReminders: null },
        { ...previous, successes: 1000 },
        60000,
      ),
    ).toBe(true);
  });
  it.each(["fa", "en"])(
    "describes unlimited, limited and initial-only modes in %s",
    (locale) => {
      expect(
        reminderSummary({ intervalMinutes: 17, maxReminders: null }, locale),
      ).toContain("17");
      const limited = reminderSummary(
        { intervalMinutes: 17, maxReminders: 6 },
        locale,
      );
      expect(limited).toContain("17");
      expect(limited).toContain("6");
      expect(
        reminderSummary({ intervalMinutes: 17, maxReminders: 0 }, locale),
      ).toContain(locale === "fa" ? "فقط اعلان اول" : "Initial alert only");
    },
  );
});
