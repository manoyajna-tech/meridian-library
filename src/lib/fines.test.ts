import { describe, expect, it } from "vitest";
import { calcFine, overdueDays } from "./fines";

describe("fines", () => {
  it("charges nothing on the due date", () => {
    expect(calcFine("2026-03-10", "2026-03-10", 5)).toBe(0);
  });
  it("charges nothing before the due date", () => {
    expect(calcFine("2026-03-10", "2026-03-01", 5)).toBe(0);
  });
  it("charges rate x overdue days after the due date", () => {
    expect(overdueDays("2026-03-10", "2026-03-13")).toBe(3);
    expect(calcFine("2026-03-10", "2026-03-13", 5)).toBe(15);
  });
});
