import { formatDeadline, timeLeft } from "../status";

describe("deadline display", () => {
  it("shows the time of day, not just the date", () => {
    expect(formatDeadline("2026-11-03T22:00:00Z")).toMatch(/4 Nov 2026.*9:00\s?am/i);
  });

  it("counts down in the largest whole unit", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    expect(timeLeft("2026-11-03T06:00:00Z", now)).toBe("2 days");
    expect(timeLeft("2026-11-01T01:30:00Z", now)).toBe("1 hour");
    expect(timeLeft("2026-11-01T00:40:00Z", now)).toBe("40 minutes");
    expect(timeLeft("2026-10-31T00:00:00Z", now)).toBe("0 minutes");
  });
});
