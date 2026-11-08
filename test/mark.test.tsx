// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDS_KEY, idsToRegister, readCachedIds } from "../src/app/registered-ids";
import { resetIconsStore, setIconsState } from "../src/app/store";
import { tintColor } from "../src/app/tint";
import type { IconsState } from "../src/shared/contract";

const empty: IconsState = { assignments: {}, sets: [], icons: {}, totalBytes: 0, language: "en" };
const circle = { tag: "svg", attrs: { viewBox: "0 0 24 24", fill: "currentColor" }, children: [{ tag: "circle", attrs: { cx: "12", cy: "12", r: "9" }, children: [] }] };
const alpha = { id: "acp-alpha", displayName: "Alpha", logoUrl: null, icon: { glyph: "Briefcase" }, strings: { iconTint: null } };

async function loadApp(cached: string[] = ["acp-alpha"]) {
  localStorage.setItem(IDS_KEY, JSON.stringify(cached));
  return loadPluginApp(() => import("../app"));
}

async function renderMark(providerId: string) {
  const app = await loadApp();
  const registration = app.providerIcons.find((r) => r.providerId === providerId);
  if (!registration) throw new Error(`no mark for ${providerId}`);
  return renderSlot({ component: registration.icon }, { className: "size-4" }, {
    providers: { status: "ready", providers: [alpha] as never },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetIconsStore();
});
afterEach(() => resetIconsStore());

describe("provider marks", () => {
  it("registers shipped providers and cached ids", async () => {
    const app = await loadApp(["acp-alpha", "acp-beta"]);
    expect(app.providerIcons.map((r) => r.providerId)).toEqual(
      expect.arrayContaining(["codex", "claude-code", "acp-alpha", "acp-beta"]),
    );
    expect(app.providerIcons.every((r) => r.providerKind === "agent")).toBe(true);
  });

  it("draws the original icon while nothing is assigned", async () => {
    const slot = await renderMark("acp-alpha");
    act(() => setIconsState(empty));
    expect(slot.container.querySelector("[data-agent-icons]")).toBeNull();
    expect(slot.container.innerHTML).not.toBe("");
  });

  it("draws a builtin with light-dark tint and switches live without a new setup (AE2)", async () => {
    const slot = await renderMark("acp-alpha");
    const original = slot.container.innerHTML;
    act(() =>
      setIconsState({ ...empty, assignments: { "acp-alpha": { source: { builtin: "Bot" }, tint: { dark: "#4385be" } } } }),
    );
    const withBot = slot.container.innerHTML;
    expect(withBot).not.toBe(original);
    act(() =>
      setIconsState({ ...empty, assignments: { "acp-alpha": { source: { builtin: "Calendar" }, tint: { light: "#af3029" } } } }),
    );
    expect(slot.container.innerHTML).not.toBe(withBot);
    act(() => setIconsState(empty));
    expect(slot.container.innerHTML).toBe(original);
  });

  it("draws a set icon tree with bb's className on the root svg", async () => {
    const slot = await renderMark("acp-alpha");
    act(() =>
      setIconsState({
        ...empty,
        assignments: { "acp-alpha": { source: { set: "s1", icon: "k" } } },
        icons: { "s1/k": { name: "k", tree: circle } },
      }),
    );
    const svg = slot.container.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("size-4");
    expect(slot.container.querySelector("circle")).not.toBeNull();
  });

  it("falls back to the original icon when the assigned icon is gone or invalid", async () => {
    const slot = await renderMark("acp-alpha");
    act(() => setIconsState(empty));
    const original = slot.container.innerHTML;
    act(() => setIconsState({ ...empty, assignments: { "acp-alpha": { source: { set: "s1", icon: "gone" } } } }));
    expect(slot.container.innerHTML).toBe(original);
    act(() =>
      setIconsState({
        ...empty,
        assignments: { "acp-alpha": { source: { set: "s1", icon: "k" } } },
        icons: { "s1/k": { name: "k", tree: { tag: "script", attrs: {}, children: [] } } },
      }),
    );
    expect(slot.container.innerHTML).toBe(original);
  });
});

describe("tint", () => {
  it("fills the unset theme with currentColor", () => {
    expect(tintColor({ dark: "#112233" })).toBe("light-dark(currentColor, #112233)");
    expect(tintColor({ light: "#aa0000", dark: "#112233" })).toBe("light-dark(#aa0000, #112233)");
    expect(tintColor({})).toBeUndefined();
    expect(tintColor(undefined)).toBeUndefined();
  });
});

describe("registered ids", () => {
  it("the overlay caches assigned ids for the next setup", async () => {
    const app = await loadApp([]);
    renderSlot(app.appOverlays[0]!, {}, {
      rpc: { state: () => ({ ...empty, assignments: { "acp-beta": { source: { builtin: "Calendar" } } } }) },
    });
    await waitFor(() => expect(readCachedIds()).toEqual(["acp-beta"]));
    expect(idsToRegister()).toContain("acp-beta");
  });

  it("ignores corrupt JSON and invalid ids", () => {
    localStorage.setItem(IDS_KEY, "{not json");
    expect(idsToRegister()).toEqual(["codex", "claude-code", "acp-cursor", "acp-hermes-agent"]);
    localStorage.setItem(IDS_KEY, JSON.stringify(["ok-id", 5, "bad id", "x/y"]));
    expect(readCachedIds()).toEqual(["ok-id"]);
  });
});
