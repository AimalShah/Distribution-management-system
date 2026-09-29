# Checkpoint 2b — Purchase API: Plan

## Goal

Create Express router for purchases with inventory side effects.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchases` | List purchases (paginated) |
| GET | `/api/purchases/:id` | Get single purchase |
| POST | `/api/purchases` | Create purchase (with inventory updates) |
| PUT | `/api/purchases/:id` | Update purchase |
| DELETE | `/api/purchases/:id` | Delete purchase |

## Implementation

### Route: `apps/server/src/routes/purchase.ts`

Key considerations:
- `createPurchase` must be atomic — use Prisma `$transaction` to wrap purchase + items + inventory updates
- Inventory IN movement for each item
- InventoryLog entries for each inventory change
- Org scoping on all queries

```typescript
// POST /api/purchases — create with inventory updates
router.post("/", async (req, res) => {
  const data = PurchaseFormSchema.parse(req.body);
  const orgId = req.auth.organizationId;
  const userId = req.auth.userId;

  const purchase = await prisma.$transaction(async (tx) => {
    // Create purchase
    const purchase = await tx.purchase.create({
      data: {
        purchaseCode: data.purchaseCode,
        supplierId: data.supplierId,
        purchaseDate: data.purchaseDate,
        status: data.status,
        discount: data.discount,
        taxAmount: data.taxAmount,
        organizationId: orgId,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.unitCost * item.quantity,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            taxPercent: item.taxPercent,
            discount: item.itemDiscount,
          })),
        },
      },
      include: { items: true, supplier: true },
    });

    // Update inventory for each item
    for (const item of data.items) {
      const inventory = await tx.inventory.findUnique({
        where: { productId: item.productId },
      });
      if (inventory) {
        const newQty = inventory.quantityOnHand + item.quantity;
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantityOnHand: newQty },
        });
        await tx.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            productId: item.productId,
            userId: userId,
            movementType: "IN",
            quantity: item.quantity,
            previousQty: inventory.quantityOnHand,
            newQty: newQty,
            reason: `Purchase ${data.purchaseCode}`,
            reference: purchase.id,
          },
        });
      }
    }

    return purchase;
  });

  res.status(201).json(purchase);
});
```

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Transaction wrapping** — original code didn't use explicit transactions; Express version does for safety
3. **Auth middleware** — replaces session-based user/org lookup
