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
import { MAX_FILE_BYTES, tooLargeReason } from "../shared/limits";
import type { IconStore, UploadFile } from "./state";

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

function parseColor(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = colorSchema.safeParse(value);
  if (!parsed.success) throw new PluginCliError(`${flag}: цвет должен быть в виде #rrggbb`, { code: "invalid" });
  return parsed.data;
}

function describeSource(source: IconSource, state: IconsState): string {
  if ("builtin" in source) return `builtin:${source.builtin}`;
  const set = state.sets.find((s) => s.id === source.set);
  const icon = state.icons[iconRef(source.set, source.icon)];
  return `${set?.name ?? source.set}/${icon?.name ?? source.icon}`;
}

function describe(assignment: Assignment, state: IconsState): string {
  const parts = [describeSource(assignment.source, state)];
  if (assignment.tint?.light) parts.push(`светлая ${assignment.tint.light}`);
  if (assignment.tint?.dark) parts.push(`тёмная ${assignment.tint.dark}`);
  return parts.join(", ");
}

function formatList(
  state: IconsState,
  providers: ProviderSummary[] | null,
  iconNames: ReadonlyMap<string, string[]>,
): string {
  const lines: string[] = [];
  const known = new Set(providers?.map((p) => p.id) ?? []);
  if (providers) {
    lines.push("Провайдеры:");
    for (const p of providers) {
      const assignment = state.assignments[p.id];
      lines.push(`  ${p.id} (${p.displayName}): ${assignment ? describe(assignment, state) : "исходная иконка"}`);
    }
  } else {
    lines.push("Список провайдеров bb недоступен; показаны только назначения.");
  }
  const absent = Object.keys(state.assignments)
    .filter((id) => !known.has(id))
    .sort();
  if (absent.length > 0) {
    lines.push(providers ? "Нет в bb:" : "Назначения:");
    for (const id of absent) lines.push(`  ${id}: ${describe(state.assignments[id]!, state)}`);
  }
  lines.push("Наборы:");
  if (state.sets.length === 0) lines.push("  нет");
  for (const s of state.sets) {
    lines.push(`  ${s.name} (${s.id}): ${s.iconCount} икон., ${Math.ceil(s.bytes / 1024)} КБ`);
    const names = iconNames.get(s.id) ?? [];
    if (names.length > 0) lines.push(`    ${names.join(", ")}`);
  }
  lines.push(`Встроенные (builtin:<Имя>): ${BUILTIN_ICONS.join(", ")}`);
  return lines.join("\n");
}

async function readSvgDir(dir: string): Promise<{ files: UploadFile[]; skipped: { fileName: string; reason: string }[] }> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new PluginCliError(`папка не найдена: ${dir}`, { code: "not_found" });
  }
  const files: UploadFile[] = [];
  const skipped: { fileName: string; reason: string }[] = [];
  for (const name of entries.filter((n) => n.toLowerCase().endsWith(".svg")).sort()) {
    const path = join(dir, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    if (info.size > MAX_FILE_BYTES) {
      skipped.push({ fileName: name, reason: tooLargeReason(info.size) });
      continue;
    }
    files.push({ fileName: name, text: await readFile(path, "utf8") });
  }
  return { files, skipped };
}

