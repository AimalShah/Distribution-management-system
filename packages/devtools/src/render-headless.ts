import { JSDOM } from "jsdom";

export async function renderHeadless(componentPath: string, props: Record<string, unknown> = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).navigator = dom.window.navigator;
  (global as any).__DEBUG_STATE__ = undefined;

  const { render } = await import("@testing-library/react");
  const React = await import("react");
  const mod = await import(componentPath);
  const Component = mod.default;

  const { container } = render(React.createElement(Component, props));

  return {
    component: componentPath,
    props,
    dom: container.innerHTML,
    debugState: (global as any).__DEBUG_STATE__ ?? null,
  };
}
