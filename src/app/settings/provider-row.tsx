import { useState } from "react";
import { experimental_useRpcMutation } from "@get-bb/plugin-sdk/app";
import { Button } from "../../../components/ui/button";
import { iconsContract, type Assignment, type IconsState } from "../../shared/contract";
import { assignedArtwork, OriginalIcon } from "../mark";
import { isRegisteredAtSetup } from "../registered-ids";
import type { ProviderRecord } from "../store";
import { useLanguage, useStrings, type Strings } from "../strings";
import { IconPicker } from "./icon-picker";
import { errorMessage } from "./model";

function describe(assignment: Assignment | undefined, state: IconsState, s: Strings): string {
  if (!assignment) return s.originalIcon;
  const { source, tint } = assignment;
  let text: string;
  if ("builtin" in source) text = s.builtinSource(source.builtin);
  else {
    const set = state.sets.find((s) => s.id === source.set)?.name ?? source.set;
    const icon = state.icons[`${source.set}/${source.icon}`]?.name ?? source.icon;
    text = `${set} / ${icon}`;
  }
  const colors = [tint?.light && s.lightColor(tint.light), tint?.dark && s.darkColor(tint.dark)].filter(Boolean);
  return colors.length > 0 ? `${text}, ${colors.join(", ")}` : text;
}

export function needsReload(providerId: string, state: IconsState): boolean {
  return providerId in state.assignments && !isRegisteredAtSetup(providerId);
}

export function ProviderRow({
  provider,
  state,
  absent = false,
}: {
  provider: ProviderRecord | { id: string; displayName?: string };
  state: IconsState;
  absent?: boolean;
}) {
  const s = useStrings();
  const language = useLanguage();
  const [picking, setPicking] = useState(false);
  const clear = experimental_useRpcMutation({ contract: iconsContract, method: "clear" });
  const assignment = state.assignments[provider.id];
  const name = provider.displayName ?? provider.id;
  const icon =
    (assignment && assignedArtwork(assignment, state, "size-5")) ?? <OriginalIcon provider={provider} className="size-5" />;

  const reset = () => {
    clear.mutate({ providerId: provider.id }).catch(() => {
      // Shown from `clear.error`.
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-${provider.id}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {provider.id} · {describe(assignment, state, s)}
        </div>
        {needsReload(provider.id, state) ? <div className="text-xs text-amber-600 dark:text-amber-400">{s.reloadNotice}</div> : null}
        {clear.error ? (
          <div role="alert" className="text-xs text-destructive">
            {s.notReset(errorMessage(clear.error, language))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {absent ? null : (
          <Button variant="outline" size="sm" onClick={() => setPicking(true)} aria-label={s.changeIconOf(name)}>
            {s.change}
          </Button>
        )}
        {assignment ? (
          <Button variant="ghost" size="sm" disabled={clear.isPending} onClick={reset} aria-label={s.resetOf(name)}>
            {clear.isPending ? s.resetting : clear.error ? s.retry : s.reset}
          </Button>
        ) : null}
      </div>
      {absent ? null : <IconPicker provider={provider} state={state} open={picking} onOpenChange={setPicking} />}
    </li>
  );
}
