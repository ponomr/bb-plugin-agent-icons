/**
 * Which provider ids get a mark. bb reads registrations once, at
 * `setup`, so the ids come from a localStorage cache that the overlay keeps
 * in sync with the server's assignments, plus the providers bb ships.
 * A new id therefore needs one app reload on each device.
 */
import { PROVIDER_ID_PATTERN } from "../shared/contract";
import { BUILTIN_PROVIDER_IDS } from "../shared/builtin-icons";

export const IDS_KEY = "agent-icons:assigned-ids";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Assigned ids remembered on this device; corrupt or missing data reads as none. */
export function readCachedIds(): string[] {
  try {
    const value: unknown = JSON.parse(storage()?.getItem(IDS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((id): id is string => typeof id === "string" && PROVIDER_ID_PATTERN.test(id));
  } catch {
    return [];
  }
}

export function writeCachedIds(ids: readonly string[]): void {
  const next = JSON.stringify([...new Set(ids)].filter((id) => PROVIDER_ID_PATTERN.test(id)).sort());
  try {
    const store = storage();
    if (store && store.getItem(IDS_KEY) !== next) store.setItem(IDS_KEY, next);
  } catch {
    // Private mode or a full quota: marks still work for ids already registered.
  }
}

/** Every id to register: the shipped providers plus the cached ones. */
export function idsToRegister(): string[] {
  return [...new Set<string>([...BUILTIN_PROVIDER_IDS, ...readCachedIds()])];
}

let registeredAtSetup: ReadonlySet<string> = new Set();

/** Called once by `setup`; the settings page uses it for reload notices. */
export function captureRegisteredIds(): string[] {
  const ids = idsToRegister();
  registeredAtSetup = new Set(ids);
  return ids;
}

export function isRegisteredAtSetup(providerId: string): boolean {
  return registeredAtSetup.has(providerId);
}
