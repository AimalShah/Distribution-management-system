"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AddCategoryModal({
  onAddCategory,
}: {
  onAddCategory: (name: string, description: string) => Promise<void> | void;
}) {
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCategoryName("");
    setDescription("");
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
   

    setIsLoading(true);
    try {
      await onAddCategory(categoryName.trim(), description.trim());
      toast.success("Category added successfully");
      resetForm();
    } catch (error) {
      console.error("Failed to add category", error);
      toast.error("Failed to add category");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-blue-600 bg-blue-100 hover:text-blue-700"
        >
          <Plus className="h-3 w-3 " />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a new product category that will be available for all
            products.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Category Name
            </label>
            <Input
              placeholder="Enter category name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category Description
            </label>
            <Input
              placeholder="Enter category description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetForm}>
            Cancel
          </Button>
          <Button
            onClick={handleAddCategory}
            disabled={!categoryName.trim() || isLoading}
          >
            {isLoading ? "Adding..." : "Add Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
