/**
 * Server state. Every write goes through one of these functions, which
 * the RPC handlers and the CLI share; each write ends with `onChange`, which
 * the plugin wires to `bb.rpc.experimental_invalidate(["icons"])`.
 *
 * KV layout:
 *   assignments              { "agent:<providerId>": Assignment }
 *   sets:index               SetSummary[]
 *   sets/<setId>             { name, icons: { <iconId>: { name, bytes } } }
 *   icons/<setId>/<iconId>   SvgNode
 */
import { experimental_PluginRpcRefusal as Refusal, type PluginKvStorage } from "@get-bb/plugin-sdk";
import { isBuiltinIcon } from "../shared/builtin-icons";
import {
  iconRef,
  pointsAt,
  type Assignment,
  type IconSource,
  type IconsState,
  type SetIcon,
  type SetSummary,
  type Tint,
  type UploadResult,
} from "../shared/contract";
import { DEFAULT_LANGUAGE, formatMegabytes, type Language } from "../shared/i18n";
import { KV_VALUE_MAX_BYTES, MAX_ICONS_PER_SET, MAX_TOTAL_BYTES } from "../shared/limits";
import type { SvgNode } from "../shared/svg-allowlist";
import { sanitizeSvg } from "./sanitize";
import { strings, type Strings } from "./strings";

const ASSIGNMENTS = "assignments";
const SETS_INDEX = "sets:index";
const setKey = (setId: string) => `sets/${setId}`;
const iconKey = (setId: string, iconId: string) => `icons/${setId}/${iconId}`;
const PROVIDER_PREFIX = "agent:";
const assignmentKey = (providerId: string) => `${PROVIDER_PREFIX}${providerId}`;
const providerIdOf = (key: string) => key.slice(PROVIDER_PREFIX.length);

interface SetRecord {
  name: string;
  icons: Record<string, { name: string; bytes: number }>;
}

type AssignmentMap = Record<string, Assignment>;

export interface UploadFile {
  fileName: string;
  text: string;
}

function refuse(code: "invalid" | "not_found" | "conflict", message: string): never {
  throw new Refusal({ code, message });
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "icon";
}

/** `icons/Team Bot.svg` -> `Team Bot`. */
export function iconNameFromFile(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const name = base.replace(/\.svg$/i, "").trim();
  return (name || "icon").slice(0, 80);
}

function normalizeTint(tint: Tint | undefined): Tint | undefined {
  if (!tint) return undefined;
  const result: Tint = {};
  if (tint.light) result.light = tint.light.toLowerCase();
  if (tint.dark) result.dark = tint.dark.toLowerCase();
  return result.light || result.dark ? result : undefined;
}

function requireIcon(record: SetRecord, iconId: string, t: Strings): SetRecord["icons"][string] {
  if (!Object.hasOwn(record.icons, iconId)) refuse("not_found", t.iconNotInSet);
  return record.icons[iconId]!;
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, "en", { sensitivity: "accent" }) === 0;
}

