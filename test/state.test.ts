import { describe, expect, it } from "vitest";
import { MAX_ICONS_PER_SET } from "../src/shared/limits";
import { bulkySvg, setup, tinySvg } from "./helpers";

describe("assignments", () => {
  it("stores a builtin assignment, returns it in state and invalidates icons", async () => {
    const t = await setup();
    await t.call("assign", { providerId: "acp-beta", source: { builtin: "Calendar" }, tint: { light: "#AA3355" } });
    const state = await t.state();
    expect(state.assignments["acp-beta"]).toEqual({ source: { builtin: "Calendar" }, tint: { light: "#aa3355" } });
    expect(t.invalidations()).toContainEqual(["icons"]);
  });

  it("rejects unknown builtins, sets and icons", async () => {
    const t = await setup();
    await expect(t.call("assign", { providerId: "acp-beta", source: { builtin: "Wrench" } })).rejects.toThrow(
      /встроенного значка Wrench нет/,
    );
    await expect(t.call("assign", { providerId: "acp-beta", source: { set: "nope", icon: "x" } })).rejects.toThrow(
      /набор не найден/,
    );
    const setId = await t.createSet("Team");
    await expect(t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "x" } })).rejects.toThrow(
      /иконка не найдена/,
    );
    await expect(
      t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "constructor" } }),
    ).rejects.toThrow(/иконка не найдена/);
    expect((await t.state()).assignments).toEqual({});
  });

  it("rejects a malformed colour and accepts a dark-only tint", async () => {
    const t = await setup();
    await expect(
      t.call("assign", { providerId: "acp-alpha", source: { builtin: "Bot" }, tint: { light: "red" } }),
    ).rejects.toThrow();
    await t.call("assign", { providerId: "acp-alpha", source: { builtin: "Bot" }, tint: { dark: "#112233" } });
    expect((await t.state()).assignments["acp-alpha"]?.tint).toEqual({ dark: "#112233" });
  });

  it("keeps every assignment when several are written at once", async () => {
    const t = await setup();
    const ids = ["acp-alpha", "acp-beta", "acp-gamma", "codex", "claude-code"];
    await Promise.all(ids.map((providerId) => t.call("assign", { providerId, source: { builtin: "Bot" } })));
    expect(Object.keys((await t.state()).assignments).sort()).toEqual([...ids].sort());
  });

  it("clears an assignment and treats a second clear as a no-op", async () => {
    const t = await setup();
    await t.call("assign", { providerId: "codex", source: { builtin: "Code" } });
    expect(await t.call("clear", { providerId: "codex" })).toEqual({ cleared: true });
    expect(await t.call("clear", { providerId: "codex" })).toEqual({ cleared: false });
    expect((await t.state()).assignments).toEqual({});
  });
});

