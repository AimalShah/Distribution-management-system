import { Router } from "express";
import {
  CustomerSchema,
  CustomerUpdateSchema,
  customerLedgerQuerySchema,
  customerListQuerySchema,
} from "@dms/shared";
import { asyncHandler, notFound } from "../http";
import {
  addCustomer,
  getCustomerById,
  getCustomerLedger,
  getCustomers,
  removeCustomer,
  updateCustomer,
} from "../services/customer";
import { getCompanySettings } from "../services/settings";
import { generateCustomerStatementPdf } from "../services/customer-pdf";

export const customerRouter: Router = Router();

customerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = customerListQuerySchema.parse(req.query);

    const result = await getCustomers({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

customerRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await getCustomerById(req.params.id, req.auth.organizationId);

    if (!customer) throw notFound("Customer not found", "CUSTOMER_NOT_FOUND");
    res.json(customer);
  })
);

// `/:id` matches a single segment, so it never captures this two-segment path.
customerRouter.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const query = customerLedgerQuerySchema.parse(req.query);

    const ledger = await getCustomerLedger({
      customerId: req.params.id,
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(ledger);
  })
);

customerRouter.get(
  ["/:id/statement/pdf", "/:id/ledger/pdf"],
  asyncHandler(async (req, res) => {
    const query = customerLedgerQuerySchema.parse(req.query);

    const ledger = await getCustomerLedger({
      customerId: req.params.id,
      organizationId: req.auth.organizationId,
      ...query,
    });

    const settings = await getCompanySettings(req.auth.organizationId);

    const pdfBuffer = await generateCustomerStatementPdf({
      company: {
        name: settings.displayName,
        address: settings.address,
        gstin: settings.gstin,
      },
      ...ledger,
    });

    const safeName = ledger.customer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="statement-${safeName}-${dateStr}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  })
);

customerRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = CustomerSchema.parse(req.body);
    const customer = await addCustomer(data, req.auth.organizationId);
    res.status(201).json(customer);
  })
);

customerRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = CustomerUpdateSchema.parse(req.body);

    const customer = await updateCustomer(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(customer);
  })
);

customerRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeCustomer(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
