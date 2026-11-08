import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

describe("bb agent-icons", () => {
  it("import-set creates a set named after the folder argument with icon names from file names", async () => {
    const t = await setup();
    const result = await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Set "Team": 2 accepted, 1 rejected');
    expect(result.stdout).toContain("broken-image.svg: no shapes");
    const state = await t.state();
    expect(state.sets).toMatchObject([{ name: "Team", iconCount: 2 }]);
    const { icons } = await t.call<{ icons: { id: string; name: string }[] }>("setIcons", { setId: state.sets[0]!.id });
    expect(icons.map((i) => [i.id, i.name]).sort()).toEqual([
      ["calendar", "calendar"],
      ["team-bot", "Team Bot"],
    ]);
  });

  it("import-set into an existing set by name adds to it instead of failing", async () => {
    const t = await setup();
    await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    const again = await t.harness.behavior.runCli(["import-set", "team", "set"], { cwd: fixtures });
    expect(again.exitCode).toBe(0);
    expect((await t.state()).sets).toHaveLength(1);
  });

  it("assign resolves set and icon by name and accepts colours", async () => {
    const t = await setup();
    await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    const result = await t.harness.behavior.runCli(["assign", "acp-alpha", "Team/Team Bot", "--dark", "#4385BE"]);
    expect(result.exitCode).toBe(0);
    const state = await t.state();
    expect(state.assignments["acp-alpha"]).toMatchObject({
      source: { icon: "team-bot" },
      tint: { dark: "#4385be" },
    });
  });

  it("assign builtin, then clear", async () => {
    const t = await setup();
    expect((await t.harness.behavior.runCli(["assign", "acp-beta", "builtin:Calendar"])).exitCode).toBe(0);
    expect((await t.state()).assignments["acp-beta"]).toEqual({ source: { builtin: "Calendar" } });
    const cleared = await t.harness.behavior.runCli(["clear", "acp-beta"]);
    expect(cleared.stdout).toContain("assignment cleared");
    expect((await t.state()).assignments).toEqual({});
  });

  it("assign reports a bad colour, an unknown builtin and a missing icon", async () => {
    const t = await setup();
    const color = await t.harness.behavior.runCli(["assign", "acp-beta", "builtin:Calendar", "--light", "red"]);
    expect(color.exitCode).not.toBe(0);
    expect(color.stderr).toContain("#rrggbb");
    const builtin = await t.harness.behavior.runCli(["assign", "acp-beta", "builtin:Wrench"]);
    expect(builtin.stderr).toContain("there is no built-in icon Wrench");
    const missing = await t.harness.behavior.runCli(["assign", "acp-beta", "Nope/x"]);
    expect(missing.stderr).toContain('set "Nope" not found');
  });

  it("list shows assignments, including providers absent from bb (R6)", async () => {
    const t = await setup([
      { id: "codex", displayName: "Codex" },
      { id: "acp-beta", displayName: "Beta" },
    ]);
    await t.harness.behavior.runCli(["assign", "acp-beta", "builtin:Calendar", "--light", "#AF3029"]);
    await t.harness.behavior.runCli(["assign", "acp-old", "builtin:Archive"]);
    const { stdout, exitCode } = await t.harness.behavior.runCli(["list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("acp-beta (Beta): builtin:Calendar, light #af3029");
    expect(stdout).toContain("codex (Codex): original icon");
    expect(stdout).toMatch(/Not in bb:\n {2}acp-old: builtin:Archive/);
  });

  it("list names the icons in each set and the builtins that assign accepts", async () => {
    const t = await setup();
    await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    const { stdout } = await t.harness.behavior.runCli(["list"]);
    expect(stdout).toMatch(/Team \(.+\): 2 icons, .+\n {4}.*Team Bot/);
    expect(stdout).toMatch(/Built-in \(builtin:<Name>\): .*Calendar/);
    const json = JSON.parse((await t.harness.behavior.runCli(["list", "--json"])).stdout);
    expect(json.builtins).toContain("Calendar");
    expect([...json.sets[0].iconNames].sort()).toEqual(["Team Bot", "calendar"]);
    expect(json.icons).toBeUndefined();
  });

  it("list prints in Russian when the language setting is ru", async () => {
    const t = await setup([{ id: "codex", displayName: "Codex" }], { language: "ru" });
    await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    const { stdout } = await t.harness.behavior.runCli(["list"]);
    expect(stdout).toContain("Провайдеры:");
    expect(stdout).toContain("codex (Codex): исходная иконка");
    expect(stdout).toMatch(/Team \(.+\): 2 икон\., .+ КБ/);
    expect(stdout).toMatch(/Встроенные \(builtin:<Имя>\)/);
  });

  it("list prints in English by default", async () => {
    const t = await setup([{ id: "codex", displayName: "Codex" }]);
    const { stdout } = await t.harness.behavior.runCli(["list"]);
    expect(stdout).toContain("Providers:");
    expect(stdout).toContain("Sets:\n  none");
  });

  it("import-set reports its result in the configured language", async () => {
    const t = await setup([], { language: "ru" });
    const result = await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    expect(result.stdout).toContain("Набор «Team»: принято 2, отклонено 1");
    expect(result.stdout).toContain("broken-image.svg: нет фигур");
  });

  it("assign rejects a set icon named after an Object.prototype key", async () => {
    const t = await setup();
    await t.harness.behavior.runCli(["import-set", "Team", "set"], { cwd: fixtures });
    const result = await t.harness.behavior.runCli(["assign", "acp-alpha", "Team/constructor"]);
    expect(result.exitCode).not.toBe(0);
    expect((await t.state()).assignments).toEqual({});
  });

  it("list still prints assignments when the provider list fails", async () => {
    const t = await setup();
    t.harness.sdk.stub("providers.list", async () => {
      throw new Error("offline");
    });
    await t.harness.behavior.runCli(["assign", "acp-beta", "builtin:Calendar"]);
    const { stdout } = await t.harness.behavior.runCli(["list"]);
    expect(stdout).toContain("unavailable");
    expect(stdout).toContain("acp-beta: builtin:Calendar");
  });
});
