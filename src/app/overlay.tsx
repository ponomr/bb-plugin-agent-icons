/** Always mounted; the only reader of the `state` RPC on the client. */
import { useEffect } from "react";
import { experimental_useProviders, experimental_useRpcQuery } from "@get-bb/plugin-sdk/app";
import { iconsContract } from "../shared/contract";
import { writeCachedIds } from "./registered-ids";
import { setIconsState, setProviders } from "./store";

export function IconsOverlay() {
  const { data } = experimental_useRpcQuery({ contract: iconsContract, method: "state", input: null });
  const providers = experimental_useProviders();

  useEffect(() => {
    if (!data) return;
    setIconsState(data);
    writeCachedIds(Object.keys(data.assignments));
  }, [data]);

  useEffect(() => {
    if (providers.status === "ready") setProviders(providers.providers);
  }, [providers.status, providers.providers]);

  return null;
}
