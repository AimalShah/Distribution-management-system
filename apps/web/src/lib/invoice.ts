import { api } from "./api";

/**
 * The invoice routes need the same authentication as every other API call, so
 * they are fetched through `api` (cookie or bearer token) rather than opened as
 * a plain link -- a link carries the cookie but not the bearer token the
 * Electron shell relies on.
 */
export async function openInvoicePrintView(saleId: string) {
  // Opened before the request so the browser treats it as a user-initiated
  // popup; assigning the document afterwards is not blocked.
  const tab = window.open("", "_blank");
  const { data } = await api.get<string>(`/sales/${saleId}/print`, { responseType: "text" });
  const url = URL.createObjectURL(new Blob([data], { type: "text/html" }));
  if (tab) tab.location.href = url;
  else window.location.href = url;
}

export async function downloadInvoicePdf(saleId: string, saleCode: string) {
  const { data } = await api.get<Blob>(`/sales/${saleId}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${saleCode}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
