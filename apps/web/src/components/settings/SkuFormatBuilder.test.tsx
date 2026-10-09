import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkuFormatBuilder } from "./SkuFormatBuilder";

describe("SkuFormatBuilder (issue #46)", () => {
  it("previews a SKU with the same generator the server uses", () => {
    render(
      <SkuFormatBuilder
        format="{BRAND}-{CATEGORY}-{SEQ:5}"
        separator="-"
        sequence={7}
        brand="ACM"
        category="COL"
        onChange={() => {}}
      />
    );

    // buildSku("{BRAND}-{CATEGORY}-{SEQ:5}", "-", { SEQ: 7 }) → "ACM-COL-00007".
    expect(screen.getByTestId("sku-preview")).toHaveTextContent("ACM-COL-00007");
  });

  it("re-renders the preview as the format is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SkuFormatBuilder
        format="{BRAND}-{SEQ:3}"
        separator="-"
        sequence={7}
        brand="ACM"
        category="COL"
        onChange={onChange}
      />
    );

    const format = screen.getByLabelText(/format/i);
    await user.clear(format);
    await user.type(format, "{CATEGORY}-{YY}");

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByTestId("sku-preview")).not.toHaveTextContent("ACM-COL-00007");
  });

  it("flags an unknown token instead of previewing garbage", async () => {
    const user = userEvent.setup();

    render(
      <SkuFormatBuilder
        format="{BRAND}"
        separator="-"
        sequence={1}
        brand="ACM"
        category="COL"
        onChange={() => {}}
      />
    );

    const format = screen.getByLabelText(/format/i);
    await user.clear(format);
    await user.type(format, "{COLOUR}-{BRAND}");

    expect(await screen.findByText(/unknown token/i)).toBeInTheDocument();
  });

  it("offers every token from the shared vocabulary as an insert button", () => {
    render(
      <SkuFormatBuilder
        format="{BRAND}"
        separator="-"
        sequence={1}
        brand="ACM"
        category="COL"
        onChange={() => {}}
      />
    );

    for (const token of ["BRAND", "CATEGORY", "NAME", "SEQ", "YYYY", "YY", "MM", "RANDOM"]) {
      expect(screen.getByRole("button", { name: token })).toBeInTheDocument();
    }
  });
});
