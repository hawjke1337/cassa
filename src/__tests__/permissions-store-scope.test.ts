import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

function readAction(name: string): string {
  return readFileSync(resolve(__dirname, `../actions/${name}.ts`), "utf-8")
}

describe("store-scoped permissions", () => {
  describe("trade-in (PERM-01)", () => {
    it("all trade-in requirePermission calls pass storeId", () => {
      const content = readAction("trade-in")
      const permCalls = content.match(/requirePermission\([^)]+\)/g) ?? []
      expect(permCalls.length).toBeGreaterThan(0)
      for (const call of permCalls) {
        expect(call).toMatch(/requirePermission\("[^"]+",\s*\w/)
      }
    })
  })

  describe("reports (PERM-02)", () => {
    it("reports check storeId or require reports.full", () => {
      const content = readAction("reports")
      // Should contain store-scoped permission checks
      expect(content).toMatch(/requirePermission\("reports\.\w+",/)
      // Should contain reports.full fallback for cross-store
      expect(content).toContain('requirePermission("reports.full")')
    })

    it("getInventoryReport passes storeId", () => {
      const content = readAction("reports")
      expect(content).toContain('requirePermission("reports.inventory", params.storeId)')
    })
  })

  describe("payroll (PERM-03)", () => {
    it("generatePayroll requires motivation.payroll.manage", () => {
      const content = readAction("motivation-payroll")
      expect(content).toContain('requirePermission("motivation.payroll.manage")')
    })

    it("confirmPayroll requires motivation.payroll.confirm", () => {
      const content = readAction("motivation-payroll")
      expect(content).toContain('requirePermission("motivation.payroll.confirm")')
    })

    it("markPayrollPaid requires motivation.payroll.pay", () => {
      const content = readAction("motivation-payroll")
      expect(content).toContain('requirePermission("motivation.payroll.pay")')
    })

    it("deletePayroll requires motivation.payroll.manage", () => {
      const content = readAction("motivation-payroll")
      // deletePayroll should use manage, not view
      const deleteSection = content.slice(content.indexOf("async function deletePayroll"))
      expect(deleteSection).toContain('requirePermission("motivation.payroll.manage")')
    })

    it("getPayrolls still uses motivation.payroll.view (read-only)", () => {
      const content = readAction("motivation-payroll")
      const getSection = content.slice(
        content.indexOf("async function getPayrolls"),
        content.indexOf("async function generatePayroll")
      )
      expect(getSection).toContain('requirePermission("motivation.payroll.view")')
    })
  })

  describe("document-templates (PERM-04)", () => {
    it("getDocumentData checks permissions for RECEIVE_DOC", () => {
      const content = readAction("document-templates")
      expect(content).toContain("RECEIVE_DOC")
      expect(content).toContain('requirePermission("inventory.receive"')
    })

    it("getDocumentData checks permissions for WRITE_OFF_DOC", () => {
      const content = readAction("document-templates")
      expect(content).toContain("WRITE_OFF_DOC")
      expect(content).toContain('requirePermission("inventory.writeoff"')
    })
  })

  describe("shifts (PERM-05)", () => {
    it("getCurrentShift checks store-scoped permission", () => {
      const content = readAction("shifts")
      expect(content).toContain('requirePermission("shifts.view", storeId)')
    })

    it("checkOpenShift checks store-scoped permission", () => {
      const content = readAction("shifts")
      const checkSection = content.slice(content.indexOf("async function checkOpenShift"))
      expect(checkSection).toContain('requirePermission("shifts.view", storeId)')
    })
  })

  describe("permissions-list completeness", () => {
    it("contains all payroll permission codes", () => {
      const content = readFileSync(
        resolve(__dirname, "../lib/permissions-list.ts"),
        "utf-8"
      )
      expect(content).toContain("motivation.payroll.manage")
      expect(content).toContain("motivation.payroll.confirm")
      expect(content).toContain("motivation.payroll.pay")
      expect(content).toContain("MOTIVATION_PAYROLL_MANAGE")
      expect(content).toContain("MOTIVATION_PAYROLL_CONFIRM")
      expect(content).toContain("MOTIVATION_PAYROLL_PAY")
    })
  })
})
