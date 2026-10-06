import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dms/ui";

/**
 * The one confirmation dialog for operations that cost something to undo.
 *
 * Every `window.confirm` in the app is replaced with this: a native confirm
 * cannot show a busy state, cannot be styled, and blocks the thread while a
 * delete or a stock reversal is in flight — long enough on a slow connection
 * that a second click lands after the first already succeeded. `busy` keeps the
 * dialog open and both buttons disabled until the caller settles.
 *
 * Pages hold the target row in their own state and render one of these, so the
 * dialog wording always names the exact record being confirmed.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape and the overlay click both land here; neither is allowed to
        // dismiss the dialog while the operation is still running.
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className="cursor-pointer"
          >
            {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
