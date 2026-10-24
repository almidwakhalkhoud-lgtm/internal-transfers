import { describe, expect, it } from "vitest";
import {
  notificationContent,
  pushPayload,
  retryDelay,
} from "../../src/lib/notification-content";
const transfer = {
  number: "TRF01234",
  source: "Main",
  destination: "مقصد",
  date: "2026-10-21",
  confirmedAt: "2026-10-21T08:00:00Z",
  creatorName: "Sender",
  approval: "PENDING",
  total: "2.500",
  remarks: "توضیحات کامل\nخط دوم",
  lines: [
    {
      code: "00123",
      description: "کالای اول",
      quantity: "2.5",
      unit: "کارتن",
      barcodes: ["000111"],
      note: "یادداشت کامل ردیف",
    },
  ],
};
describe("complete notification content", () => {
  it.each(["fa", "en"])("preserves every document field in %s", (locale) => {
    const content = notificationContent(transfer, locale);
    for (const value of [
      transfer.number,
      transfer.source,
      transfer.destination,
      "2026-10-21",
      transfer.creatorName,
      transfer.remarks,
      "00123",
      "کالای اول",
      "2.5",
      "کارتن",
      "000111",
      "یادداشت کامل ردیف",
    ])
      expect(content.body).toContain(value);
    expect(content.body).toContain(
      locale === "fa" ? "دریافت فیزیکی" : "physical receipt",
    );
  });
  it("keeps 500 lines and all remarks in the inbox while fitting push byte limits", () => {
    const t = {
      ...transfer,
      lines: Array.from({ length: 500 }, (_, i) => ({
        code: `00${i}`,
        description: "شرح فارسی بسیار بلند".repeat(50),
        quantity: "1",
        unit: "واحد",
        barcodes: ["001"],
      })),
      remarks: "توضیحات".repeat(250),
    };
    expect(notificationContent(t, "fa").body).toContain("00499");
    expect(notificationContent(t, "fa").body).toContain(t.remarks);
    expect(Buffer.byteLength(pushPayload("id", t, "fa"))).toBeLessThan(3800);
    expect(JSON.parse(pushPayload("id", t, "fa")).body).toContain("500 قلم");
  });
  it("shows a short, readable alert in the user's language", () => {
    const fa = JSON.parse(pushPayload("n1", transfer, "fa"));
    expect(fa.lang).toBe("fa");
    expect(fa.title).toBe(`ترانسفر ورودی ${transfer.number}`);
    expect(fa.body.split("\n")).toHaveLength(3);
    expect(fa.body).toContain(
      `از ${transfer.source} به ${transfer.destination}`,
    );
    const en = JSON.parse(pushPayload("n1", transfer, "en", true));
    expect(en.lang).toBe("en");
    expect(en.title).toBe(`Reminder: Incoming transfer ${transfer.number}`);
    expect(en.body).toContain("Tap to view and acknowledge.");
  });
  it("backs off failures without abandoning future retries", () => {
    expect(retryDelay(1)).toBe(60_000);
    expect(retryDelay(2)).toBe(120_000);
    expect(retryDelay(100)).toBe(900_000);
  });
});