export class IconStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: PluginKvStorage,
    private readonly onChange: () => void,
    /** Current display language; read per call so a setting change applies at once. */
    readonly language: () => Promise<Language> = async () => DEFAULT_LANGUAGE,
  ) {}

  /** Read-modify-write cycles on shared keys must not interleave. */
  private write<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then((value) => {
      this.onChange();
      return value;
    });
  }

  private async assignments(): Promise<AssignmentMap> {
    return (await this.kv.get<AssignmentMap>(ASSIGNMENTS)) ?? {};
  }

  private async index(): Promise<SetSummary[]> {
    return (await this.kv.get<SetSummary[]>(SETS_INDEX)) ?? [];
  }

  private async strings(): Promise<Strings> {
    return strings(await this.language());
  }

  private async setRecord(setId: string): Promise<SetRecord> {
    const record = await this.kv.get<SetRecord>(setKey(setId));
    if (!record) refuse("not_found", (await this.strings()).setNotFound);
    return record;
  }

  private async saveSet(setId: string, record: SetRecord, index: SetSummary[]): Promise<void> {
    const bytes = Object.values(record.icons).reduce((sum, icon) => sum + icon.bytes, 0);
    const summary: SetSummary = { id: setId, name: record.name, iconCount: Object.keys(record.icons).length, bytes };
    await this.kv.set(setKey(setId), record);
    const next = index.some((s) => s.id === setId)
      ? index.map((s) => (s.id === setId ? summary : s))
      : [...index, summary];
    await this.kv.set(SETS_INDEX, next);
  }

  private async dropAssignments(setId: string, iconId?: string): Promise<string[]> {
    const map = await this.assignments();
    const affected: string[] = [];
    for (const [key, assignment] of Object.entries(map)) {
      if (pointsAt(assignment.source, setId, iconId)) {
        affected.push(providerIdOf(key));
        delete map[key];
      }
    }
    if (affected.length > 0) await this.kv.set(ASSIGNMENTS, map);
    return affected.sort();
  }

  async state(): Promise<IconsState> {
    const [map, sets, language] = await Promise.all([this.assignments(), this.index(), this.language()]);
    const assignments: Record<string, Assignment> = {};
    const setIcons = new Map<string, { set: string; icon: string }>();
    for (const [key, assignment] of Object.entries(map)) {
      if (!key.startsWith(PROVIDER_PREFIX)) continue;
      assignments[providerIdOf(key)] = assignment;
      const source = assignment.source;
      if ("set" in source) setIcons.set(iconRef(source.set, source.icon), source);
    }
    const setIds = [...new Set([...setIcons.values()].map((s) => s.set))];
    const records = new Map(
      await Promise.all(setIds.map(async (id) => [id, await this.kv.get<SetRecord>(setKey(id))] as const)),
    );
    const trees = await Promise.all(
      [...setIcons.values()].map((source) => this.kv.get<SvgNode>(iconKey(source.set, source.icon))),
    );
    const icons: IconsState["icons"] = {};
    [...setIcons].forEach(([ref, source], i) => {
      const meta = records.get(source.set)?.icons[source.icon];
      const tree = trees[i];
      if (meta && tree) icons[ref] = { name: meta.name, tree };
    });
    return { assignments, sets, icons, totalBytes: sets.reduce((sum, s) => sum + s.bytes, 0), language };
  }

  async setIcons(setId: string): Promise<{ id: string; name: string; icons: SetIcon[] }> {
    const record = await this.setRecord(setId);
    const loaded = await Promise.all(
      Object.entries(record.icons).map(async ([id, meta]) => {
        const tree = await this.kv.get<SvgNode>(iconKey(setId, id));
        return tree ? ({ id, name: meta.name, bytes: meta.bytes, tree } satisfies SetIcon) : null;
      }),
    );
    return { id: setId, name: record.name, icons: loaded.filter((icon) => icon !== null) };
  }

  /** For the CLI: icon names of a set without loading the trees. */
  async iconNames(setId: string): Promise<string[]> {
    const record = await this.kv.get<SetRecord>(setKey(setId));
    return record ? Object.values(record.icons).map((meta) => meta.name) : [];
  }

  /** For the CLI: by id, then by name ignoring case. */
  async resolveSet(ref: string): Promise<SetSummary | undefined> {
    const sets = await this.index();
    return sets.find((s) => s.id === ref) ?? sets.find((s) => sameName(s.name, ref));
  }

  /** For the CLI: by id, then by name ignoring case. */
  async resolveIcon(setId: string, ref: string): Promise<string | undefined> {
    const record = await this.kv.get<SetRecord>(setKey(setId));
    if (!record) return undefined;
    if (Object.hasOwn(record.icons, ref)) return ref;
    return Object.entries(record.icons).find(([, meta]) => sameName(meta.name, ref))?.[0];
  }

  assign(providerId: string, source: IconSource, tint?: Tint): Promise<{ providerId: string }> {
    return this.write(async () => {
      if ("builtin" in source) {
        if (!isBuiltinIcon(source.builtin)) refuse("invalid", (await this.strings()).noBuiltinIcon(source.builtin));
      } else {
        requireIcon(await this.setRecord(source.set), source.icon, await this.strings());
      }
      const map = await this.assignments();
      const assignment: Assignment = { source };
      const normalized = normalizeTint(tint);
      if (normalized) assignment.tint = normalized;
      map[assignmentKey(providerId)] = assignment;
      await this.kv.set(ASSIGNMENTS, map);
      return { providerId };
    });
  }

  clear(providerId: string): Promise<{ cleared: boolean }> {
    return this.write(async () => {
      const map = await this.assignments();
      const key = assignmentKey(providerId);
      if (!(key in map)) return { cleared: false };
      delete map[key];
      await this.kv.set(ASSIGNMENTS, map);
      return { cleared: true };
    });
  }

  createSet(name: string): Promise<{ setId: string }> {
    return this.write(async () => {
      const trimmed = name.trim();
      const index = await this.index();
      if (index.some((s) => sameName(s.name, trimmed))) refuse("conflict", (await this.strings()).setExists(trimmed));
      const setId = `s${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      await this.saveSet(setId, { name: trimmed, icons: {} }, index);
      return { setId };
    });
  }

  renameSet(setId: string, name: string): Promise<{ setId: string }> {
    return this.write(async () => {
      const trimmed = name.trim();
      const record = await this.setRecord(setId);
      const index = await this.index();
      if (index.some((s) => s.id !== setId && sameName(s.name, trimmed))) {
        refuse("conflict", (await this.strings()).setExists(trimmed));
      }
      await this.saveSet(setId, { ...record, name: trimmed }, index);
      return { setId };
    });
  }

  /**
   * A file whose name matches an icon already in the set replaces it, so
   * re-importing a folder updates icons in place and keeps their assignments.
   */
  uploadIcons(setId: string, files: UploadFile[]): Promise<UploadResult> {
    return this.write(async () => {
      const record = await this.setRecord(setId);
      const index = await this.index();
      const language = await this.language();
      const t = strings(language);
      let total = index.reduce((sum, s) => sum + s.bytes, 0);
      const result: UploadResult = { accepted: [], rejected: [] };

      for (const file of files) {
        const name = iconNameFromFile(file.fileName);
        const sanitized = sanitizeSvg(file.text, language);
        if (!sanitized.ok) {
          result.rejected.push({ fileName: file.fileName, reason: sanitized.reason });
          continue;
        }
        const existingId = Object.entries(record.icons).find(([, meta]) => sameName(meta.name, name))?.[0];
        const previousBytes = existingId ? record.icons[existingId]!.bytes : 0;
        if (!existingId && Object.keys(record.icons).length >= MAX_ICONS_PER_SET) {
          result.rejected.push({
            fileName: file.fileName,
            reason: t.setFull(MAX_ICONS_PER_SET),
          });
          continue;
        }
        if (sanitized.bytes > KV_VALUE_MAX_BYTES - 1024) {
          result.rejected.push({ fileName: file.fileName, reason: t.iconTooComplex });
          continue;
        }
        if (total - previousBytes + sanitized.bytes > MAX_TOTAL_BYTES) {
          result.rejected.push({
            fileName: file.fileName,
            reason: t.noSpace(formatMegabytes(total, language), formatMegabytes(MAX_TOTAL_BYTES, language)),
          });
          continue;
        }

        let iconId = existingId;
        if (!iconId) {
          const base = slugify(name);
          iconId = base;
          for (let n = 2; Object.hasOwn(record.icons, iconId); n += 1) iconId = `${base}-${n}`;
        }
        await this.kv.set(iconKey(setId, iconId), sanitized.tree);
        record.icons[iconId] = { name, bytes: sanitized.bytes };
        total += sanitized.bytes - previousBytes;
        result.accepted.push({ fileName: file.fileName, iconId, name });
      }

      if (result.accepted.length > 0) await this.saveSet(setId, record, index);
      return result;
    });
  }

  renameIcon(setId: string, iconId: string, name: string): Promise<{ iconId: string }> {
    return this.write(async () => {
      const trimmed = name.trim();
      const record = await this.setRecord(setId);
      const icon = requireIcon(record, iconId, await this.strings());
      if (Object.entries(record.icons).some(([id, meta]) => id !== iconId && sameName(meta.name, trimmed))) {
        refuse("conflict", (await this.strings()).iconExists(trimmed));
      }
      icon.name = trimmed;
      await this.saveSet(setId, record, await this.index());
      return { iconId };
    });
  }

  deleteIcon(setId: string, iconId: string): Promise<{ affected: string[] }> {
    return this.write(async () => {
      const record = await this.setRecord(setId);
      requireIcon(record, iconId, await this.strings());
      const affected = await this.dropAssignments(setId, iconId);
      delete record.icons[iconId];
      await this.saveSet(setId, record, await this.index());
      await this.kv.delete(iconKey(setId, iconId));
      return { affected };
    });
  }

  deleteSet(setId: string): Promise<{ affected: string[] }> {
    return this.write(async () => {
      const record = await this.setRecord(setId);
      const affected = await this.dropAssignments(setId);
      const index = await this.index();
      await this.kv.set(
        SETS_INDEX,
        index.filter((s) => s.id !== setId),
      );
      await this.kv.delete(setKey(setId));
      await Promise.all(Object.keys(record.icons).map((iconId) => this.kv.delete(iconKey(setId, iconId))));
      return { affected };
    });
  }
}