describe("sets", () => {
  it("keeps clean files and reports a reason for rejected ones", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    const result = await t.upload(setId, [
      { fileName: "Alpha.svg", text: tinySvg() },
      { fileName: "bad.svg", text: '<svg viewBox="0 0 1 1"><image href="x"/></svg>' },
    ]);
    expect(result.accepted).toEqual([{ fileName: "Alpha.svg", iconId: "alpha", name: "Alpha" }]);
    expect(result.rejected).toEqual([{ fileName: "bad.svg", reason: "нет фигур" }]);
    expect((await t.state()).sets).toMatchObject([{ id: setId, name: "Team", iconCount: 1 }]);
  });

  it("deduplicates icon ids and replaces an icon uploaded again under the same name", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [
      { fileName: "a b.svg", text: tinySvg(1) },
      { fileName: "a-b.svg", text: tinySvg(2) },
    ]);
    const again = await t.upload(setId, [{ fileName: "a b.svg", text: tinySvg(3) }]);
    expect(again.accepted[0]?.iconId).toBe("a-b");
    const { icons } = await t.call<{ icons: { id: string }[] }>("setIcons", { setId });
    expect(icons.map((i) => i.id).sort()).toEqual(["a-b", "a-b-2"]);
  });

  it("refuses duplicate set names regardless of case", async () => {
    const t = await setup();
    await t.createSet("Team");
    await expect(t.createSet("team")).rejects.toThrow(/уже есть/);
  });

  it("deletes a set with its assignments and names the affected providers (AE3)", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [{ fileName: "Gamma.svg", text: tinySvg() }]);
    await t.call("assign", { providerId: "acp-gamma", source: { set: setId, icon: "gamma" } });
    await t.call("assign", { providerId: "acp-alpha", source: { builtin: "Bot" } });
    expect(await t.call("deleteSet", { setId })).toEqual({ affected: ["acp-gamma"] });
    const state = await t.state();
    expect(state.sets).toEqual([]);
    expect(Object.keys(state.assignments)).toEqual(["acp-alpha"]);
    expect(await t.bb.storage.kv.list("icons/")).toEqual([]);
  });

  it("deletes one icon and the assignments that use it", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [
      { fileName: "a.svg", text: tinySvg(1) },
      { fileName: "b.svg", text: tinySvg(2) },
    ]);
    await t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "a" } });
    expect(await t.call("deleteIcon", { setId, iconId: "a" })).toEqual({ affected: ["acp-beta"] });
    expect((await t.state()).sets[0]).toMatchObject({ iconCount: 1 });
  });

  it("matches icon names ignoring case on upload and rename", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [{ fileName: "Bot.svg", text: tinySvg(1) }]);
    const again = await t.upload(setId, [{ fileName: "bot.svg", text: tinySvg(2) }]);
    expect(again.accepted[0]?.iconId).toBe("bot");
    await t.upload(setId, [{ fileName: "Robot.svg", text: tinySvg(3) }]);
    await expect(t.call("renameIcon", { setId, iconId: "robot", name: "BOT" })).rejects.toThrow(/уже есть иконка/);
    const { icons } = await t.call<{ icons: { id: string; name: string }[] }>("setIcons", { setId });
    expect(icons.map((i) => [i.id, i.name]).sort()).toEqual([
      ["bot", "bot"],
      ["robot", "Robot"],
    ]);
  });

  it("names an icon 'constructor' without colliding with Object.prototype", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    const result = await t.upload(setId, [{ fileName: "constructor.svg", text: tinySvg() }]);
    expect(result.accepted[0]?.iconId).toBe("constructor");
    await t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "constructor" } });
    expect((await t.state()).icons[`${setId}/constructor`]?.name).toBe("constructor");
  });

  it("renames sets and icons and keeps assignments", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [{ fileName: "a.svg", text: tinySvg() }]);
    await t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "a" } });
    await t.call("renameSet", { setId, name: "Агенты" });
    await t.call("renameIcon", { setId, iconId: "a", name: "Бета" });
    const state = await t.state();
    expect(state.sets[0]?.name).toBe("Агенты");
    expect(state.icons[`${setId}/a`]?.name).toBe("Бета");
  });

  it(`rejects icon ${MAX_ICONS_PER_SET + 1} in a set and leaves the set unchanged`, async () => {
    const t = await setup();
    const setId = await t.createSet("Big");
    const files = Array.from({ length: MAX_ICONS_PER_SET }, (_, i) => ({ fileName: `i${i}.svg`, text: tinySvg(i) }));
    expect((await t.upload(setId, files)).accepted).toHaveLength(MAX_ICONS_PER_SET);
    const before = await t.state();
    const extra = await t.upload(setId, [{ fileName: "extra.svg", text: tinySvg() }]);
    expect(extra.rejected[0]?.reason).toContain(`${MAX_ICONS_PER_SET}`);
    expect(await t.state()).toEqual(before);
  });

  it("stores a set larger than one KV value and refuses uploads past 2 MB", async () => {
    const t = await setup();
    const setId = await t.createSet("Bulky");
    const accepted: string[] = [];
    let refusal: string | undefined;
    for (let batch = 0; batch < 10 && !refusal; batch += 1) {
      const files = Array.from({ length: 8 }, (_, i) => ({
        fileName: `b${batch}-${i}.svg`,
        text: bulkySvg(30, batch * 8 + i),
      }));
      const result = await t.upload(setId, files);
      accepted.push(...result.accepted.map((a) => a.iconId));
      refusal = result.rejected[0]?.reason;
    }
    const state = await t.state();
    expect(state.sets[0]!.bytes).toBeGreaterThan(256 * 1024);
    expect(state.totalBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(refusal).toMatch(/нет места: занято \d+,\d из 2,0 МБ/);
    const before = await t.state();
    await t.upload(setId, [{ fileName: "more.svg", text: bulkySvg(30, 999) }]);
    expect(await t.state()).toEqual(before);
  });

  it("returns trees of assigned icons only in state and all trees in setIcons", async () => {
    const t = await setup();
    const setId = await t.createSet("Team");
    await t.upload(setId, [
      { fileName: "a.svg", text: tinySvg(1) },
      { fileName: "b.svg", text: tinySvg(2) },
    ]);
    await t.call("assign", { providerId: "acp-beta", source: { set: setId, icon: "a" } });
    expect(Object.keys((await t.state()).icons)).toEqual([`${setId}/a`]);
    const { icons } = await t.call<{ icons: { id: string; tree: unknown }[] }>("setIcons", { setId });
    expect(icons).toHaveLength(2);
    expect(icons.every((i) => typeof i.tree === "object")).toBe(true);
  });
});
