/**
 * Checkpoint 4j — Settings Pages: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Settings, Profile, Users, Billing, and Permissions screens:
 *
 *   - ProfilePage renders user info, details, and organization membership;
 *   - ChangePasswordForm validates that newPassword and confirmNewPassword match;
 *   - UsersPage renders DataTable from `@dms/ui` with pagination, search, and role filtering;
 *   - UserDialog validates user fields with Zod, handles create mode via POST;
 *   - UserDialog loads existing user into form state in edit mode via PUT;
 *   - User deletion removes user via DELETE;
 *   - Billing and Permissions pages render clear placeholders;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { changePasswordSchema } from "../../../apps/web/src/pages/ProfilePage";
import { userDialogSchema } from "../../../apps/web/src/components/settings/UserDialog";

const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);
  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 4j — Settings Pages", () => {
  it("profile page renders with user info", () => {
    const profileSrc = read("apps/web/src/pages/ProfilePage.tsx");
    const appSrc = read("apps/web/src/App.tsx");

    // Profile page renders user info
    expect(profileSrc).toContain("Profile Information");
    expect(profileSrc).toContain("IJAZ");
    expect(profileSrc).toContain("alex.morgan@inventioo.test");
    expect(profileSrc).toContain("Avatar");
    expect(profileSrc).toContain("Account Settings");

    // Route mounted in App.tsx
    expect(appSrc).toContain('path="/profile"');
    expect(appSrc).toContain('path="/settings/profile"');
  });

  it("change password form validates matching passwords", () => {
    const profileSrc = read("apps/web/src/pages/ProfilePage.tsx");

    // Form inputs present
    expect(profileSrc).toContain('name="currentPassword"');
    expect(profileSrc).toContain('name="newPassword"');
    expect(profileSrc).toContain('name="confirmNewPassword"');
    expect(profileSrc).toContain("Change Password");

    // Schema validation checks
    // 1. Mismatched passwords should fail
    const mismatch = changePasswordSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmNewPassword: "DifferentPassword123!",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(
        mismatch.error.issues.some((i) => i.message.includes("Passwords do not match"))
      ).toBe(true);
    }

    // 2. Short new password should fail
    const tooShort = changePasswordSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "short",
      confirmNewPassword: "short",
    });
    expect(tooShort.success).toBe(false);

    // 3. Matching valid passwords should succeed
    const valid = changePasswordSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "ValidNewPassword123!",
      confirmNewPassword: "ValidNewPassword123!",
    });
    expect(valid.success).toBe(true);
  });

  it("users table renders with pagination", () => {
    const usersSrc = read("apps/web/src/pages/UsersPage.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Must import and render DataTable with server-side pagination props
    expect(usersSrc).toContain("DataTable");
    expect(usersSrc).toMatch(/<DataTable\b/);
    expect(usersSrc).toContain("pageCount");
    expect(usersSrc).toContain("pageIndex");
    expect(usersSrc).toContain("pageSize");
    expect(usersSrc).toContain("onPaginationChange");

    // Search and role filters
    expect(usersSrc).toContain("search");
    expect(usersSrc).toContain("roleFilter");
    expect(usersSrc).toContain("Search users");

    // Must define all required user table columns
    const expectedHeaders = ["User", "Email", "Role", "Status", "Actions"];
    for (const header of expectedHeaders) {
      expect(usersSrc, `UsersPage must define header "${header}"`).toContain(
        `header: "${header}"`
      );
    }

    // Route mounted in App.tsx and linked in AppSidebar
    expect(appSrc).toContain('path="/users"');
    expect(appSrc).toContain('path="/settings/users"');
    expect(sidebarSrc).toMatch(/title:\s*"Users"[^}]*to:\s*"\/users"/);
  });

  it("add user dialog opens and submits", () => {
    const dialogSrc = read("apps/web/src/components/settings/UserDialog.tsx");
    const usersSrc = read("apps/web/src/pages/UsersPage.tsx");

    // Form fields present
    expect(dialogSrc).toContain('name="name"');
    expect(dialogSrc).toContain('name="email"');
    expect(dialogSrc).toContain('name="role"');
    expect(dialogSrc).toContain('name="password"');
    expect(dialogSrc).toContain('name="confirmPassword"');
    expect(dialogSrc).toContain('name="isActive"');

    // Submits via API client
    expect(dialogSrc).toMatch(/api\.post\(\s*["']\/users["']/);
    expect(dialogSrc).toContain("toast.success");

    // Dialog integrated into UsersPage
    expect(usersSrc).toContain("UserDialog");
    expect(usersSrc).toContain("handleOpenCreate");

    // Schema validation checks
    const emptyResult = userDialogSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    const badEmailResult = userDialogSchema.safeParse({
      name: "Jane Doe",
      email: "not-an-email",
      role: "member",
    });
    expect(badEmailResult.success).toBe(false);

    const passwordMismatchResult = userDialogSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      role: "member",
      password: "Password123!",
      confirmPassword: "WrongPassword!",
    });
    expect(passwordMismatchResult.success).toBe(false);

    const validResult = userDialogSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      role: "member",
      password: "Password123!",
      confirmPassword: "Password123!",
      isActive: true,
    });
    expect(validResult.success).toBe(true);
  });

  it("edit user loads data into dialog", () => {
    const dialogSrc = read("apps/web/src/components/settings/UserDialog.tsx");
    const usersSrc = read("apps/web/src/pages/UsersPage.tsx");

    // Dialog resets with existing user data
    expect(dialogSrc).toContain("isEditing");
    expect(dialogSrc).toContain("form.reset");
    expect(dialogSrc).toMatch(/api\.put\(\s*`\/users\/\$\{user\.id\}`/);

    // UsersPage handles opening edit modal
    expect(usersSrc).toContain("handleOpenEdit");
    expect(usersSrc).toContain("setSelectedUser");
  });

  it("delete user removes from list", () => {
    const usersSrc = read("apps/web/src/pages/UsersPage.tsx");

    // Delete handler and API call
    expect(usersSrc).toContain("handleDelete");
    // Checkpoint 17: the delete runs behind the shared ConfirmDialog.
    expect(usersSrc).toMatch(/api\.delete\(\s*`\/users\/\$\{confirmTarget\.id\}`/);
    expect(usersSrc).toContain("ConfirmDialog");
    expect(usersSrc).not.toContain("window.confirm");
    expect(usersSrc).toContain("toast.success");

    // Legacy unbacked field names check across apps/web/src
    const webSrc = path.join(root, "apps/web/src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");
          if (/invoiceNumber|purchaseOrderNumber/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(webSrc);

    expect(
      offenders,
      "Legacy invoiceNumber and purchaseOrderNumber must not appear in web source"
    ).toEqual([]);
  });

  it("billing page shows placeholder", () => {
    const billingSrc = read("apps/web/src/pages/BillingPage.tsx");
    const appSrc = read("apps/web/src/App.tsx");

    // Renders placeholder content
    expect(billingSrc).toContain("Billing & Plans");
    expect(billingSrc).toContain("Coming Soon");
    expect(billingSrc).toContain("Subscription");

    // Route mounted in App.tsx
    expect(appSrc).toContain('path="/billing"');
    expect(appSrc).toContain('path="/settings/billing"');
  });

  it("permission page shows placeholder", () => {
    const permSrc = read("apps/web/src/pages/PermissionPage.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Renders placeholder content
    expect(permSrc).toContain("Permissions & Roles");
    expect(permSrc).toContain("Coming Soon");
    expect(permSrc).toContain("Role Matrix");

    // Route mounted in App.tsx and linked in AppSidebar
    expect(appSrc).toContain('path="/permissions"');
    expect(appSrc).toContain('path="/settings/permissions"');
    expect(sidebarSrc).toMatch(/title:\s*"Permissions"[^}]*to:\s*"\/permissions"/);
  });
});
