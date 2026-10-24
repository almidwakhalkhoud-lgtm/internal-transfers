import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { findRequest } from "@/lib/requests";
import type { RequestLine } from "@/lib/domain";
import { PrintButton } from "./print-button";
export const dynamic = "force-dynamic";
// An open request printed like the shops' paper ORDER FORM: what was ordered
// on the left; SOURCE STOCK and SOURCE DISCRIPTION stay blank for the source
// to fill in by hand before entering it in the app. At least the form's 30
// numbered rows. Once a request becomes a transfer, the transfer PDF is the
// document to print instead.
const ROWS = 30;
function formDate(value: Date) {
  const [d, m, y] = value
    .toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })
    .split("/");
  return `${y} / ${m} / ${d}`;
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "requests")) redirect(landingPage(user));
  const r = await findRequest(user, (await params).id).catch(() => null);
  if (!r) notFound();
  if (r.status !== "OPEN") redirect(`/requests/${r.id}`);
  const lines = (r.lines as RequestLine[]).filter((l) => !l.added);
  const blanks = Math.max(ROWS - lines.length, 0);
  return (
    <main className="order-form">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #fff; }
        .order-form { max-width: 190mm; margin: 0 auto; padding: 16px; font: 10pt Arial, "Yekan Bakh", sans-serif; color: #000; }
        .order-form .actions { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 12px; }
        .order-form .actions a, .order-form .actions button { font: 600 14px sans-serif; padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; color: #111; cursor: pointer; text-decoration: none; }
        .order-form .actions button { background: #a3228f; border-color: #a3228f; color: #fff; }
        .order-form table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .order-form th, .order-form td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; overflow-wrap: anywhere; }
        .order-form th { font-weight: normal; height: 14.25pt; }
        .order-form td { height: 21.5pt; }
        .order-form .nw { white-space: nowrap; overflow: hidden; }
        .order-form .unit { white-space: nowrap; overflow: hidden; font-size: 8.5pt; }
        .order-form .head td { text-align: left; height: 23.45pt; }
        .order-form .head span { display: inline-block; margin-inline-end: 18px; white-space: nowrap; }
        .order-form .head b { font-weight: normal; border-bottom: 1px solid #000; padding: 0 4px; }
        .order-form .c { text-align: center; }
        .order-form .l { text-align: left; }
        .order-form .note { display: block; font-size: 8pt; color: #333; }
        .order-form thead { display: table-header-group; }
        .order-form tr { break-inside: avoid; }
        @media print { .order-form { padding: 0; max-width: none; } .order-form .actions { display: none; } }
      `}</style>
      <div className="actions">
        <a href={`/requests/${r.id}`}>Back</a>
        <PrintButton />
      </div>
      <table>
        <colgroup>
          <col style={{ width: "5.2%" }} />
          <col style={{ width: "9.1%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "9.1%" }} />
          <col style={{ width: "9.1%" }} />
          <col style={{ width: "7.6%" }} />
          <col style={{ width: "9.1%" }} />
          <col style={{ width: "25.8%" }} />
        </colgroup>
        <thead>
          <tr className="head">
            <td colSpan={8}>
              <span>
                Transfer Order By <b dir="auto">{r.creatorName}</b>
              </span>
              <span>
                From <b dir="auto">{r.supplier}</b>
              </span>
              <span>
                To <b dir="auto">{r.requester}</b>
              </span>
              <span>Date : {formDate(r.createdAt)}</span>
              <span>
                No. <b>{r.number}</b>
              </span>
            </td>
          </tr>
          <tr>
            <th colSpan={5} className="c">
              ORDER FORM
            </th>
            <th colSpan={2} className="l">
              SOURCE STOCK
            </th>
            <th rowSpan={2} className="c">
              SOURCE
              <br />
              DISCRIPTION
            </th>
          </tr>
          <tr>
            <th className="c nw">NO.</th>
            <th className="l">CODE</th>
            <th className="c">NAME</th>
            <th className="l">QTY</th>
            <th className="l">UNIT</th>
            <th className="l">QTY</th>
            <th className="l">UNIT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="c">{i + 1}</td>
              <td className="l" dir="ltr">
                {l.code}
              </td>
              <td className="c" dir="auto">
                {l.description}
                {l.note && <span className="note">{l.note}</span>}
              </td>
              <td className="l" dir="ltr">
                {l.quantity}
              </td>
              <td className="l unit" dir="auto">
                {l.unit}
              </td>
              <td />
              <td />
              <td />
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, k) => (
            <tr key={`blank-${k}`}>
              <td className="c">{lines.length + k + 1}</td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {r.remarks && (
        <p dir="auto" style={{ marginTop: 8 }}>
          Remarks: {r.remarks}
        </p>
      )}
    </main>
  );
}
