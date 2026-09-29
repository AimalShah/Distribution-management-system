import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchInventory } from "@/actions/inventory";

export default async function InventoryManagement() {
  const inventory = await fetchInventory();
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Inventory Management</h1>
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="logs">Movement Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Product Code</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>CreatedAt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory?.data?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.product.productCode}</TableCell>
                    <TableCell>{item.quantityOnHand}</TableCell>
                    <TableCell>{item.quantityReserved}</TableCell>
                    <TableCell>
                      {item.quantityOnHand - item.quantityReserved}
                    </TableCell>
                    <TableCell>{item.reorderLevel}</TableCell>
                    <TableCell>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Movement Type</TableHead>
                  <TableHead>Opening Qty</TableHead>

                  <TableHead>Quantity</TableHead>
                  <TableHead>Closing Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  inventory?.data?.flatMap((inv) =>
                    inv.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{inv.product.name}</TableCell>
                        <TableCell>{log.movementType}</TableCell>
                        <TableCell>{log.previousQty}</TableCell>
                        <TableCell
                          className={
                            log.quantity > 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {log.quantity}
                        </TableCell>

                        <TableCell>{log.newQty}</TableCell>
                        <TableCell>{log.reason}</TableCell>
                        <TableCell>{log.reference}</TableCell>
                        <TableCell>
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
