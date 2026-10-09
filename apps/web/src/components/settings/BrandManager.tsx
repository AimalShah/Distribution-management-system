import { useState } from "react";
import useSWR from "swr";
import { Plus, Edit2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Skeleton } from "@dms/ui";
import { api, failureMessage, fetcher } from "../../lib/api";

export interface BrandItem {
  id: string;
  name: string;
  shortCode?: string | null;
}

export function BrandManager() {
  const { data, isLoading, mutate } = useSWR<{ data: BrandItem[] }>(
    "/brands?page=1&pageSize=100",
    fetcher
  );

  const brands = data?.data ?? [];

  const [newName, setNewName] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortCode, setEditShortCode] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    try {
      await api.post("/brands", {
        name: newName.trim(),
        shortCode: newShortCode.trim() || undefined,
      });
      toast.success("Brand created successfully");
      setNewName("");
      setNewShortCode("");
      await mutate();
    } catch (err: unknown) {
      toast.error(failureMessage(err as Error, "Failed to create brand"));
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (b: BrandItem) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditShortCode(b.shortCode ?? "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditShortCode("");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    setIsUpdating(true);
    try {
      await api.put(`/brands/${id}`, {
        name: editName.trim(),
        shortCode: editShortCode.trim() || undefined,
      });
      toast.success("Brand updated successfully");
      cancelEditing();
      await mutate();
    } catch (err: unknown) {
      toast.error(failureMessage(err as Error, "Failed to update brand"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="brand-name" className="text-xs font-medium text-stone-600">
            Brand Name
          </label>
          <Input
            id="brand-name"
            placeholder="e.g. Next Cola"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm w-48"
            disabled={isCreating}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="brand-code" className="text-xs font-medium text-stone-600">
            Short Code (optional)
          </label>
          <Input
            id="brand-code"
            placeholder="e.g. NXC"
            value={newShortCode}
            onChange={(e) => setNewShortCode(e.target.value)}
            className="h-8 text-sm w-32"
            disabled={isCreating}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8"
          disabled={isCreating || !newName.trim()}
        >
          {isCreating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
          Add Brand
        </Button>
      </form>

      {/* Brands list */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2" role="status" aria-label="Loading brands">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : brands.length === 0 ? (
          <div className="p-4 text-center text-sm text-stone-400">
            No brands found. Create one above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100" data-testid="brand-list">
            {brands.map((brand) => (
              <li
                key={brand.id}
                className="flex items-center justify-between p-2.5 text-sm hover:bg-stone-50"
              >
                {editingId === brand.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      aria-label="Edit brand name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs w-44"
                      disabled={isUpdating}
                    />
                    <Input
                      aria-label="Edit brand code"
                      value={editShortCode}
                      onChange={(e) => setEditShortCode(e.target.value)}
                      className="h-7 text-xs w-28"
                      disabled={isUpdating}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-green-600 hover:text-green-700"
                      onClick={() => handleUpdate(brand.id)}
                      disabled={isUpdating || !editName.trim()}
                      aria-label="Save brand"
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-stone-400 hover:text-stone-600"
                      onClick={cancelEditing}
                      disabled={isUpdating}
                      aria-label="Cancel editing"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{brand.name}</span>
                      {brand.shortCode && (
                        <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">
                          {brand.shortCode}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-stone-500 hover:text-stone-700"
                      onClick={() => startEditing(brand)}
                      aria-label={`Rename ${brand.name}`}
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      Rename
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
