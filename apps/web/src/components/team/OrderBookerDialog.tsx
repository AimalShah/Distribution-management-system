import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@dms/ui";

export interface OrderBookerRecord {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  isActive: boolean;
}

interface OrderBookerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booker: OrderBookerRecord | null;
  onSubmit: (data: { code: string; name: string; phone?: string; isActive?: boolean }) => Promise<void>;
}

export function OrderBookerDialog({
  open,
  onOpenChange,
  booker,
  onSubmit,
}: OrderBookerDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booker) {
      setCode(booker.code);
      setName(booker.name);
      setPhone(booker.phone ?? "");
      setIsActive(booker.isActive);
    } else {
      setCode("");
      setName("");
      setPhone("");
      setIsActive(true);
    }
    setError(null);
  }, [booker, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Code is required");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        code: code.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        isActive,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save order booker";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {booker ? "Edit Order Booker" : "Add Order Booker"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="booker-code">Code</Label>
            <Input
              id="booker-code"
              placeholder="e.g. OB-001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booker-name">Name</Label>
            <Input
              id="booker-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booker-phone">Phone</Label>
            <Input
              id="booker-phone"
              placeholder="e.g. 555-0199"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="booker-active" className="cursor-pointer">
              Active status
            </Label>
            <Switch
              id="booker-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={busy}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
