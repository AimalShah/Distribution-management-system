/**
 * Browser APIs jsdom does not implement but the UI touches on render.
 *
 * Registered for every parity suite and a no-op outside the DOM ones: the API
 * suites run in the node environment, where there is no `window` to patch.
 * A DOM suite opts in with a `// @vitest-environment jsdom` docblock.
 */
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // recharts' ResponsiveContainer and the sidebar measure themselves.
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver ??= ResizeObserver as unknown as typeof globalThis.ResizeObserver;

  // `useIsMobile` in @dms/ui.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  // Radix popovers and selects.
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
}
