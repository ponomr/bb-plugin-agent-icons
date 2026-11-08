import { useRef, useState } from "react";
import { experimental_useRpcMutation, experimental_useRpcQuery } from "@get-bb/plugin-sdk/app";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { iconsContract, type IconsState, type SetSummary } from "../../shared/contract";
import { formatMegabytes } from "../../shared/i18n";
import { MAX_TOTAL_BYTES } from "../../shared/limits";
import { renderTree } from "../render-tree";
import type { ProviderRecord } from "../store";
import { useLanguage, useStrings } from "../strings";
import { ConfirmDelete, type DeleteRequest } from "./confirm-dialog";
import { affectedProviders, errorMessage, fileBaseName, planUpload, providerName, type PickedFile } from "./model";

interface UploadReport {
  setName: string;
  accepted: number;
  rejected: { fileName: string; reason: string }[];
  error?: string;
}

function toPicked(list: FileList | null): PickedFile[] {
  return Array.from(list ?? []).map((file) => ({ fileName: file.name, size: file.size, read: () => file.text() }));
}

function useUpload() {
  const language = useLanguage();
  const createSet = experimental_useRpcMutation({ contract: iconsContract, method: "createSet" });
  const uploadIcons = experimental_useRpcMutation({ contract: iconsContract, method: "uploadIcons" });
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);

  const run = async (files: PickedFile[], target: { setId: string; name: string } | { newName: string }) => {
    const plan = planUpload(files, language);
    const setName = "setId" in target ? target.name : target.newName;
    const next: UploadReport = { setName, accepted: 0, rejected: [...plan.tooLarge] };
    setPending(true);
    setReport(null);
    try {
      if (plan.batches.length === 0) return;
      const setId = "setId" in target ? target.setId : (await createSet.mutate({ name: target.newName })).setId;
      for (const batch of plan.batches) {
        const payload = await Promise.all(batch.map(async (f) => ({ fileName: f.fileName, text: await f.read() })));
        const result = await uploadIcons.mutate({ setId, files: payload });
        next.accepted += result.accepted.length;
        next.rejected.push(...result.rejected);
      }
    } catch (cause) {
      next.error = errorMessage(cause, language);
    } finally {
      setPending(false);
      setReport(next);
    }
  };

  return { run, pending, report };
}

