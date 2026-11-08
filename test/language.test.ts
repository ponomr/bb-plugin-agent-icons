import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, formatMegabytes, parseLanguage, tooLargeReason } from "../src/shared/i18n";
import { setup } from "./helpers";

describe("display language", () => {
  it("defaults to English when the setting was never set", async () => {
    const t = await setup();
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect((await t.state()).language).toBe("en");
  });

  it("returns Russian when the setting is ru", async () => {
    const t = await setup([], { language: "ru" });
    expect((await t.state()).language).toBe("ru");
  });

  it("falls back to English for an unknown stored value", async () => {
    const t = await setup([], { language: "de" });
    expect((await t.state()).language).toBe("en");
    expect(parseLanguage(undefined)).toBe("en");
    expect(parseLanguage("de")).toBe("en");
  });

  it("invalidates open pages when the language changes", async () => {
    const t = await setup();
    const before = t.invalidations().length;
    await t.harness.behavior.setSettings({ language: "ru" });
    expect(t.invalidations().length).toBeGreaterThan(before);
    expect(t.invalidations().at(-1)).toEqual(["icons"]);
    expect((await t.state()).language).toBe("ru");
    await t.harness.behavior.setSettings({ language: null });
    expect((await t.state()).language).toBe("en");
  });

  it("formats sizes for the chosen language", () => {
    expect(formatMegabytes(1.5 * 1024 * 1024, "en")).toBe("1.5");
    expect(formatMegabytes(1.5 * 1024 * 1024, "ru")).toBe("1,5");
    expect(tooLargeReason(40 * 1024, "en")).toBe("file larger than 32 KB (40 KB)");
    expect(tooLargeReason(40 * 1024, "ru")).toBe("файл больше 32 КБ (40 КБ)");
  });
});
