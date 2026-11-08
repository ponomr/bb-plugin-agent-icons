import { useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { errorMessage } from "./model";

export interface DeleteRequest {
  title: string;
  /** Display names of providers that lose their icon. */
  affected: string[];
  run: () => Promise<unknown>;
}

/** One confirmation for deleting an icon or a set; names the providers it affects. */
export function ConfirmDelete({ request, onClose }: { request: DeleteRequest | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      await request.run();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !pending) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>
            {request && request.affected.length > 0
              ? `Исходную иконку получат: ${request.affected.join(", ")}.`
              : "Ни один провайдер эту иконку не использует."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Не удалено: {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {pending ? "Удаление…" : error ? "Повторить" : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
