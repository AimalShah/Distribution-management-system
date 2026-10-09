import prisma from "@dms/db";
import { parseSkuFormat, type CompanySettingsUpdateInput } from "@dms/shared";
import { badRequest } from "../http";

/** The shape the Settings page reads, stored or defaulted. */
export interface CompanySettingsView {
  organizationId: string;
  displayName: string | null;
  address: string | null;
  gstin: string | null;
  skuFormat: string;
  skuSeparator: string;
  skuSequence: number;
  returnWindowDays: number;
  returnsEnabled: boolean;
  creditTermDays: number;
}

/**
 * What a Company's settings are before anyone has edited them. Read-only
 * fallback: `getCompanySettings` answers with these without writing a row, so a
 * GET never has a side effect and an organization that predates this model still
 * gets a usable document header and policy.
 */
export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettingsView, "organizationId"> = {
  displayName: null,
  address: null,
  gstin: null,
  skuFormat: "{BRAND}-{CATEGORY}-{SEQ:5}",
  skuSeparator: "-",
  skuSequence: 0,
  returnWindowDays: 30,
  returnsEnabled: true,
  creditTermDays: 30,
};

/**
 * The active Company's settings. The tenant is the function's only scope, so a
 * caller cannot read across companies; the route supplies it from the auth
 * context, never from the request body.
 */
export async function getCompanySettings(
  organizationId: string
): Promise<CompanySettingsView> {
  const stored = await prisma.companySettings.findUnique({ where: { organizationId } });

  if (!stored) {
    return { organizationId, ...DEFAULT_COMPANY_SETTINGS };
  }

  return stored;
}

/**
 * Upsert rather than update: the row is created on first save, so the Settings
 * page is the same call whether or not a Company has saved before. Omitted keys
 * are `undefined` and Prisma leaves the column untouched.
 */
export async function updateCompanySettings(
  organizationId: string,
  data: CompanySettingsUpdateInput
): Promise<CompanySettingsView> {
  if (data.skuFormat !== undefined) {
    const parsed = parseSkuFormat(data.skuFormat);

    if (!parsed.ok) {
      throw badRequest(
        `Unknown SKU token(s): ${parsed.unknown.join(", ")}`,
        "INVALID_SKU_FORMAT",
        { unknown: parsed.unknown }
      );
    }
  }

  return prisma.companySettings.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: { ...data },
  });
}
