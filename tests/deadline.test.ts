import { expect, test } from "bun:test";
import {
  HOUR,
  resolveDeadline,
  localDay,
  zonedLocal,
  fromZonedLocal,
  remainingTime,
  deadlineText,
} from "../src/shared/deadline";

test("duration starts at validation, has no one-week cap, and rejects invalid values", () => {
  const now = Date.parse("2026-10-24T10:00:00Z");
  expect(
    resolveDeadline(
      { kind: "duration", amount: 24, unit: "hours" },
      now + 600_000,
    ),
  ).toBe(now + 600_000 + 24 * HOUR);
  expect(
    resolveDeadline({ kind: "duration", amount: 45, unit: "days" }, now),
  ).toBe(now + 45 * 24 * HOUR);
  for (const amount of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    "3",
    null,
  ]) {
    expect(() =>
      resolveDeadline({ kind: "duration", amount, unit: "days" }, now),
    ).toThrow();
  }
  expect(() =>
    resolveDeadline({ kind: "duration", amount: 3, unit: "weeks" }, now),
  ).toThrow();
  expect(() =>
    resolveDeadline({ kind: "exact", local: "2026-02-30T12:00" }, now),
  ).toThrow();
  expect(() =>
    resolveDeadline({ kind: "exact", local: "2026-10-23T12:00" }, now),
  ).toThrow();
});

test("civil midnight follows Paris daylight saving while durations stay exact", () => {
  for (const [start, hours] of [
    ["2026-03-28T23:00:00Z", 23],
    ["2026-10-24T22:00:00Z", 25],
  ] as const) {
    const now = Date.parse(start),
      day = localDay(now);
    const tonight = resolveDeadline({ kind: "tonight", day }, now);
    expect(tonight - now).toBe(hours * HOUR);
    const tomorrow = resolveDeadline({ kind: "tomorrow", day }, now);
    expect(tomorrow - tonight).toBe(24 * HOUR);
    expect(
      resolveDeadline({ kind: "duration", amount: 24, unit: "hours" }, now) -
        now,
    ).toBe(24 * HOUR);
    expect(
      resolveDeadline({ kind: "duration", amount: 7, unit: "days" }, now) - now,
    ).toBe(168 * HOUR);
    expect(zonedLocal(tonight).slice(11)).toBe("00:00");
    expect(deadlineText(tomorrow, now)).toContain("demain à minuit");
  }
});

test("stale calendar days and ambiguous or missing exact local hours are rejected", () => {
  const before = Date.parse("2026-10-24T21:59:59Z"),
    after = before + 2000;
  expect(() =>
    resolveDeadline({ kind: "tonight", day: localDay(before) }, after),
  ).toThrow("Le jour a changé");
  expect(() => fromZonedLocal("2026-03-29T02:30")).toThrow(
    "inexistante ou ambiguë",
  );
  expect(() => fromZonedLocal("2026-10-25T02:30")).toThrow(
    "inexistante ou ambiguë",
  );
  expect(fromZonedLocal("2026-10-25T03:30")).toBe(
    Date.parse("2026-10-25T02:30:00Z"),
  );
});

test("relative wording handles boundaries without negative countdowns", () => {
  const now = Date.parse("2026-10-24T10:00:00Z");
  const cases = [
    [76 * HOUR, "dans 3 jours et 4 h"],
    [48 * HOUR, "dans 2 jours"],
    [48 * HOUR - 1, "dans 47 h 59 min"],
    [HOUR, "dans 1 h"],
    [HOUR - 1, "dans 59 min"],
    [60_000, "dans 1 min"],
    [59_999, "dans moins d'une minute"],
    [0, "à présent"],
    [-1, "à présent"],
  ] as const;
  for (const [delta, text] of cases)
    expect(remainingTime(now + delta, now)).toBe(text);
});
