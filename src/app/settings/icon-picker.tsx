import { useEffect, useMemo, useState } from "react";
import {
  experimental_Icon as BbIcon,
  experimental_useRpcMutation,
  experimental_useRpcQuery,
} from "@get-bb/plugin-sdk/app";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { cn } from "../../../lib/utils";
import { BUILTIN_ICONS } from "../../shared/builtin-icons";
import { iconRef, iconsContract, type Assignment, type IconSource, type IconsState, type Tint } from "../../shared/contract";
import { assignedArtwork, OriginalIcon } from "../mark";
import { renderTree } from "../render-tree";
import type { ProviderRecord } from "../store";
import { IconGrid, type GridItem } from "./icon-grid";
import { errorMessage } from "./model";
import { TintEditor } from "./tint-editor";

const BUILTIN_TAB = "builtin";

function sourceKey(source: IconSource | undefined): string | undefined {
  if (!source) return undefined;
  return "builtin" in source ? source.builtin : source.icon;
}

function SetTab({
  setId,
  selected,
  onPick,
}: {
  setId: string;
  selected: string | undefined;
  onPick: (iconId: string, name: string, tree: unknown) => void;
}) {
  const query = experimental_useRpcQuery({ contract: iconsContract, method: "setIcons", input: { setId } });
  const items = useMemo<GridItem[]>(
    () =>
      (query.data?.icons ?? []).map((icon) => ({
        id: icon.id,
        name: icon.name,
        render: () => renderTree(icon.tree, { className: "size-6", "aria-hidden": true }),
      })),
    [query.data],
  );
  if (query.error && !query.data) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-sm">
        <p className="text-destructive">Не удалось загрузить набор: {errorMessage(query.error)}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }
  if (!query.data) return <p className="py-6 text-center text-sm text-muted-foreground">Загрузка…</p>;
  return (
    <IconGrid
      items={items}
      selected={selected}
      empty="В наборе нет иконок"
      onSelect={(item) => {
        const icon = query.data?.icons.find((i) => i.id === item.id);
        if (icon) onPick(icon.id, icon.name, icon.tree);
      }}
    />
  );
}

const builtinItems: GridItem[] = BUILTIN_ICONS.map((name) => ({
  id: name,
  name,
  render: () => <BbIcon name={name} fallback="CircleHelp" className="size-6" aria-hidden />,
}));

export function IconPicker({
  provider,
  state,
  open,
  onOpenChange,
}: {
  provider: ProviderRecord | { id: string; displayName?: string };
  state: IconsState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current = state.assignments[provider.id];
  const [source, setSource] = useState<IconSource | undefined>(current?.source);
  const [tint, setTint] = useState<Tint>(current?.tint ?? {});
  const [pickedIcons, setPickedIcons] = useState<IconsState["icons"]>({});
  const [tab, setTab] = useState<string>(current && "set" in current.source ? current.source.set : BUILTIN_TAB);
  const assign = experimental_useRpcMutation({ contract: iconsContract, method: "assign" });

  useEffect(() => {
    if (!open) return;
    setSource(current?.source);
    setTint(current?.tint ?? {});
    setTab(current && "set" in current.source ? current.source.set : BUILTIN_TAB);
    assign.reset();
    // Reset the draft only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft: Assignment | undefined = source
    ? { source, ...(tint.light || tint.dark ? { tint } : {}) }
    : undefined;
  const previewIcons = { ...state.icons, ...pickedIcons };
  const renderPreview = () =>
    (draft && assignedArtwork(draft, { icons: previewIcons }, "size-7")) ?? (
      <OriginalIcon provider={provider} className="size-7" />
    );

  const save = async () => {
    if (!draft) return;
    try {
      await assign.mutate({ providerId: provider.id, source: draft.source, ...(draft.tint ? { tint: draft.tint } : {}) });
      onOpenChange(false);
    } catch {
      // The error is shown from `assign.error`; the dialog stays open for a retry.
    }
  };

  const name = provider.displayName ?? provider.id;
  const tabs = [{ id: BUILTIN_TAB, name: "Встроенные" }, ...state.sets.map((s) => ({ id: s.id, name: s.name }))];

  return (
    <Dialog open={open} onOpenChange={(next) => !assign.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Иконка: {name}</DialogTitle>
          <DialogDescription>{provider.id}</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Наборы иконок" className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-9 shrink-0 rounded-md px-3 text-sm whitespace-nowrap hover:bg-accent",
                tab === t.id && "bg-accent font-medium",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === BUILTIN_TAB ? (
            <IconGrid
              items={builtinItems}
              selected={source && "builtin" in source ? source.builtin : undefined}
              empty=""
              onSelect={(item) => setSource({ builtin: item.id })}
            />
          ) : (
            <SetTab
              key={tab}
              setId={tab}
              selected={source && "set" in source && source.set === tab ? sourceKey(source) : undefined}
              onPick={(iconId, iconName, tree) => {
                setPickedIcons((prev) => ({ ...prev, [iconRef(tab, iconId)]: { name: iconName, tree } }));
                setSource({ set: tab, icon: iconId });
              }}
            />
          )}
        </div>

        <TintEditor tint={tint} onChange={setTint} renderPreview={renderPreview} />

        {assign.error ? (
          <p role="alert" className="text-sm text-destructive">
            Не сохранено: {errorMessage(assign.error)}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={assign.isPending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={!draft || assign.isPending} onClick={() => void save()}>
            {assign.isPending ? "Сохранение…" : assign.error ? "Повторить" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
