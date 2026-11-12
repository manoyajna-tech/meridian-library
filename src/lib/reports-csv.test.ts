import { describe, expect, it } from "vitest";
import { toCsv } from "./reports-csv";

describe("loan report CSV", () => {
  it("keeps spreadsheet column headers when the report has no rows", () => {
    expect(toCsv([])).toBe(
      '"student","student_id","book","category","issued","due","returned","status","fine","fine_paid"',
    );
  });

  it("quotes report values and escapes embedded quotes", () => {
    expect(toCsv([{ book: 'A "Great" Book', fine: 0 }])).toBe('"book","fine"\n"A ""Great"" Book","0"');
  });
});