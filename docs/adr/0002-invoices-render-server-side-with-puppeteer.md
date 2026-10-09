# Sale invoices render server-side with Puppeteer

Invoices are produced by the Express API (`GET /api/sales/:id/pdf`, `apps/server/src/services/sale-pdf.ts`) using Puppeteer and an HTML template. A second client-side jsPDF generator (`apps/web/src/utils/generateQuickReportPdf.ts`) existed but had no callers and has been removed.

**Considered options:** client-side jsPDF was rejected because it duplicated the tax breakdown, drifted from the server template, and forced the browser to re-derive data the server already owns.

**Consequences:** one document pipeline shared by web and desktop; restyling documents (e.g. the monochrome requirement) happens in one HTML template.

**Status:** accepted
