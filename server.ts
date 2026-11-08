import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createCli } from "./src/server/cli";
import { IconStore } from "./src/server/state";
import { ICONS_TAG, iconsContract } from "./src/shared/contract";

export default async function plugin(bb: BbPluginApi) {
  const store = new IconStore(bb.storage.kv, () => bb.rpc.experimental_invalidate([ICONS_TAG]));

  bb.rpc.register(iconsContract, {
    state: () => store.state(),
    setIcons: ({ setId }) => store.setIcons(setId),
    assign: ({ providerId, source, tint }) => store.assign(providerId, source, tint),
    clear: ({ providerId }) => store.clear(providerId),
    createSet: ({ name }) => store.createSet(name),
    renameSet: ({ setId, name }) => store.renameSet(setId, name),
    uploadIcons: ({ setId, files }) => store.uploadIcons(setId, files),
    renameIcon: ({ setId, iconId, name }) => store.renameIcon(setId, iconId, name),
    deleteIcon: ({ setId, iconId }) => store.deleteIcon(setId, iconId),
    deleteSet: ({ setId }) => store.deleteSet(setId),
  });

  bb.cli.register(createCli(store, () => bb.sdk.providers.list()));
}
