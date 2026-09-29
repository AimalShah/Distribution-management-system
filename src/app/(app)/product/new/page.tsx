
import { fetchBrands } from "@/actions/brand";
import { fetchCategories } from "@/actions/category";
import ProductForm from "@/components/products/ProductForm";

export default async function MultiProductForm() {
  const categoryData = await fetchCategories();
  const brandsData = await fetchBrands();
  const categoryList = categoryData?.data;
  const brandsList = brandsData?.data;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Products</h1>
          <p className="text-muted-foreground">
            Create multiple products efficiently with bulk operations
          </p>
        </div>
      </div>
      <ProductForm categories={categoryList} brands={brandsList} />
    </div>
  );
}
