/**
 * Module store shared by the overlay, the marks and the settings page.
 * Only the overlay fetches; marks read this store and never load anything.
 */
import { useSyncExternalStore } from "react";
import type { experimental_useProviders } from "@get-bb/plugin-sdk/app";
import type { IconsState } from "../shared/contract";

export type ProviderRecord = ReturnType<typeof experimental_useProviders>["providers"][number];

export interface IconsSnapshot {
  state: IconsState | null;
  providers: readonly ProviderRecord[];
}

let snapshot: IconsSnapshot = { state: null, providers: [] };
const listeners = new Set<() => void>();

function publish(next: IconsSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setIconsState(state: IconsState | null): void {
  if (state !== snapshot.state) publish({ ...snapshot, state });
}

export function setProviders(providers: readonly ProviderRecord[]): void {
  if (providers !== snapshot.providers) publish({ ...snapshot, providers });
}

export function getIconsSnapshot(): IconsSnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIconsSnapshot(): IconsSnapshot {
  return useSyncExternalStore(subscribe, getIconsSnapshot, getIconsSnapshot);
}

/** Test helper: back to the empty store. */
export function resetIconsStore(): void {
  publish({ state: null, providers: [] });
}
