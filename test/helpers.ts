import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";
import type { IconsState, UploadResult } from "../src/shared/contract";

export const tinySvg = (n = 0) => `<svg viewBox="0 0 24 24"><circle cx="${n % 24}" cy="12" r="9"/></svg>`;

/** A valid icon whose stored tree is close to `kb` kilobytes. */
export function bulkySvg(kb: number, seed = 0): string {
  const segments: string[] = [];
  let length = 0;
  for (let i = 0; length < kb * 1024 - 200; i += 1) {
    const segment = `L${(i + seed) % 997} ${(i * 7) % 991} `;
    segments.push(segment);
    length += segment.length;
  }
  return `<svg viewBox="0 0 1000 1000"><path d="M0 0 ${segments.join("")}z"/></svg>`;
}

export async function setup(providers: { id: string; displayName: string }[] = []) {
  const { bb, harness } = createFakePluginHost({
    pluginId: "agent-icons",
    sdk: { providers: { list: async () => providers } },
  });
  await plugin(bb);
  const call = <T>(method: string, input: unknown = null) => harness.behavior.callRpc(method, input) as Promise<T>;
  return {
    bb,
    harness,
    call,
    state: () => call<IconsState>("state"),
    createSet: async (name: string) => (await call<{ setId: string }>("createSet", { name })).setId,
    upload: (setId: string, files: { fileName: string; text: string }[]) =>
      call<UploadResult>("uploadIcons", { setId, files }),
    invalidations: () => harness.inspection.experimental_rpcInvalidations,
  };
}
