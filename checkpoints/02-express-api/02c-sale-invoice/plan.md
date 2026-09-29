# Checkpoint 2c — Sale Invoice API: Plan

## Goal

Create Express router for sale invoices with inventory deduction side effects.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sales` | List sales (paginated) |
| GET | `/api/sales/:id` | Get single sale (by ID or saleCode) |
| GET | `/api/sales/customer/:customerId` | Get sales by customer |
| POST | `/api/sales` | Create sale (with inventory deduction) |
| PUT | `/api/sales/:id` | Update sale |
| DELETE | `/api/sales/:id` | Delete sale |

## Implementation

### Route: `apps/server/src/routes/sale.ts`

Key considerations:
- `createSaleInvoice` uses `$transaction` for atomicity
- Inventory OUT movement for each item
- Support lookup by both `id` and `saleCode`
- Org scoping

```typescript
// POST /api/sales — create with inventory deduction
router.post("/", async (req, res) => {
  const data = SaleInvoiceSchema.parse(req.body);
  const orgId = req.auth.organizationId;
  const userId = req.auth.userId;

  const sale = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        saleCode: data.saleCode,
        customerId: data.customerId,
        status: data.status,
        discount: data.discount,
        taxAmount: data.taxAmount,
        organizationId: orgId,
        items: {
          create: data.saleItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            taxPercent: item.taxPercent,
          })),
        },
      },
      include: { items: true, customer: true },
    });

    for (const item of data.saleItems) {
      const inventory = await tx.inventory.findUnique({
        where: { productId: item.productId },
      });
      if (inventory) {
        const newQty = inventory.quantityOnHand - item.quantity;
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantityOnHand: newQty },
        });
        await tx.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            productId: item.productId,
            userId: userId,
            movementType: "OUT",
            quantity: item.quantity,
            previousQty: inventory.quantityOnHand,
            newQty: newQty,
            reason: `Sale ${data.saleCode}`,
            reference: sale.id,
          },
        });
      }
    }

    return sale;
  });

  res.status(201).json(sale);
});

// GET /api/sales/:id — supports both ID and saleCode
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const orgId = req.auth.organizationId;
  
  const sale = await prisma.sale.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id }, { saleCode: id }],
    },
    include: { items: true, customer: true },
  });
  
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  res.json(sale);
});
```

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Transaction wrapping** — for atomicity
3. **Dual lookup** — `:id` param matches both `id` and `saleCode` (original had separate functions)
