// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDS_KEY } from "../src/app/registered-ids";
import { planUpload } from "../src/app/settings/model";
import { OTHER_DEVICES_NOTICE } from "../src/app/settings/settings-section";
import { RELOAD_NOTICE } from "../src/app/settings/provider-row";
import { resetIconsStore } from "../src/app/store";
import type { IconsState } from "../src/shared/contract";

const empty: IconsState = { assignments: {}, sets: [], icons: {}, totalBytes: 0 };
const circle = {
  tag: "svg",
  attrs: { viewBox: "0 0 24 24" },
  children: [{ tag: "circle", attrs: { cx: "12", cy: "12", r: "9" }, children: [] }],
};
const provider = (id: string, displayName: string) => ({
  id,
  displayName,
  logoUrl: null,
  icon: { glyph: "Briefcase" },
  strings: { iconTint: null },
});
const alpha = provider("acp-alpha", "Альфа");
const beta = provider("acp-beta", "Бета");
const gamma = provider("acp-gamma", "Гамма");

type Handlers = Record<string, (input: never) => unknown>;

async function renderSettings(
  state: IconsState | (() => unknown),
  handlers: Handlers = {},
  { cached = ["acp-alpha"], providers = [alpha, beta, gamma] }: { cached?: string[]; providers?: unknown[] } = {},
) {
  localStorage.setItem(IDS_KEY, JSON.stringify(cached));
  const app = await loadPluginApp(() => import("../app"));
  const section = app.settingsSections.find((s) => s.id === "icons");
  if (!section) throw new Error("no settings section");
  return renderSlot({ component: section.component }, {}, {
    providers: { status: "ready", providers: providers as never },
    rpc: { state: typeof state === "function" ? state : () => state, ...handlers } as never,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const teamSet: IconsState = {
  assignments: { "acp-gamma": { source: { set: "s1", icon: "a" } } },
  sets: [{ id: "s1", name: "Team", iconCount: 2, bytes: 400 }],
  icons: { "s1/a": { name: "a", tree: circle } },
  totalBytes: 400,
};
const teamIcons = () => ({
  id: "s1",
  name: "Team",
  icons: [
    { id: "a", name: "a", bytes: 200, tree: circle },
    { id: "b", name: "b", bytes: 200, tree: circle },
  ],
});

beforeEach(() => {
  localStorage.clear();
  resetIconsStore();
});
afterEach(() => {
  cleanup();
  resetIconsStore();
});

describe("settings page", () => {
  it("lists bb providers and a «Нет в bb» group for assignments of absent providers (R1, R6)", async () => {
    await renderSettings({ ...empty, assignments: { "acp-old": { source: { builtin: "Archive" } } } });
    await screen.findByText("Альфа");
    expect(screen.getByText("Бета")).toBeTruthy();
    const absent = screen.getByRole("region", { name: "Нет в bb" });
    expect(within(absent).getByText("acp-old")).toBeTruthy();
    expect(within(absent).getByRole("button", { name: "Сбросить: acp-old" })).toBeTruthy();
  });

  it("assigns a picked icon, waits for the RPC and offers a retry on failure while the old icon stays", async () => {
    const pending = deferred<{ providerId: string }>();
    const slot = await renderSettings(empty, { assign: () => pending.promise });
    fireEvent.click(await screen.findByRole("button", { name: "Изменить иконку: Бета" }));
    fireEvent.click(await screen.findByRole("button", { name: "Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("button", { name: "Сохранение…" })).toBeTruthy();
    expect(slot.inspection.rpcCalls).toContainEqual({
      method: "assign",
      input: { providerId: "acp-beta", source: { builtin: "Calendar" } },
    });
    await act(async () => pending.reject(new Error("сервер недоступен")));
    expect((await screen.findByRole("alert")).textContent).toContain("сервер недоступен");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(within(screen.getByTestId("row-acp-beta")).getByText(/Исходная иконка/)).toBeTruthy();
  });

  it("sends a dark-only tint without a light key", async () => {
    const slot = await renderSettings(empty, { assign: (input: { providerId: string }) => ({ providerId: input.providerId }) });
    fireEvent.click(await screen.findByRole("button", { name: "Изменить иконку: Альфа" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bot" }));
    const dark = screen.getByRole("textbox", { name: "Тёмная тема: цвет" });
    fireEvent.change(dark, { target: { value: "#4385BE" } });
    fireEvent.blur(dark);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({
        method: "assign",
        input: { providerId: "acp-alpha", source: { builtin: "Bot" }, tint: { dark: "#4385be" } },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the reload notice for an id not registered at setup only (R12, AE1)", async () => {
    await renderSettings(
      {
        ...empty,
        assignments: { "acp-alpha": { source: { builtin: "Bot" } }, "acp-beta": { source: { builtin: "Calendar" } } },
      },
      {},
      { cached: ["acp-alpha"] },
    );
    const betaRow = await screen.findByTestId("row-acp-beta");
    expect(within(betaRow).getByText(RELOAD_NOTICE)).toBeTruthy();
    expect(within(screen.getByTestId("row-acp-alpha")).queryByText(RELOAD_NOTICE)).toBeNull();
    expect(screen.getByText(OTHER_DEVICES_NOTICE)).toBeTruthy();
  });

  it("has no reload banner when every assigned id is registered", async () => {
    await renderSettings({ ...empty, assignments: { "acp-alpha": { source: { builtin: "Bot" } } } });
    await screen.findByTestId("row-acp-alpha");
    expect(screen.queryByText(OTHER_DEVICES_NOTICE)).toBeNull();
  });

  it("«Сбросить» calls clear (R4)", async () => {
    const slot = await renderSettings(
      { ...empty, assignments: { "acp-alpha": { source: { builtin: "Bot" } } } },
      { clear: () => ({ cleared: true }) },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Сбросить: Альфа" }));
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "clear", input: { providerId: "acp-alpha" } }));
  });

  it("uploads three files into a new set «Team» and shows the rejected file with its reason (R7, R9)", async () => {
    const slot = await renderSettings(empty, {
      createSet: () => ({ setId: "s1" }),
      uploadIcons: (input: { files: { fileName: string }[] }) => ({
        accepted: input.files
          .filter((f) => f.fileName !== "bad.svg")
          .map((f) => ({ fileName: f.fileName, iconId: f.fileName, name: f.fileName })),
        rejected: [{ fileName: "bad.svg", reason: "нет фигур" }],
      }),
    });
    fireEvent.change(await screen.findByRole("textbox", { name: "Имя нового набора" }), { target: { value: "Team" } });
    const files = ["alpha.svg", "beta.svg", "bad.svg"].map(
      (name) => new File(['<svg viewBox="0 0 24 24"><circle r="9"/></svg>'], name, { type: "image/svg+xml" }),
    );
    fireEvent.change(screen.getByLabelText("Загрузить набор"), { target: { files } });
    expect(await screen.findByText("bad.svg: нет фигур")).toBeTruthy();
    expect(screen.getByText(/Набор «Team»: принято 2, отклонено 1/)).toBeTruthy();
    expect(slot.inspection.rpcCalls).toContainEqual({ method: "createSet", input: { name: "Team" } });
    const upload = slot.inspection.rpcCalls.find((c) => c.method === "uploadIcons");
    expect((upload?.input as { setId: string; files: unknown[] }).setId).toBe("s1");
    expect((upload?.input as { files: unknown[] }).files).toHaveLength(3);
  });

  it("names a new set after the first file when no name is typed", async () => {
    const slot = await renderSettings(empty, {
      createSet: () => ({ setId: "s1" }),
      uploadIcons: () => ({ accepted: [], rejected: [] }),
    });
    await screen.findByRole("textbox", { name: "Имя нового набора" });
    const file = new File(["<svg/>"], "Agents.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByLabelText("Загрузить набор"), { target: { files: [file] } });
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "createSet", input: { name: "Agents" } }));
  });

  it("renames an icon and confirms deleting an assigned icon with the provider's name (R7, R8)", async () => {
    const slot = await renderSettings(teamSet, {
      setIcons: teamIcons,
      renameIcon: (input: { iconId: string }) => ({ iconId: input.iconId }),
      deleteIcon: () => ({ affected: ["acp-gamma"] }),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Иконки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Имя иконки: b" }));
    const input = screen.getByRole("textbox", { name: "Имя иконки" });
    fireEvent.change(input, { target: { value: "Бета" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({ method: "renameIcon", input: { setId: "s1", iconId: "b", name: "Бета" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить иконку a" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Исходную иконку получат: Гамма/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({ method: "deleteIcon", input: { setId: "s1", iconId: "a" } }),
    );
  });

  it("confirms deleting a set and names the provider using it (AE3)", async () => {
    const slot = await renderSettings(teamSet, { deleteSet: () => ({ affected: ["acp-gamma"] }) });
    fireEvent.click(await screen.findByRole("button", { name: "Удалить набор Team" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Исходную иконку получат: Гамма/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "deleteSet", input: { setId: "s1" } }));
  });

  it("shows loading instead of an empty list while state loads", async () => {
    await renderSettings(() => new Promise(() => {}));
    expect(await screen.findByText("Загрузка…")).toBeTruthy();
    expect(screen.queryByText("Наборов нет")).toBeNull();
  });

  it("shows the error with a retry when state fails", async () => {
    let fail = true;
    await renderSettings(() => {
      if (fail) throw new Error("нет связи");
      return empty;
    });
    expect((await screen.findByRole("alert")).textContent).toContain("нет связи");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Наборов нет")).toBeTruthy();
  });
});

describe("planUpload", () => {
  const file = (fileName: string, size: number) => ({ fileName, size, read: async () => "" });

  it("rejects oversize and non-SVG files locally and batches the rest under 1 MB", () => {
    const plan = planUpload([
      file("big.svg", 40 * 1024),
      file("note.txt", 10),
      ...Array.from({ length: 40 }, (_, i) => file(`i${i}.svg`, 30 * 1024)),
    ]);
    expect(plan.tooLarge.map((r) => r.fileName)).toEqual(["big.svg", "note.txt"]);
    expect(plan.tooLarge[0]?.reason).toContain("32 КБ");
    expect(plan.batches.flat()).toHaveLength(40);
    for (const batch of plan.batches) {
      expect(batch.reduce((sum, f) => sum + f.size, 0)).toBeLessThanOrEqual(1024 * 1024);
    }
  });
});
