import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/** Harness smoke test: jsdom + testing-library render and assert. */
describe("web test harness", () => {
  it("renders and finds text", () => {
    render(<p>hello harness</p>);

    expect(screen.getByText("hello harness")).toBeInTheDocument();
  });
});
