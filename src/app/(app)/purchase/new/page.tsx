
import { fetchProducts } from "@/actions/product";
import { fetchSuppliers } from "@/actions/supplier";
import PurchaseForm from "@/components/PurchaseForm";

const statusOptions = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export default async function PurchasePage() {
  const productData = await fetchProducts();
  const suppliersData = await fetchSuppliers();
  const products = productData?.data;
  const suppliers = suppliersData?.data;
  return (
    <div className="mx-auto p-4 space-y-4">
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        statusOptions={statusOptions}
      />
    </div>
  );
}
