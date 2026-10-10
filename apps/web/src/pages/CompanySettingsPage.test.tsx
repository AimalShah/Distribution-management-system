import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySettingsPage } from "./CompanySettingsPage";

const { apiGet, apiPut, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: { get: apiGet, put: apiPut, post: apiPost },
  fetcher: apiGet,
  failureMessage: (err: unknown, fallback: string) => fallback,
}));

const storedSettings = {
  organizationId: "org_1",
  displayName: "Acme Distribution",
  address: "12 Market Road",
  gstin: "27AAPFU0939F1ZV",
  skuFormat: "{BRAND}-{CATEGORY}-{SEQ:5}",
  skuSeparator: "-",
  skuSequence: 7,
  returnWindowDays: 30,
  returnsEnabled: true,
  creditTermDays: 30,
};

const storedOrganizations = [
  { id: "org_1", name: "Acme Distribution", slug: "acme-dist", gstin: "27AAPFU0939F1ZV" },
];

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((path: string) => {
    if (path === "/organizations") {
      return Promise.resolve(storedOrganizations);
    }
    return Promise.resolve(storedSettings);
  });
  apiPut.mockResolvedValue(storedSettings);
});

describe("CompanySettingsPage (issue #39)", () => {
  it("loads the active Company's settings into the profile form", async () => {
    render(<CompanySettingsPage />);

    expect(await screen.findByLabelText(/display name/i)).toHaveValue(
      "Acme Distribution"
    );
    expect(screen.getByLabelText(/address/i)).toHaveValue("12 Market Road");
    expect(screen.getByLabelText(/gstin/i)).toHaveValue("27AAPFU0939F1ZV");
    expect(apiGet).toHaveBeenCalledWith("/settings");
  });

  it("saves edited profile fields via PUT /api/settings", async () => {
    const user = userEvent.setup();
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    const name = screen.getByLabelText(/display name/i);
    await user.clear(name);
    await user.type(name, "Acme Traders");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith("/settings", {
        displayName: "Acme Traders",
        address: "12 Market Road",
        gstin: "27AAPFU0939F1ZV",
        skuFormat: "{BRAND}-{CATEGORY}-{SEQ:5}",
        skuSeparator: "-",
        returnWindowDays: 30,
        returnsEnabled: true,
      });
    });
  });

  it("shows a confirmation once the save settles", async () => {
    const user = userEvent.setup();
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/saved/i);
  });

  it("embeds the SKU format builder with a live preview (issue #46)", async () => {
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    // Stored format {BRAND}-{CATEGORY}-{SEQ:5} at sequence 7 previews the next
    // real SKU: ACM-COL-00007.
    expect(screen.getByTestId("sku-preview")).toHaveTextContent("ACM-COL-00007");
  });

  it("saves an edited SKU format through the same PUT", async () => {
    const user = userEvent.setup();
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    // Compose through the token buttons rather than raw braces: clear the
    // format, then insert SEQ.
    const format = screen.getByLabelText(/sku format/i);
    await user.clear(format);
    await user.click(screen.getByRole("button", { name: "SEQ" }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/settings",
        expect.objectContaining({ skuFormat: "{SEQ}" })
      );
    });
  });

  it("shows the return policy: window in days and an enable toggle (issue #47)", async () => {
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    expect(screen.getByLabelText(/return window/i)).toHaveValue(30);
    expect(screen.getByRole("checkbox", { name: /sale returns/i })).toBeChecked();
  });

  it("saves an edited return window through the same PUT", async () => {
    const user = userEvent.setup();
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    const window = screen.getByLabelText(/return window/i);
    await user.clear(window);
    await user.type(window, "14");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/settings",
        expect.objectContaining({ returnWindowDays: 14 })
      );
    });
  });

  it("saves the disabled returns flag through the same PUT", async () => {
    const user = userEvent.setup();
    render(<CompanySettingsPage />);

    await screen.findByLabelText(/display name/i);

    await user.click(screen.getByRole("checkbox", { name: /sale returns/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/settings",
        expect.objectContaining({ returnsEnabled: false })
      );
    });
  });

  it("lists multiple companies and highlights the active one", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === "/organizations") {
        return Promise.resolve([
          { id: "org_1", name: "Acme Distribution", slug: "acme-dist", gstin: "27AAPFU0939F1ZV" },
          { id: "org_2", name: "Beta Distribution", slug: "beta-dist", gstin: null },
        ]);
      }
      return Promise.resolve(storedSettings);
    });

    render(<CompanySettingsPage />);

    expect(await screen.findByText("Beta Distribution")).toBeInTheDocument();
    expect(screen.getByText("Acme Distribution")).toBeInTheDocument();
    expect(screen.getByText(/active company/i)).toBeInTheDocument();
  });

  it("allows switching to another company", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({});

    apiGet.mockImplementation((path: string) => {
      if (path === "/organizations") {
        return Promise.resolve([
          { id: "org_1", name: "Acme Distribution", slug: "acme-dist" },
          { id: "org_2", name: "Beta Distribution", slug: "beta-dist" },
        ]);
      }
      return Promise.resolve(storedSettings);
    });

    render(<CompanySettingsPage />);

    await screen.findByText("Beta Distribution");
    const switchBtn = screen.getByRole("button", { name: /switch to beta distribution/i });
    expect(switchBtn).toBeInTheDocument();
  });
});

