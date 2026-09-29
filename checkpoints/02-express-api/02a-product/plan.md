# Checkpoint 2a — Product API: Plan

## Goal

Create Express router `apps/server/src/routes/product.ts` exposing CRUD operations for products, matching the behavior of `src/actions/product.ts` + `src/services/product.ts`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (paginated) |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

## Implementation

### Route file: `apps/server/src/routes/product.ts`

```typescript
import { Router } from "express";
import prisma from "@dms/db";
import { ProductSchema } from "@dms/shared";
import { paginationQuerySchema } from "@dms/shared";

const router = Router();

// GET /api/products — paginated list
router.get("/", async (req, res) => {
  const { page, pageSize } = paginationQuerySchema.parse(req.query);
  const orgId = req.auth.organizationId; // from auth middleware
  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: orgId },
      include: { category: true, brand: true, inventory: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where: { organizationId: orgId } }),
  ]);
  res.json({ data, pageCount: Math.ceil(total / pageSize), total });
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, organizationId: req.auth.organizationId },
    include: { category: true, brand: true, inventory: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// POST /api/products
router.post("/", async (req, res) => {
  const data = ProductSchema.parse(req.body);
  const product = await prisma.product.create({
    data: { ...data, organizationId: req.auth.organizationId },
    include: { category: true, brand: true, inventory: true },
  });
  res.status(201).json(product);
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  const data = ProductSchema.partial().parse(req.body);
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data,
    include: { category: true, brand: true, inventory: true },
  });
  res.json(product);
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
```

## Intentional Deviations

1. **Pagination added** — `fetchProducts()` returned unpaginated array; Express version uses paginated response contract
2. **Auth middleware** — `req.auth.organizationId` replaces session-based org ID lookup
3. **No revalidate** — Next.js `revalidatePath` has no Express equivalent; the frontend will use SWR mutation instead

## Verification

- All endpoints return same data shapes as original actions
- Pagination works correctly (page, pageSize, pageCount, total)
- Org scoping prevents cross-tenant access
