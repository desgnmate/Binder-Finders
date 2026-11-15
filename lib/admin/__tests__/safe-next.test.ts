import { safeAdminNext } from "../safe-next";

describe("safeAdminNext", () => {
  it("returns to the admin screen that was linked", () => {
    expect(safeAdminNext("/admin?view=holds&hold=abc")).toBe("/admin?view=holds&hold=abc");
    expect(safeAdminNext("/admin")).toBe("/admin");
  });

  it("never leaves the admin or loops back to sign-in", () => {
    for (const bad of ["https://evil.test/admin", "//evil.test", "/account", "/administrator", "/admin/login", "/admin/reset-password", "/admin\\evil", undefined, 42]) {
      expect(safeAdminNext(bad)).toBe("/admin");
    }
  });
});
