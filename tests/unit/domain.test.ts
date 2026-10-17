import { describe, it, expect } from "vitest";
import {
  identifier,
  quantity,
  totalQuantity,
  formatTotal,
  numberFor,
  allowedTransition,
  canAccess,
  validateCatalog,
  transferInput,
} from "../../src/lib/domain";
describe("exact product identifiers", () => {
  it("preserves zeros and internal spacing", () => {
    expect(identifier(" 001230 ")).toBe("001230");
    expect(identifier("A 001")).toBe("A 001");
  });
  it("rejects ambiguous barcode mappings", () => {
    expect(
      validateCatalog([
        { code: "001", description: "a", units: [], barcodes: ["009"] },
        { code: "002", description: "b", units: [], barcodes: ["009"] },
      ]),
    ).toHaveLength(1);
  });
  it("rejects duplicate codes and barcode / code collisions", () => {
    expect(
      validateCatalog([
        { code: "001", description: "a", units: [], barcodes: ["002"] },
        { code: "002", description: "b", units: [], barcodes: [] },
      ]),
    ).toHaveLength(1);
  });
  it("does not infer units from packaging descriptions", () => {
    expect(
      validateCatalog([
        {
          code: "1",
          description: "Product 1x10 250G",
          units: [],
          barcodes: [],
        },
      ]),
    ).toEqual([]);
  });
});
describe("quantities", () => {
  it.each([
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1.0001",
    "1e3",
    "",
    "0.000",
    "1,000",
  ])("rejects %s", (v) => expect(quantity.safeParse(v).success).toBe(false));
  it.each(["1", "0.001", "12.345", "001.5"])("accepts %s", (v) =>
    expect(quantity.safeParse(v).success).toBe(true),
  );
  it("sums decimal quantities exactly", () =>
    expect(
      formatTotal(
        totalQuantity([
          { quantity: "0.1" },
          { quantity: "0.2" },
          { quantity: "12.345" },
        ]),
      ),
    ).toBe("12.645"));
  it("retains precision over 200 rows", () =>
    expect(
      formatTotal(
        totalQuantity(
          Array.from({ length: 200 }, () => ({ quantity: "999999999999.999" })),
        ),
      ),
    ).toBe("199999999999999.800"));
});
describe("workflow and authorization", () => {
  it("formats sequence values", () => {
    expect(numberFor(3210)).toBe("TRF03210");
    expect(numberFor(100000)).toBe("TRF100000");
    expect(numberFor(5, "MA")).toBe("MA00005");
  });
  it("separates confirmation and approval transitions", () => {
    expect(allowedTransition("PENDING", "APPROVED")).toBe(true);
    expect(allowedTransition("APPROVED", "RECEIVED")).toBe(true);
    expect(allowedTransition("REJECTED", "APPROVED")).toBe(false);
  });
  it("checks creator and assigned locations", () => {
    const transfer = {
      creatorId: "u1",
      sourceId: "main",
      destinationId: "branch",
    };
    expect(
      canAccess({ id: "u2", role: "STAFF", locations: [] }, transfer),
    ).toBe(false);
    expect(
      canAccess(
        { id: "u2", role: "STAFF", locations: [{ id: "branch" }] },
        transfer,
      ),
    ).toBe(true);
    expect(
      canAccess({ id: "u1", role: "STAFF", locations: [] }, transfer),
    ).toBe(true);
    expect(
      canAccess({ id: "admin", role: "ADMIN", locations: [] }, transfer),
    ).toBe(true);
  });
  it("rejects same locations", () => {
    expect(
      transferInput.safeParse({
        key: crypto.randomUUID(),
        sourceId: "x",
        destinationId: "x",
        date: "2026-10-17",
        remarks: "",
        lines: [{ productId: "p", quantity: "1", unit: "" }],
      }).success,
    ).toBe(false);
  });
});
