import { describe, expect, it } from "vitest";
import de from "../src/i18n/de.json";
import { formatDate, hasTranslation, t } from "../src/i18n";

describe("i18n", () => {
  it("fills placeholders", () => {
    expect(t("friends.since", { date: "01.01.2026" })).toBe(
      "Befreundet seit 01.01.2026",
    );
  });

  it("leaves an unknown placeholder visible instead of rendering a gap", () => {
    expect(t("friends.since", { wrong: "x" })).toContain("{date}");
  });

  it("recognises which runtime-built keys exist", () => {
    expect(hasTranslation("auth.error.invalid_credentials")).toBe(true);
    expect(hasTranslation("auth.error.teapot")).toBe(false);
  });

  it("has no empty strings in the dictionary", () => {
    const empty = Object.entries(de).filter(([, value]) => value.trim() === "");
    expect(empty).toEqual([]);
  });

  it("formats dates for the active locale", () => {
    expect(formatDate("2026-03-04T12:00:00.000Z")).toBe("04.03.2026");
  });
});
