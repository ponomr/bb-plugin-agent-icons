// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDS_KEY } from "../src/app/registered-ids";
import { planUpload } from "../src/app/settings/model";
import { en, ru } from "../src/app/strings";
import { resetIconsStore } from "../src/app/store";
import type { IconsState } from "../src/shared/contract";

const empty: IconsState = { assignments: {}, sets: [], icons: {}, totalBytes: 0, language: "en" };
const OTHER_DEVICES_NOTICE = en.otherDevicesNotice;
const RELOAD_NOTICE = en.reloadNotice;
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
const alpha = provider("acp-alpha", "Alpha");
const beta = provider("acp-beta", "Beta");
const gamma = provider("acp-gamma", "Gamma");

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
  language: "en",
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
  it("lists bb providers and a Not in bb group for assignments of absent providers (R1, R6)", async () => {
    await renderSettings({ ...empty, assignments: { "acp-old": { source: { builtin: "Archive" } } } });
    await screen.findByText("Alpha");
    expect(screen.getByText("Beta")).toBeTruthy();
    const absent = screen.getByRole("region", { name: "Not in bb" });
    expect(within(absent).getByText("acp-old")).toBeTruthy();
    expect(within(absent).getByRole("button", { name: "Reset: acp-old" })).toBeTruthy();
  });

  it("assigns a picked icon, waits for the RPC and offers a retry on failure while the old icon stays", async () => {
    const pending = deferred<{ providerId: string }>();
    const slot = await renderSettings(empty, { assign: () => pending.promise });
    fireEvent.click(await screen.findByRole("button", { name: "Change icon: Beta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeTruthy();
    expect(slot.inspection.rpcCalls).toContainEqual({
      method: "assign",
      input: { providerId: "acp-beta", source: { builtin: "Calendar" } },
    });
    await act(async () => pending.reject(new Error("server unavailable")));
    expect((await screen.findByRole("alert")).textContent).toContain("server unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(within(screen.getByTestId("row-acp-beta")).getByText(/Original icon/)).toBeTruthy();
  });

  it("sends a dark-only tint without a light key", async () => {
    const slot = await renderSettings(empty, { assign: (input: { providerId: string }) => ({ providerId: input.providerId }) });
    fireEvent.click(await screen.findByRole("button", { name: "Change icon: Alpha" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bot" }));
    const dark = screen.getByRole("textbox", { name: "Dark theme: colour" });
    fireEvent.change(dark, { target: { value: "#4385BE" } });
    fireEvent.blur(dark);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
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

  it("reset calls clear (R4)", async () => {
    const slot = await renderSettings(
      { ...empty, assignments: { "acp-alpha": { source: { builtin: "Bot" } } } },
      { clear: () => ({ cleared: true }) },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reset: Alpha" }));
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "clear", input: { providerId: "acp-alpha" } }));
  });

  it("uploads three files into a new set Team and shows the rejected file with its reason (R7, R9)", async () => {
    const slot = await renderSettings(empty, {
      createSet: () => ({ setId: "s1" }),
      uploadIcons: (input: { files: { fileName: string }[] }) => ({
        accepted: input.files
          .filter((f) => f.fileName !== "bad.svg")
          .map((f) => ({ fileName: f.fileName, iconId: f.fileName, name: f.fileName })),
        rejected: [{ fileName: "bad.svg", reason: "no shapes" }],
      }),
    });
    fireEvent.change(await screen.findByRole("textbox", { name: "New set name" }), { target: { value: "Team" } });
    const files = ["alpha.svg", "beta.svg", "bad.svg"].map(
      (name) => new File(['<svg viewBox="0 0 24 24"><circle r="9"/></svg>'], name, { type: "image/svg+xml" }),
    );
    fireEvent.change(screen.getByLabelText("Upload set"), { target: { files } });
    expect(await screen.findByText("bad.svg: no shapes")).toBeTruthy();
    expect(screen.getByText(/Set "Team": 2 accepted, 1 rejected/)).toBeTruthy();
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
    await screen.findByRole("textbox", { name: "New set name" });
    const file = new File(["<svg/>"], "Agents.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByLabelText("Upload set"), { target: { files: [file] } });
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "createSet", input: { name: "Agents" } }));
  });

  it("renames an icon and confirms deleting an assigned icon with the provider's name (R7, R8)", async () => {
    const slot = await renderSettings(teamSet, {
      setIcons: teamIcons,
      renameIcon: (input: { iconId: string }) => ({ iconId: input.iconId }),
      deleteIcon: () => ({ affected: ["acp-gamma"] }),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Icons" }));
    fireEvent.click(await screen.findByRole("button", { name: "Icon name: b" }));
    const input = screen.getByRole("textbox", { name: "Icon name" });
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({ method: "renameIcon", input: { setId: "s1", iconId: "b", name: "Beta" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete icon a" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/These will get their original icon: Gamma/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({ method: "deleteIcon", input: { setId: "s1", iconId: "a" } }),
    );
  });

  it("confirms deleting a set and names the provider using it (AE3)", async () => {
    const slot = await renderSettings(teamSet, { deleteSet: () => ({ affected: ["acp-gamma"] }) });
    fireEvent.click(await screen.findByRole("button", { name: "Delete set Team" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/These will get their original icon: Gamma/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(slot.inspection.rpcCalls).toContainEqual({ method: "deleteSet", input: { setId: "s1" } }));
  });

  it("shows loading instead of an empty list while state loads", async () => {
    await renderSettings(() => new Promise(() => {}));
    expect(await screen.findByText("Loading…")).toBeTruthy();
    expect(screen.queryByText("No sets")).toBeNull();
  });

  it("shows the error with a retry when state fails", async () => {
    let fail = true;
    await renderSettings(() => {
      if (fail) throw new Error("no connection");
      return empty;
    });
    expect((await screen.findByRole("alert")).textContent).toContain("no connection");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No sets")).toBeTruthy();
  });
});

describe("planUpload", () => {
  const file = (fileName: string, size: number) => ({ fileName, size, read: async () => "" });

  const files = [
    file("big.svg", 40 * 1024),
    file("note.txt", 10),
    ...Array.from({ length: 40 }, (_, i) => file(`i${i}.svg`, 30 * 1024)),
  ];

  it("rejects oversize and non-SVG files locally and batches the rest under 1 MB", () => {
    const plan = planUpload(files, "en");
    expect(plan.tooLarge.map((r) => r.fileName)).toEqual(["big.svg", "note.txt"]);
    expect(plan.tooLarge[0]?.reason).toContain("32 KB");
    expect(plan.tooLarge[1]?.reason).toBe("not an SVG");
    expect(plan.batches.flat()).toHaveLength(40);
    for (const batch of plan.batches) {
      expect(batch.reduce((sum, f) => sum + f.size, 0)).toBeLessThanOrEqual(1024 * 1024);
    }
  });
});

describe("planUpload language", () => {
  const files = [
    { fileName: "big.svg", size: 40 * 1024, read: async () => "" },
    { fileName: "note.txt", size: 10, read: async () => "" },
  ];

  it("words the local rejection reasons in Russian", () => {
    const plan = planUpload(files, "ru");
    expect(plan.tooLarge[0]?.reason).toContain("32 КБ");
    expect(plan.tooLarge[1]?.reason).toBe("не SVG");
  });
});

describe("settings language", () => {
  const withSet = (language?: "en" | "ru"): IconsState => {
    const { language: _drop, ...rest } = { ...teamSet, language: "en" as const };
    return (language ? { ...rest, language } : rest) as IconsState;
  };

  it("is English with language en", async () => {
    await renderSettings(withSet("en"));
    expect(await screen.findByText("Providers")).toBeTruthy();
    expect(screen.getByText("Icon sets")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload set" })).toBeTruthy();
    expect(screen.getByText("2 icons · 1 KB")).toBeTruthy();
    expect(screen.getByText(/Used 0\.0 of/)).toBeTruthy();
  });

  it("is English when the field is absent", async () => {
    await renderSettings(withSet());
    expect(await screen.findByText("Providers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change icon: Alpha" })).toBeTruthy();
  });

  it("is Russian with language ru", async () => {
    await renderSettings(withSet("ru"));
    expect(await screen.findByText(ru.providersTitle)).toBeTruthy();
    expect(screen.getByText("Наборы иконок")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Загрузить набор" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Изменить иконку: Alpha" })).toBeTruthy();
    expect(screen.getByText("2 икон. · 1 КБ")).toBeTruthy();
    expect(screen.getByText(/Занято 0,0 из/)).toBeTruthy();
  });

  it("localizes the confirmation dialog", async () => {
    await renderSettings(withSet("ru"), { deleteSet: () => ({ affected: [] }) });
    fireEvent.click(await screen.findByRole("button", { name: "Удалить набор Team" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Исходную иконку получат: Gamma/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Отмена" })).toBeTruthy();
  });

  it("has the same keys in both languages", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
});
