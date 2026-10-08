/**
 * Checkpoint 4b — Product Pages: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Product screens (ProductList, ProductNew, ProductEdit, and ProductForm):
 *
 *   - ProductList uses DataTable from `@dms/ui` with server-side pagination;
 *   - ProductForm validates required fields via ProductSchema with Zod;
 *   - ProductForm submits new products and updates existing ones with proper API calls;
 *   - Product table renders all required columns (Code, Name, Category, Brand, Unit, Cost, Price, Status, Actions);
 *   - ProductEdit fetches by ID and loads data into the form for updating;
 *   - Deleting a product invokes the DELETE API and refreshes the list;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names (invoiceNumber, purchaseOrderNumber) are carried over;
 *   - When a database is available, API contracts for listing, creating, reading, updating,
 *     and deleting products are verified end-to-end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ProductSchema } from "@dms/shared";
import {
  app,
  asOrg,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 4b — Product Pages", () => {
  let t: Tenant;

  beforeAll(async () => {
    if (hasDatabase) {
      t = await seedTenants();
    }
  });

  afterAll(async () => {
    if (hasDatabase && t) {
      await teardownTenants(t);
    }
  });

  it("product list renders with pagination", async () => {
    const listSrc = read("apps/web/src/pages/ProductList.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(listSrc).toContain("DataTable");
    expect(listSrc).toMatch(/<DataTable\b/);
    expect(listSrc).toContain("pageCount");
    expect(listSrc).toContain("pageIndex");
    expect(listSrc).toContain("pageSize");
    expect(listSrc).toContain("onPaginationChange");

    // Must query /products with pagination and search parameters
    expect(listSrc).toContain("/products?");
    expect(listSrc).toContain("page");
    expect(listSrc).toContain("pageSize");

    // Must handle loading states (Skeleton) and empty state
    expect(listSrc).toContain("<Skeleton");
    expect(listSrc).toContain("No products found");

    if (hasDatabase && t) {
      // Query with pagination against real API
      const res = await request(app)
        .get("/api/products?page=1&pageSize=5")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.pageCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    }
  });

  it("product form validates required fields", () => {
    const formSrc = read("apps/web/src/components/products/ProductForm.tsx");

    // Uses shared ProductSchema and zodResolver
    expect(formSrc).toContain("ProductSchema");
    expect(formSrc).toContain("zodResolver");

    // Form fields present
    expect(formSrc).toContain('name="name"');
    expect(formSrc).toContain('name="productCode"');
    expect(formSrc).toContain('name="category"');
    expect(formSrc).toContain('name="brand"');
    expect(formSrc).toContain('name="unit"');
    expect(formSrc).toContain('name="unitCost"');
    expect(formSrc).toContain('name="unitPrice"');

    // Schema validation test: empty object fails
    const emptyResult = ProductSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    // Schema validation test: short name fails
    const shortNameResult = ProductSchema.safeParse({
      name: "A",
      productCode: "SKU-001",
      category: "cat-1",
      brand: "brand-1",
      unit: "pcs",
      unitCost: "10.00",
      unitPrice: "20.00",
    });

    expect(shortNameResult.success).toBe(false);

    // Schema validation test: negative cost fails
    const negativeCostResult = ProductSchema.safeParse({
      name: "Valid Product",
      productCode: "SKU-001",
      category: "cat-1",
      brand: "brand-1",
      unit: "pcs",
      unitCost: "-5.00",
      unitPrice: "20.00",
    });

    expect(negativeCostResult.success).toBe(false);

    // Valid object passes and coerces numbers
    const validResult = ProductSchema.safeParse({
      name: "Valid Product",
      productCode: "SKU-001",
      category: "cat-1",
      brand: "brand-1",
      unit: "pcs",
      unitCost: "10.50",
      unitPrice: "20.00",
      isActive: true,
    });

    expect(validResult.success).toBe(true);

    if (validResult.success) {
      expect(validResult.data.unitCost).toBe(10.5);
      expect(validResult.data.unitPrice).toBe(20);
    }
  });

  it("product form submits correctly", async () => {
    const formSrc = read("apps/web/src/components/products/ProductForm.tsx");

    // Submits via API client
    expect(formSrc).toMatch(/api\.post\(\s*["']\/products["']/);
    expect(formSrc).toContain("toast.success");

    // Submitting state with loader
    expect(formSrc).toContain("submitting");
    expect(formSrc).toContain("Loader2");

    if (hasDatabase && t) {
      const code = unique("PRD");

      const res = await request(app)
        .post("/api/products")
        .set(asOrg(t.organizationId))
        .send({
          name: "Submitting Product Test",
          productCode: code,
          category: t.categoryId,
          brand: t.brandId,
          unit: "pcs",
          unitCost: "15.00",
          unitPrice: "25.00",
          description: "Submits correctly test",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Submitting Product Test");
      expect(res.body.productCode).toBe(code);
    }
  });

  it("product table shows all columns", () => {
    const listSrc = read("apps/web/src/pages/ProductList.tsx");

    // All required column headers
    const requiredHeaders = [
      "Code",
      "Name",
      "Category",
      "Brand",
      "Unit",
      "Cost",
      "Price",
      "Status",
      "Actions",
    ];

    for (const header of requiredHeaders) {
      expect(listSrc, `ProductList must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Formatting utilities and components used
    expect(listSrc).toContain("formatMoney");
    expect(listSrc).toContain("<Badge");
    expect(listSrc).toContain("<DropdownMenu");
    expect(listSrc).toContain("Edit Product");
    expect(listSrc).toContain("Delete");
  });

  it("edit product loads data into form", async () => {
    const editSrc = read("apps/web/src/pages/ProductEdit.tsx");
    const formSrc = read("apps/web/src/components/products/ProductForm.tsx");
    const appSrc = read("apps/web/src/App.tsx");

    // Route parameter reading and fetching
    expect(editSrc).toContain("useParams");
    expect(editSrc).toMatch(/\/products\/\$\{id\}/);
    expect(editSrc).toContain("initialData");
    expect(editSrc).toContain("isEditing");

    // Form resets with loaded data and PUTs on edit
    expect(formSrc).toContain("form.reset");
    expect(formSrc).toMatch(/api\.put\(\s*`\/products\/\$\{productId\}`/);

    // Routes registered in App.tsx
    expect(appSrc).toContain('path="/products/:id/edit"');
    expect(appSrc).toContain('path="/products/new"');

    if (hasDatabase && t) {
      // Create a product to edit
      const code = unique("EDT");

      const created = await request(app)
        .post("/api/products")
        .set(asOrg(t.organizationId))
        .send({
          name: "Original Product Name",
          productCode: code,
          category: t.categoryId,
          brand: t.brandId,
          unit: "box",
          unitCost: "50.00",
          unitPrice: "80.00",
          isActive: true,
        });

      expect(created.status).toBe(201);
      const prodId = created.body.id;

      // Load product by id
      const fetched = await request(app)
        .get(`/api/products/${prodId}`)
        .set(asOrg(t.organizationId));

      expect(fetched.status).toBe(200);
      expect(fetched.body.name).toBe("Original Product Name");
      expect(fetched.body.unitCost).toBe(50);

      // Edit product via PUT
      const updated = await request(app)
        .put(`/api/products/${prodId}`)
        .set(asOrg(t.organizationId))
        .send({
          name: "Updated Product Name",
          unitPrice: "95.00",
        });

      expect(updated.status).toBe(200);
      expect(updated.body.name).toBe("Updated Product Name");
      expect(updated.body.unitPrice).toBe(95);
    }
  });

  it("delete product removes from list", async () => {
    const listSrc = read("apps/web/src/pages/ProductList.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Delete handler calls api.delete and mutate(). The native confirm is
    // gone as of Checkpoint 17: the confirmation is the shared dialog, which
    // can show a busy state while the delete is in flight.
    expect(listSrc).toMatch(/api\.delete\(\s*`\/products\/\$\{confirmTarget\.id\}`/);
    expect(listSrc).toContain("ConfirmDialog");
    expect(listSrc).not.toContain("window.confirm");
    expect(listSrc).toContain("mutate()");

    // Sidebar links to /products
    expect(sidebarSrc).toMatch(/title:\s*"Products"[^}]*to:\s*"\/products"/);

    // Legacy field checks across apps/web/src
    const webSrc = path.join(root, "apps/web/src");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");

          if (/invoiceNumber|purchaseOrderNumber/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };

    walk(webSrc);

    expect(
      offenders,
      "Legacy unbacked field names must not appear in web source"
    ).toEqual([]);

    if (hasDatabase && t) {
      // Create and delete a product
      const code = unique("DEL");

      const created = await request(app)
        .post("/api/products")
        .set(asOrg(t.organizationId))
        .send({
          name: "To Delete",
          productCode: code,
          category: t.categoryId,
          brand: t.brandId,
          unit: "pcs",
          unitCost: "5.00",
          unitPrice: "10.00",
        });

      const prodId = created.body.id;

      // Delete product
      const delRes = await request(app)
        .delete(`/api/products/${prodId}`)
        .set(asOrg(t.organizationId));

      expect(delRes.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/products/${prodId}`)
        .set(asOrg(t.organizationId));

      expect(getRes.status).toBe(404);
    }
  });
});