function UploadSummary({ report }: { report: UploadReport }) {
  const s = useStrings();
  return (
    <div className="rounded-md border border-border p-3 text-sm" role="status">
      <p>
        {s.uploadSummary(report.setName, report.accepted, report.rejected.length)}
      </p>
      {report.error ? <p className="text-destructive">{s.uploadInterrupted(report.error)}</p> : null}
      {report.rejected.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {report.rejected.map((r, i) => (
            <li key={`${r.fileName}-${i}`}>
              {r.fileName}: {r.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FilePicker({ label, disabled, onFiles }: { label: string; disabled?: boolean; onFiles: (files: PickedFile[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".svg,image/svg+xml"
        className="hidden"
        aria-label={label}
        onChange={(event) => {
          const files = toPicked(event.target.files);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  );
}

/** Click to rename; saves on Enter or blur, Escape cancels. */
function EditableName({ value, label, onSave }: { value: string; label: string; onSave: (name: string) => Promise<unknown> }) {
  const language = useLanguage();
  const s = useStrings();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const name = text.trim();
    if (!name || name === value) {
      setEditing(false);
      setText(value);
      return;
    }
    try {
      await onSave(name);
      setError(null);
      setEditing(false);
    } catch (cause) {
      setError(errorMessage(cause, language));
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="min-h-9 truncate rounded px-1 text-left text-sm hover:bg-accent"
        aria-label={s.nameOf(label, value)}
        onClick={() => {
          setText(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );
  }
  return (
    <div className="flex min-w-0 flex-col">
      <Input
        autoFocus
        aria-label={label}
        value={text}
        maxLength={80}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") {
            setText(value);
            setError(null);
            setEditing(false);
          }
        }}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function SetIcons({
  set,
  state,
  providers,
  onDelete,
}: {
  set: SetSummary;
  state: IconsState;
  providers: readonly ProviderRecord[];
  onDelete: (request: DeleteRequest) => void;
}) {
  const s = useStrings();
  const language = useLanguage();
  const query = experimental_useRpcQuery({ contract: iconsContract, method: "setIcons", input: { setId: set.id } });
  const renameIcon = experimental_useRpcMutation({ contract: iconsContract, method: "renameIcon" });
  const deleteIcon = experimental_useRpcMutation({ contract: iconsContract, method: "deleteIcon" });

  if (query.error && !query.data) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-destructive">{s.loadItemFailed(errorMessage(query.error, language))}</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {s.retry}
        </Button>
      </div>
    );
  }
  if (!query.data) return <p className="text-sm text-muted-foreground">{s.loading}</p>;
  if (query.data.icons.length === 0) return <p className="text-sm text-muted-foreground">{s.setEmpty}</p>;

  return (
    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {query.data.icons.map((icon) => (
        <li key={icon.id} className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center">
            {renderTree(icon.tree, { className: "size-5", "aria-hidden": true })}
          </span>
          <div className="min-w-0 flex-1">
            <EditableName
              value={icon.name}
              label={s.iconName}
              onSave={(name) => renameIcon.mutate({ setId: set.id, iconId: icon.id, name })}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={s.deleteIconOf(icon.name)}
            onClick={() =>
              onDelete({
                title: s.deleteIconTitle(icon.name),
                affected: affectedProviders(state, set.id, icon.id).map((id) => providerName(providers, id)),
                run: () => deleteIcon.mutate({ setId: set.id, iconId: icon.id }),
              })
            }
          >
            {s.delete}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SetCard({
  set,
  state,
  providers,
  onDelete,
}: {
  set: SetSummary;
  state: IconsState;
  providers: readonly ProviderRecord[];
  onDelete: (request: DeleteRequest) => void;
}) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  const renameSet = experimental_useRpcMutation({ contract: iconsContract, method: "renameSet" });
  const deleteSet = experimental_useRpcMutation({ contract: iconsContract, method: "deleteSet" });
  const upload = useUpload();

  return (
    <li className="flex flex-col gap-2 py-3" data-testid={`set-${set.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <EditableName value={set.name} label={s.setName} onSave={(name) => renameSet.mutate({ setId: set.id, name })} />
          <div className="px-1 text-xs text-muted-foreground">
            {s.setCount(set.iconCount, Math.ceil(set.bytes / 1024))}
          </div>
        </div>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? s.hide : s.show}
        </Button>
        <FilePicker
          label={upload.pending ? s.uploading : s.addFiles}
          disabled={upload.pending}
          onFiles={(files) => void upload.run(files, { setId: set.id, name: set.name })}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={s.deleteSetOf(set.name)}
          onClick={() =>
            onDelete({
              title: s.deleteSetTitle(set.name),
              affected: affectedProviders(state, set.id).map((id) => providerName(providers, id)),
              run: () => deleteSet.mutate({ setId: set.id }),
            })
          }
        >
          {s.delete}
        </Button>
      </div>
      {upload.report ? <UploadSummary report={upload.report} /> : null}
      {open ? <SetIcons set={set} state={state} providers={providers} onDelete={onDelete} /> : null}
    </li>
  );
}

export function SetsManager({ state, providers }: { state: IconsState; providers: readonly ProviderRecord[] }) {
  const s = useStrings();
  const language = useLanguage();
  const [name, setName] = useState("");
  const [request, setRequest] = useState<DeleteRequest | null>(null);
  const upload = useUpload();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {s.usage(formatMegabytes(state.totalBytes, language), formatMegabytes(MAX_TOTAL_BYTES, language))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          aria-label={s.newSetName}
          placeholder={s.newSetPlaceholder}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <FilePicker
          label={upload.pending ? s.uploading : s.uploadSet}
          disabled={upload.pending}
          onFiles={(files) => {
            const newName = name.trim() || fileBaseName(files[0]!.fileName) || s.defaultSetName;
            void upload.run(files, { newName }).then(() => setName(""));
          }}
        />
      </div>
      {upload.report ? <UploadSummary report={upload.report} /> : null}
      {state.sets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{s.noSets}</p>
      ) : (
        <ul className="divide-y divide-border">
          {state.sets.map((set) => (
            <SetCard key={set.id} set={set} state={state} providers={providers} onDelete={setRequest} />
          ))}
        </ul>
      )}
      <ConfirmDelete request={request} onClose={() => setRequest(null)} />
    </div>
  );
}
