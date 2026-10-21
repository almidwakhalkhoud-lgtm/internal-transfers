import type { SnapshotLine } from "./domain";

export const REMINDER_MS = 5 * 60_000;
export const ESCALATION_MS = 30 * 60_000;
export type NotificationTransfer = {
  number: string;
  source: string;
  destination: string;
  date: string | Date;
  confirmedAt: string | Date;
  creatorName: string;
  approval: string;
  total: { toString(): string } | string;
  remarks: string;
  lines: unknown;
};

export function notificationContent(t: NotificationTransfer, locale: string) {
  const fa = locale === "fa";
  const lines = t.lines as SnapshotLine[];
  const title = fa
    ? `ترانسفر ورودی ${t.number} برای ${t.destination}`
    : `Incoming transfer ${t.number} for ${t.destination}`;
  const status =
    {
      PENDING: fa ? "در انتظار تأیید مدیر" : "Pending administrator approval",
      APPROVED: fa ? "تأییدشده توسط مدیر" : "Approved by administrator",
      REJECTED: fa ? "ردشده" : "Rejected",
      RECEIVED: fa ? "دریافت‌شده" : "Received",
    }[t.approval] ?? t.approval;
  const created = new Intl.DateTimeFormat(fa ? "fa-IR-u-ca-gregory" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(new Date(t.confirmedAt));
  const route = fa
    ? `از: ${t.source}\nبه: ${t.destination}`
    : `From: ${t.source}\nTo: ${t.destination}`;
  const body = [
    title,
    route,
    fa
      ? `تاریخ سند: ${new Date(t.date).toISOString().slice(0, 10)}`
      : `Document date: ${new Date(t.date).toISOString().slice(0, 10)}`,
    fa
      ? `ثبت‌کننده: ${t.creatorName}\nزمان ثبت: ${created} (دبی)`
      : `Created by: ${t.creatorName}\nConfirmed: ${created} (Dubai)`,
    fa ? `وضعیت: ${status}` : `Status: ${status}`,
    fa
      ? `تعداد ردیف‌ها: ${lines.length}\nمجموع مقدار: ${t.total.toString()}`
      : `Line items: ${lines.length}\nTotal quantity: ${t.total.toString()}`,
    ...lines.map(
      (line, i) =>
        `${i + 1}. ${line.code} — ${line.description}\n${fa ? "مقدار" : "Quantity"}: ${line.quantity} ${line.unit}${line.barcodes.length ? `\n${fa ? "بارکد" : "Barcode"}: ${line.barcodes.join(" / ")}` : ""}${line.note ? `\n${fa ? "یادداشت ردیف" : "Line note"}: ${line.note}` : ""}`,
    ),
    fa ? `توضیحات: ${t.remarks || "ندارد"}` : `Remarks: ${t.remarks || "None"}`,
    fa
      ? "لطفاً اقلام و مسیر را بررسی و «از ترانسفر مطلع شدم» را ثبت کنید. یادآوری هر ۵ دقیقه تا ثبت اطلاع ادامه دارد. ثبت اطلاع به معنی دریافت فیزیکی کالا یا تأیید مدیر نیست."
      : "Review the items and route, then select ‘Acknowledge transfer’. Reminders repeat every 5 minutes until acknowledged. Acknowledgment does not confirm physical receipt or administrator approval.",
  ].join("\n\n");
  return { title, body, status, route };
}

export function pushPayload(
  id: string,
  t: NotificationTransfer,
  locale: string,
) {
  const full = notificationContent(t, locale);
  const url = `/notifications?notification=${encodeURIComponent(id)}`;
  const data = {
    id,
    title: full.title,
    body: full.body,
    url,
    lang: locale === "fa" ? "fa" : "en",
  };
  // Push services have a byte limit; the durable inbox always contains every line.
  if (new TextEncoder().encode(JSON.stringify(data)).length <= 3000)
    return JSON.stringify(data);
  return JSON.stringify({
    ...data,
    title:
      locale === "fa"
        ? `ترانسفر ورودی ${t.number}`
        : `Incoming transfer ${t.number}`,
    body: [
      full.route.slice(0, 500),
      `${locale === "fa" ? "وضعیت" : "Status"}: ${full.status}`,
      `${locale === "fa" ? "ردیف‌ها / مجموع مقدار" : "Line items / total quantity"}: ${(t.lines as SnapshotLine[]).length} / ${t.total}`,
      locale === "fa"
        ? "متن کامل، تمام اقلام و توضیحات در مرکز اعلان‌هاست. برای بررسی و ثبت اطلاع باز کنید. یادآوری هر ۵ دقیقه ادامه دارد."
        : "Full text, all items and remarks are in your notification inbox. Open to review and acknowledge. Reminders repeat every 5 minutes.",
    ].join("\n"),
  });
}

export function retryDelay(failures: number) {
  return Math.min(
    60_000 * 2 ** Math.min(Math.max(failures - 1, 0), 5),
    15 * 60_000,
  );
}
