import { describe, it, expect } from "vitest";
import {
  identifier,
  quantity,
  totalQuantity,
  formatTotal,
  numberFor,
  routeCode,
  sequenceOf,
  allowedTransition,
  canAccess,
  validateCatalog,
  transferInput,
  unitsFromDescription,
  renamable,
  signableSides,
  signaturePng,
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
    expect(numberFor(3210)).toBe("3210");
    expect(numberFor(100000)).toBe("100000");
    expect(numberFor(1, routeCode("Main", "Al Azaiba"))).toBe("MA-0001");
    expect(sequenceOf("MS-0042")).toBe(42);
    expect(sequenceOf("TRF00002")).toBe(2);
  });
  it("numbers requests on their own counter and their transfers by route", () => {
    expect(numberFor(7, "REQ")).toBe("REQ-0007");
    expect(sequenceOf("REQ-0007")).toBe(7);
    // The QBM program names the PDF from these same letters (MA-3212), so a
    // transfer made from a request must carry them like any other.
    expect(numberFor(12, routeCode("NEW STORE", "Main"))).toBe("NM-0012");
    expect(numberFor(13, routeCode("NEW STORE", "VAN SALES STORE"))).toBe(
      "NV-0013",
    );
    expect(numberFor(14, routeCode("VAN SALES STORE", "Main"))).toBe("VM-0014");
    expect(numberFor(15, routeCode("Sur Shop", "Al Azaiba"))).toBe("SA-0015");
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
describe("units from QBM pack sizes", () => {
  it("reads one or two pack levels from the name", () => {
    expect(unitsFromDescription("Manchester Slim (1x10)", "BOX")).toEqual([
      "BOX(1x10)",
      "PCS",
    ]);
    expect(unitsFromDescription("KKK LIGHTER KDR2069 (1X30X25)")).toEqual([
      "CTN(1x30)",
      "BOX(1x25)",
      "PCS",
    ]);
  });
  it("gives no units without a pack size", () => {
    expect(unitsFromDescription("Ocb Slim Filter")).toEqual([]);
    expect(unitsFromDescription("SUITCASE 4PCS SET (18/20)")).toEqual([]);
  });
});
describe("renamable products", () => {
  it("lets only the midwakh service code be renamed", () => {
    expect(renamable("ss")).toBe(true);
    expect(renamable(" SS ")).toBe(true);
    expect(renamable("ss1")).toBe(false);
    expect(renamable("1066")).toBe(false);
  });
});
describe("transfer signatures", () => {
  const t = {
    sourceId: "main",
    destinationId: "sur",
    approval: "PENDING",
    signatures: [] as { side: string; userId: string }[],
  };
  const staff = (id: string, ...locations: string[]) => ({
    id,
    role: "STAFF",
    locations: locations.map((id) => ({ id })),
  });
  it("lets each location sign only its own side", () => {
    expect(signableSides(staff("a", "main"), t)).toEqual(["SOURCE"]);
    expect(signableSides(staff("b", "sur"), t)).toEqual(["DESTINATION"]);
    expect(signableSides(staff("c", "other"), t)).toEqual([]);
    expect(signableSides({ id: "x", role: "ADMIN", locations: [] }, t)).toEqual(
      ["SOURCE", "DESTINATION"],
    );
  });
  it("never lets one person sign both sides, a signed side or a rejected transfer", () => {
    const signed = { ...t, signatures: [{ side: "SOURCE", userId: "a" }] };
    expect(signableSides(staff("a", "main", "sur"), signed)).toEqual([]);
    expect(signableSides(staff("b", "main", "sur"), signed)).toEqual([
      "DESTINATION",
    ]);
    expect(
      signableSides(staff("a", "main"), { ...t, approval: "REJECTED" }),
    ).toEqual([]);
  });
  it("lets an administrator-made exception sign both sides", () => {
    const signed = { ...t, signatures: [{ side: "SOURCE", userId: "a" }] };
    expect(
      signableSides(
        { ...staff("a", "main", "sur"), signBothSides: true },
        signed,
      ),
    ).toEqual(["DESTINATION"]);
    // The exception never adds a location the user does not work at.
    expect(
      signableSides({ ...staff("a", "main"), signBothSides: true }, signed),
    ).toEqual([]);
  });
  it("shows view-only locations without letting them sign", () => {
    const viewer = { ...staff("v", "other"), viewLocations: [{ id: "sur" }] };
    expect(
      canAccess(viewer, {
        creatorId: "x",
        sourceId: "main",
        destinationId: "sur",
      }),
    ).toBe(true);
    expect(signableSides(viewer, t)).toEqual([]);
  });
  it("accepts only PNG signature images", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1,
    ]);
    expect(
      signaturePng(`data:image/png;base64,${png.toString("base64")}`),
    ).toEqual(png);
    expect(signaturePng("data:image/png;base64,aGVsbG8=")).toBeNull();
    expect(signaturePng("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });
});
