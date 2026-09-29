# Checkpoint 2d — Inventory API: Plan

## Goal

Create Express router for inventory management.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory` | List inventory (paginated) |
| GET | `/api/inventory/:id` | Get single inventory record |
| POST | `/api/inventory` | Create inventory record |
| GET | `/api/inventory/logs` | Get inventory logs (paginated, optional productId filter) |
| POST | `/api/inventory/adjust` | Adjust inventory quantity |
| GET | `/api/inventory/low-stock` | Get low stock products |
| PUT | `/api/inventory/:id/settings` | Update inventory settings |

## Implementation

### Route: `apps/server/src/routes/inventory.ts`

```typescript
import { Router } from "express";
import prisma from "@dms/db";
import { paginationQuerySchema } from "@dms/shared";

const router = Router();

// GET /api/inventory — paginated list
router.get("/", async (req, res) => {
  const { page, pageSize } = paginationQuerySchema.parse(req.query);
  const orgId = req.auth.organizationId;
  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId: orgId },
      include: { product: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventory.count({ where: { organizationId: orgId } }),
  ]);
  res.json({ data, pageCount: Math.ceil(total / pageSize), total });
});

// GET /api/inventory/logs — paginated logs with optional productId filter
router.get("/logs", async (req, res) => {
  const { page, pageSize } = paginationQuerySchema.parse(req.query);
  const orgId = req.auth.organizationId;
  const productId = req.query.productId as string | undefined;
  const where = { organizationId: orgId, ...(productId && { productId }) };
  const [data, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      include: { product: true, user: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryLog.count({ where }),
  ]);
  res.json({ data, pageCount: Math.ceil(total / pageSize), total });
});

// POST /api/inventory/adjust — adjust quantity with log
router.post("/adjust", async (req, res) => {
  const { inventoryId, movementType, quantity, reason } = req.body;
  const userId = req.auth.userId;

  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { id: inventoryId },
    });
    if (!inventory) throw new Error("Inventory not found");

    const newQty = movementType === "IN" 
      ? inventory.quantityOnHand + quantity
      : inventory.quantityOnHand - quantity;

    const updated = await tx.inventory.update({
      where: { id: inventoryId },
      data: { quantityOnHand: newQty },
    });

    await tx.inventoryLog.create({
      data: {
        inventoryId,
        productId: inventory.productId,
        userId,
        movementType,
        quantity,
        previousQty: inventory.quantityOnHand,
        newQty,
        reason,
      },
    });

    return updated;
  });

  res.json(result);
});

// GET /api/inventory/low-stock
router.get("/low-stock", async (req, res) => {
  const orgId = req.auth.organizationId;
  const lowStock = await prisma.inventory.findMany({
    where: {
      organizationId: orgId,
      quantityOnHand: { lte: prisma.inventory.fields.reorderLevel },
    },
    include: { product: true },
  });
  res.json(lowStock);
});

export default router;
```

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Transaction on adjust** — for atomicity
3. **Auth middleware** — replaces session-based user lookup
