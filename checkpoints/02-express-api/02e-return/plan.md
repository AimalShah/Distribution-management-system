# Checkpoint 2e — Return API: Plan

## Goal

Create Express router for returns with inventory side effects.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/returns` | List returns (paginated) |
| GET | `/api/returns/:id` | Get single return |
| POST | `/api/returns` | Create return (with inventory updates) |
| PUT | `/api/returns/:id` | Update return |
| DELETE | `/api/returns/:id` | Delete return |

## Implementation

### Route: `apps/server/src/routes/return.ts`

Key considerations:
- Return type determines inventory direction:
  - SALE → IN movement (items come back to stock)
  - PURCHASE → OUT movement (items go back to supplier)
  - EXPIRED/DAMAGED → OUT movement (items removed from stock)
- Use `$transaction` for atomicity
- Org scoping

```typescript
// POST /api/returns
router.post("/", async (req, res) => {
  const data = ReturnFormSchema.parse(req.body);
  const orgId = req.auth.organizationId;
  const userId = req.auth.userId;

  const returnRecord = await prisma.$transaction(async (tx) => {
    const returnRecord = await tx.return.create({
      data: {
        returnCode: data.returnCode,
        returnType: data.returnType,
        returnDate: data.returnDate,
        reason: data.reason,
        organizationId: orgId,
        userId: userId,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.taxAmount,
            discount: item.discount,
            note: item.note,
          })),
        },
      },
      include: { items: true },
    });

    // Update inventory based on return type
    const movementType = data.returnType === "SALE" ? "IN" : "OUT";
    for (const item of data.items) {
      const inventory = await tx.inventory.findUnique({
        where: { productId: item.productId },
      });
      if (inventory) {
        const newQty = movementType === "IN"
          ? inventory.quantityOnHand + item.quantity
          : inventory.quantityOnHand - item.quantity;
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantityOnHand: newQty },
        });
        await tx.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            productId: item.productId,
            userId: userId,
            movementType: movementType as any,
            quantity: item.quantity,
            previousQty: inventory.quantityOnHand,
            newQty: newQty,
            reason: `Return ${data.returnCode} (${data.returnType})`,
            reference: returnRecord.id,
          },
        });
      }
    }

    return returnRecord;
  });

  res.status(201).json(returnRecord);
});
```

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Transaction wrapping** — for atomicity
3. **EXPIRED/DAMAGED inventory handling** — original code may not handle these; Express version treats them as OUT movements
