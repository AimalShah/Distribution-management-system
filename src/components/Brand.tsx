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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AddBrandModal({
  categories,
  onAddBrand,
}: {
  categories: { id: string; name: string }[];
  onAddBrand: (
    name: string,
    categoryId: string,
    description: string
  ) => Promise<void> | void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCategoryId("");
    setBrandName("");
    setDescription("");
  };

  const handleAddBrand = async () => {
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }
    if (!brandName.trim()) {
      toast.error("Please enter a brand name");
      return;
    }
   

    setIsLoading(true);
    try {
      await onAddBrand(brandName.trim(), categoryId, description.trim());
      toast.success("Brand added successfully");
      resetForm();
    } catch (error) {
      console.error("Failed to add brand", error);
      toast.error("Failed to add brand");
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
          <Plus className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Brand</DialogTitle>
          <DialogDescription>
            Create a new product brand that will be available for all products.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Brand Name</label>
            <Input
              placeholder="Enter brand name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBrand();
                }
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Brand Description
            </label>
            <Input
              placeholder="Enter brand description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBrand();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddBrand}
            disabled={
              !categoryId || !brandName.trim() || isLoading
            }
          >
            {isLoading ? "Adding..." : "Add Brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
