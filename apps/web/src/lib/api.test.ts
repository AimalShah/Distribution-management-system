import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDocumentUrl, openDocument, printDocument } from "./api";

describe("api document printing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds document URLs properly", () => {
    const url = getDocumentUrl("/sales/123/print");

    expect(url).toContain("/sales/123/print");
  });

  it("openDocument opens a new window", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    openDocument("/sales/123/pdf");
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("/sales/123/pdf"), "_blank");
  });

  it("printDocument opens a new window with autoprint=1", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    printDocument("/sales/123/print");
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("/sales/123/print?autoprint=1"), "_blank");
  });

  it("printDocument preserves existing query params and appends autoprint=1", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    printDocument("/customers/cust_1/statement/print?startDate=2026-01-01");
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/customers/cust_1/statement/print?startDate=2026-01-01&autoprint=1"),
      "_blank"
    );
  });
});