export function createCli(store: IconStore, listProviders: () => Promise<ProviderSummary[]>): PluginCliRegistration {
  return defineCli({
    name: "agent-icons",
    summary: "Иконки и цвета агентов в bb",
    description: "Назначения общие для всех устройств; изменения видны сразу на открытых страницах bb.",
    commands: {
      list: cliCommand({
        summary: "Показать провайдеров, их назначения и наборы иконок",
        options: { json: { type: "boolean", description: "Вывести состояние в JSON" } },
        async run({ options }) {
          const state = await store.state();
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
          return { exitCode: 0, stdout: formatList(state, providers, iconNames) };
        },
      }),

      assign: cliCommand({
        summary: "Назначить провайдеру иконку",
        description:
          "Иконка: builtin:<Имя> (например builtin:Calendar) или <набор>/<иконка>, где набор и иконку можно указать по id или по имени.",
        positionals: [
          { name: "providerId", description: "id провайдера, например acp-beta", required: true },
          { name: "icon", description: "builtin:<Имя> или <набор>/<иконка>", required: true },
        ],
        options: {
          light: { type: "string", description: "Цвет в светлой теме, #rrggbb", placeholder: "#hex" },
          dark: { type: "string", description: "Цвет в тёмной теме, #rrggbb", placeholder: "#hex" },
        },
        async run({ positionals, options }) {
          const providerId = providerIdSchema.safeParse(positionals.providerId);
          if (!providerId.success) throw new PluginCliError("недопустимый id провайдера", { code: "invalid" });
          const light = parseColor(options.light, "--light");
          const dark = parseColor(options.dark, "--dark");
          const ref = positionals.icon;

          let source: IconSource;
          if (ref.startsWith("builtin:")) {
            source = { builtin: ref.slice("builtin:".length) };
          } else {
            const slash = ref.indexOf("/");
            if (slash <= 0 || slash === ref.length - 1) {
              throw new PluginCliError("иконка задаётся как builtin:<Имя> или <набор>/<иконка>", { code: "invalid" });
            }
            const set = await store.resolveSet(ref.slice(0, slash));
            if (!set) throw new PluginCliError(`набор «${ref.slice(0, slash)}» не найден`, { code: "not_found" });
            const iconId = await store.resolveIcon(set.id, ref.slice(slash + 1));
            if (!iconId) {
              throw new PluginCliError(`иконки «${ref.slice(slash + 1)}» нет в наборе «${set.name}»`, { code: "not_found" });
            }
            source = { set: set.id, icon: iconId };
          }

          const tint = light || dark ? { ...(light && { light }), ...(dark && { dark }) } : undefined;
          await guard(() => store.assign(providerId.data, source, tint));
          return {
            exitCode: 0,
            stdout: `${providerId.data}: назначено ${ref}. Если провайдер ещё не встречался на устройстве, перезагрузите страницу bb.`,
          };
        },
      }),

      clear: cliCommand({
        summary: "Вернуть провайдеру его иконку",
        positionals: [{ name: "providerId", description: "id провайдера", required: true }],
        async run({ positionals }) {
          const { cleared } = await guard(() => store.clear(positionals.providerId));
          return {
            exitCode: 0,
            stdout: cleared ? `${positionals.providerId}: назначение снято` : `${positionals.providerId}: назначения не было`,
          };
        },
      }),

      "import-set": cliCommand({
        summary: "Загрузить папку SVG как набор",
        description:
          "Создаёт набор с этим именем или дополняет существующий. Файл с тем же именем иконки заменяет её, назначения сохраняются.",
        positionals: [
          { name: "name", description: "Имя набора", required: true },
          { name: "dir", description: "Папка с файлами .svg", required: true },
        ],
        async run({ positionals }, ctx) {
          const dir = resolve(ctx.cwd ?? process.cwd(), positionals.dir);
          const { files, skipped } = await readSvgDir(dir);
          if (files.length === 0 && skipped.length === 0) {
            throw new PluginCliError(`в папке нет файлов .svg: ${dir}`, { code: "not_found" });
          }
          const name = positionals.name.trim();
          if (!name) throw new PluginCliError("имя набора не может быть пустым", { code: "invalid" });
          const existing = await store.resolveSet(name);
          const setId = existing?.id ?? (await guard(() => store.createSet(name))).setId;
          const result =
            files.length > 0 ? await guard(() => store.uploadIcons(setId, files)) : { accepted: [], rejected: [] };
          const rejected = [...skipped, ...result.rejected];
          const lines = [`Набор «${existing?.name ?? name}»: принято ${result.accepted.length}, отклонено ${rejected.length}`];
          for (const r of rejected) lines.push(`  ${r.fileName}: ${r.reason}`);
          return { exitCode: result.accepted.length === 0 ? 1 : 0, stdout: lines.join("\n") };
        },
      }),
    },
  });
}
