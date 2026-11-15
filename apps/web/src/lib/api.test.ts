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

  it("printDocument appends autoprint=1 and creates an offscreen iframe", () => {
    const appendChildSpy = vi.spyOn(document.body, "appendChild");

    printDocument("/sales/123/print");

    expect(appendChildSpy).toHaveBeenCalled();
    // SAFETY: The appended child is an HTMLIFrameElement created inside printDocument.
    const createdIframe = appendChildSpy.mock.calls[0][0] as HTMLIFrameElement;
    expect(createdIframe.tagName.toLowerCase()).toBe("iframe");
    expect(createdIframe.src).toContain("autoprint=1");
    expect(createdIframe.style.position).toBe("fixed");
  });

  it("triggers iframe contentWindow print on load", () => {
    const mockPrint = vi.fn();
    const mockFocus = vi.fn();

    const appendChildSpy = vi.spyOn(document.body, "appendChild");

    printDocument("/purchases/456/html");

    // SAFETY: The appended child is an HTMLIFrameElement created inside printDocument.
    const createdIframe = appendChildSpy.mock.calls[0][0] as HTMLIFrameElement;
    Object.defineProperty(createdIframe, "contentWindow", {
      value: { print: mockPrint, focus: mockFocus },
      configurable: true,
    });

    createdIframe.onload?.(new Event("load"));

    expect(mockFocus).toHaveBeenCalled();
    expect(mockPrint).toHaveBeenCalled();
  });
});
