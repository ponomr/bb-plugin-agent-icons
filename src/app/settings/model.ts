/** Pure helpers of the settings page, kept apart from the components so tests can call them. */
import { pointsAt, type IconsState } from "../../shared/contract";
import { tooLargeReason, type Language } from "../../shared/i18n";
import { MAX_FILE_BYTES, MAX_ICONS_PER_SET, UPLOAD_BATCH_BYTES } from "../../shared/limits";
import { strings } from "../strings";
import type { ProviderRecord } from "../store";

export function providerName(providers: readonly ProviderRecord[], id: string): string {
  return providers.find((p) => p.id === id)?.displayName ?? id;
}

/** Providers whose assignment points into the set, or at one icon of it. */
export function affectedProviders(state: IconsState, setId: string, iconId?: string): string[] {
  return Object.entries(state.assignments)
    .filter(([, a]) => pointsAt(a.source, setId, iconId))
    .map(([id]) => id)
    .sort();
}

export function fileBaseName(fileName: string): string {
  return fileName.replace(/\.svg$/i, "").trim();
}

export interface PickedFile {
  fileName: string;
  size: number;
  read: () => Promise<string>;
}

export interface UploadPlan {
  batches: PickedFile[][];
  tooLarge: { fileName: string; reason: string }[];
}

/** Drops oversize files locally and splits the rest into RPC-sized batches. */
export function planUpload(files: readonly PickedFile[], language: Language): UploadPlan {
  const tooLarge: UploadPlan["tooLarge"] = [];
  const batches: PickedFile[][] = [];
  let batch: PickedFile[] = [];
  let bytes = 0;
  for (const file of files) {
    if (!/\.svg$/i.test(file.fileName)) {
      tooLarge.push({ fileName: file.fileName, reason: strings(language).notSvg });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      tooLarge.push({ fileName: file.fileName, reason: tooLargeReason(file.size, language) });
      continue;
    }
    if (batch.length > 0 && (bytes + file.size > UPLOAD_BATCH_BYTES || batch.length >= MAX_ICONS_PER_SET)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(file);
    bytes += file.size;
  }
  if (batch.length > 0) batches.push(batch);
  return { batches, tooLarge };
}

export function errorMessage(error: unknown, language: Language): string {
  return error instanceof Error && error.message ? error.message : strings(language).unknownError;
}
