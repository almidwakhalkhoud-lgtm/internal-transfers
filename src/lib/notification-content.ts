import type { SnapshotLine } from "./domain";

import {
  DEFAULT_NOTIFICATION_POLICY,
  reminderSummary,
  type NotificationPolicy,
} from "./notification-policy";
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

export function notificationContent(
  t: NotificationTransfer,
  locale: string,
  policy: NotificationPolicy = DEFAULT_NOTIFICATION_POLICY,
) {
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
      ? `لطفاً اقلام و مسیر را بررسی و «از ترانسفر مطلع شدم» را ثبت کنید. ${reminderSummary(policy, locale)} ثبت اطلاع به معنی دریافت فیزیکی کالا یا تأیید مدیر نیست.`
      : `Review the items and route, then select ‘Acknowledge transfer’. ${reminderSummary(policy, locale)} Acknowledgment does not confirm physical receipt or administrator approval.`,
  ].join("\n\n");
  return { title, body, status, route };
}

// What the phone shows: a short title and three plain lines in the user's
// language. The full text, every item and the remarks stay in the inbox.
export function pushPayload(
  id: string,
  t: NotificationTransfer,
  locale: string,
  reminder = false,
) {
  const fa = locale === "fa";
  const lines = t.lines as SnapshotLine[];
  const title = fa
    ? `${reminder ? "یادآوری: " : ""}ترانسفر ورودی ${t.number}`
    : `${reminder ? "Reminder: " : ""}Incoming transfer ${t.number}`;
  const body = (
    fa
      ? [
          `از ${t.source} به ${t.destination}`,
          `${lines.length} قلم · مجموع ${t.total.toString()}`,
          "برای دیدن و ثبت اطلاع، روی این پیام بزنید.",
        ]
      : [
          `From ${t.source} to ${t.destination}`,
          `${lines.length} ${lines.length === 1 ? "item" : "items"} · total ${t.total.toString()}`,
          "Tap to view and acknowledge.",
        ]
  ).join("\n");
  return JSON.stringify({
    id,
    title,
    body,
    url: `/notifications?notification=${encodeURIComponent(id)}`,
    lang: fa ? "fa" : "en",
  });
}

export function retryDelay(failures: number) {
  return Math.min(
    60_000 * 2 ** Math.min(Math.max(failures - 1, 0), 5),
    15 * 60_000,
  );
}
