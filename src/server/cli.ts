/**
 * `bb agent-icons …`. Calls the same IconStore as the RPC handlers, so
 * every change invalidates the settings page and marks live.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  cliCommand,
  defineCli,
  experimental_PluginRpcRefusal as Refusal,
  PluginCliError,
  type PluginCliRegistration,
} from "@get-bb/plugin-sdk";
import { colorSchema, iconRef, providerIdSchema, type Assignment, type IconSource, type IconsState } from "../shared/contract";
import { BUILTIN_ICONS } from "../shared/builtin-icons";
import { tooLargeReason, type Language } from "../shared/i18n";
import { MAX_FILE_BYTES } from "../shared/limits";
import type { IconStore, UploadFile } from "./state";
import { strings, type Strings } from "./strings";

export interface ProviderSummary {
  id: string;
  displayName: string;
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof Refusal) throw new PluginCliError(cause.message, { code: cause.code });
    throw cause;
  }
}

function parseColor(value: string | undefined, flag: string, t: Strings): string | undefined {
  if (value === undefined) return undefined;
  const parsed = colorSchema.safeParse(value);
  if (!parsed.success) throw new PluginCliError(t.colorFormat(flag), { code: "invalid" });
  return parsed.data;
}

function describeSource(source: IconSource, state: IconsState): string {
  if ("builtin" in source) return `builtin:${source.builtin}`;
  const set = state.sets.find((s) => s.id === source.set);
  const icon = state.icons[iconRef(source.set, source.icon)];
  return `${set?.name ?? source.set}/${icon?.name ?? source.icon}`;
}

function describe(assignment: Assignment, state: IconsState, t: Strings): string {
  const parts = [describeSource(assignment.source, state)];
  if (assignment.tint?.light) parts.push(t.tintLight(assignment.tint.light));
  if (assignment.tint?.dark) parts.push(t.tintDark(assignment.tint.dark));
  return parts.join(", ");
}

function formatList(
  state: IconsState,
  providers: ProviderSummary[] | null,
  iconNames: ReadonlyMap<string, string[]>,
  t: Strings,
): string {
  const lines: string[] = [];
  const known = new Set(providers?.map((p) => p.id) ?? []);
  if (providers) {
    lines.push(t.providersHeading);
    for (const p of providers) {
      const assignment = state.assignments[p.id];
      lines.push(`  ${p.id} (${p.displayName}): ${assignment ? describe(assignment, state, t) : t.originalIcon}`);
    }
  } else {
    lines.push(t.providersUnavailable);
  }
  const absent = Object.keys(state.assignments)
    .filter((id) => !known.has(id))
    .sort();
  if (absent.length > 0) {
    lines.push(providers ? t.notInBb : t.assignmentsHeading);
    for (const id of absent) lines.push(`  ${id}: ${describe(state.assignments[id]!, state, t)}`);
  }
  lines.push(t.setsHeading);
  if (state.sets.length === 0) lines.push(`  ${t.none}`);
  for (const s of state.sets) {
    lines.push(`  ${t.setLine(s.name, s.id, s.iconCount, Math.ceil(s.bytes / 1024))}`);
    const names = iconNames.get(s.id) ?? [];
    if (names.length > 0) lines.push(`    ${names.join(", ")}`);
  }
  lines.push(t.builtinsLine(BUILTIN_ICONS.join(", ")));
  return lines.join("\n");
}

async function readSvgDir(dir: string, language: Language): Promise<{ files: UploadFile[]; skipped: { fileName: string; reason: string }[] }> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new PluginCliError(strings(language).folderNotFound(dir), { code: "not_found" });
  }
  const files: UploadFile[] = [];
  const skipped: { fileName: string; reason: string }[] = [];
  for (const name of entries.filter((n) => n.toLowerCase().endsWith(".svg")).sort()) {
    const path = join(dir, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    if (info.size > MAX_FILE_BYTES) {
      skipped.push({ fileName: name, reason: tooLargeReason(info.size, language) });
      continue;
    }
    files.push({ fileName: name, text: await readFile(path, "utf8") });
  }
  return { files, skipped };
}

export function createCli(store: IconStore, listProviders: () => Promise<ProviderSummary[]>): PluginCliRegistration {
  return defineCli({
    name: "agent-icons",
    summary: "Agent icons and colors in bb",
    description: "Assignments are shared by all devices; changes show at once on open bb pages.",
    commands: {
      list: cliCommand({
        summary: "Show providers, their assignments and icon sets",
        options: { json: { type: "boolean", description: "Print the state as JSON" } },
        async run({ options }) {
          const state = await store.state();
          const t = strings(state.language);
          let providers: ProviderSummary[] | null = null;
          try {
            providers = (await listProviders()).map((p) => ({ id: p.id, displayName: p.displayName }));
          } catch {
            providers = null;
          }
          const iconNames = new Map(
            await Promise.all(state.sets.map(async (s) => [s.id, await store.iconNames(s.id)] as const)),
          );
          if (options.json) {
            const { icons: _icons, sets, ...rest } = state;
            const withNames = sets.map((s) => ({ ...s, iconNames: iconNames.get(s.id) ?? [] }));
            return {
              exitCode: 0,
              stdout: JSON.stringify({ ...rest, sets: withNames, builtins: BUILTIN_ICONS, providers }, null, 2),
            };
          }
          return { exitCode: 0, stdout: formatList(state, providers, iconNames, t) };
        },
      }),

      assign: cliCommand({
        summary: "Assign an icon to a provider",
        description:
          "Icon: builtin:<Name> (for example builtin:Calendar) or <set>/<icon>, where the set and the icon can be given by id or by name.",
        positionals: [
          { name: "providerId", description: "provider id, for example acp-beta", required: true },
          { name: "icon", description: "builtin:<Name> or <set>/<icon>", required: true },
        ],
        options: {
          light: { type: "string", description: "Color in the light theme, #rrggbb", placeholder: "#hex" },
          dark: { type: "string", description: "Color in the dark theme, #rrggbb", placeholder: "#hex" },
        },
        async run({ positionals, options }) {
          const t = strings(await store.language());
          const providerId = providerIdSchema.safeParse(positionals.providerId);
          if (!providerId.success) throw new PluginCliError(t.invalidProviderId, { code: "invalid" });
          const light = parseColor(options.light, "--light", t);
          const dark = parseColor(options.dark, "--dark", t);
          const ref = positionals.icon;

          let source: IconSource;
          if (ref.startsWith("builtin:")) {
            source = { builtin: ref.slice("builtin:".length) };
          } else {
            const slash = ref.indexOf("/");
            if (slash <= 0 || slash === ref.length - 1) {
              throw new PluginCliError(t.iconSyntax, { code: "invalid" });
            }
            const set = await store.resolveSet(ref.slice(0, slash));
            if (!set) throw new PluginCliError(t.setNamedNotFound(ref.slice(0, slash)), { code: "not_found" });
            const iconId = await store.resolveIcon(set.id, ref.slice(slash + 1));
            if (!iconId) {
              throw new PluginCliError(t.iconNotInNamedSet(ref.slice(slash + 1), set.name), { code: "not_found" });
            }
            source = { set: set.id, icon: iconId };
          }

          const tint = light || dark ? { ...(light && { light }), ...(dark && { dark }) } : undefined;
          await guard(() => store.assign(providerId.data, source, tint));
          return {
            exitCode: 0,
            stdout: t.assigned(providerId.data, ref),
          };
        },
      }),

      clear: cliCommand({
        summary: "Restore the provider's own icon",
        positionals: [{ name: "providerId", description: "provider id", required: true }],
        async run({ positionals }) {
          const t = strings(await store.language());
          const { cleared } = await guard(() => store.clear(positionals.providerId));
          return {
            exitCode: 0,
            stdout: cleared ? t.assignmentCleared(positionals.providerId) : t.noAssignment(positionals.providerId),
          };
        },
      }),

      "import-set": cliCommand({
        summary: "Import a folder of SVG files as a set",
        description:
          "Creates a set with this name or adds to an existing one. A file with the same icon name replaces that icon and keeps its assignments.",
        positionals: [
          { name: "name", description: "Set name", required: true },
          { name: "dir", description: "Folder with .svg files", required: true },
        ],
        async run({ positionals }, ctx) {
          const language = await store.language();
          const t = strings(language);
          const dir = resolve(ctx.cwd ?? process.cwd(), positionals.dir);
          const { files, skipped } = await readSvgDir(dir, language);
          if (files.length === 0 && skipped.length === 0) {
            throw new PluginCliError(t.noSvgInFolder(dir), { code: "not_found" });
          }
          const name = positionals.name.trim();
          if (!name) throw new PluginCliError(t.emptySetName, { code: "invalid" });
          const existing = await store.resolveSet(name);
          const setId = existing?.id ?? (await guard(() => store.createSet(name))).setId;
          const result =
            files.length > 0 ? await guard(() => store.uploadIcons(setId, files)) : { accepted: [], rejected: [] };
          const rejected = [...skipped, ...result.rejected];
          const lines = [t.importSummary(existing?.name ?? name, result.accepted.length, rejected.length)];
          for (const r of rejected) lines.push(`  ${r.fileName}: ${r.reason}`);
          return { exitCode: result.accepted.length === 0 ? 1 : 0, stdout: lines.join("\n") };
        },
      }),
    },
  });
}
