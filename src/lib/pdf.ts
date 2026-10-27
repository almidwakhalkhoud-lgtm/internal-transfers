import type { Browser } from "playwright";
import bwipjs from "bwip-js/node";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SnapshotLine } from "./domain";
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export type DocumentData = {
  number: string;
  date: Date | string;
  source: string;
  destination: string;
  remarks: string;
  lines: SnapshotLine[];
  total: string;
  signatures?: {
    side: string;
    signerName: string;
    signedAt: Date;
    image: Buffer;
  }[];
};
// Bound Chromium memory use while keeping PDF generation outside database transactions.
let activeJobs = 0;
const waitingJobs: (() => void)[] = [];
async function acquirePdfSlot() {
  await new Promise<void>((resolve) => {
    if (activeJobs < 2) {
      activeJobs++;
      resolve();
    } else waitingJobs.push(resolve);
  });
  return () => {
    const next = waitingJobs.shift();
    if (next) next();
    else activeJobs--;
  };
}
// QBM prints dates as 18-Oct-26.
const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function qbmDate(value: Date | string) {
  const [y, m, d] = String(value instanceof Date ? value.toISOString() : value)
    .slice(0, 10)
    .split("-");
  return `${d}-${months[Number(m) - 1]}-${y.slice(2)}`;
}
function signedTime(value: Date) {
  const part = (type: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .find((p) => p.type === type)!.value;
  return `${qbmDate(`${part("year")}-${part("month")}-${part("day")}`)} ${part("hour")}:${part("minute")}`;
}
// The page copies the QBM transfer printout: US Letter, the same field and
// column positions (in points, measured from a QBM PDF), centered cells and a
// table that runs down to the total and the two signature rows.
export async function documentHtml(t: DocumentData) {
  const [yekan, arimo] = await Promise.all(
    ["YekanBakh-Regular.woff2", "Arimo-Regular.woff2"].map((name) =>
      readFile(path.join(process.cwd(), "public/fonts", name)),
    ),
  );
  const rows = await Promise.all(
    t.lines.map(async (l) => {
      const code = l.barcodes.find((b) => /^[\x20-\x7e]{1,64}$/.test(b));
      const barcode = code
        ? await bwipjs.toBuffer({
            bcid: "code128",
            text: code,
            scale: 3,
            height: 6,
            includetext: true,
            textxalign: "left",
            textsize: 8,
            backgroundcolor: "FFFFFF",
          })
        : null;
      return `<tr><td>${esc(l.code)}${barcode ? `<img class="barcode" alt="${esc(code)}" src="data:image/png;base64,${barcode.toString("base64")}">` : ""}</td><td><div dir="auto">${esc(l.description)}</div>${code ? `<div>${esc(code)}</div>` : ""}</td><td class="fit">${esc(l.quantity)}</td><td class="fit" dir="auto">${esc(l.unit)}</td></tr>`;
    }),
  );
  const signature = (side: string, label: string) => {
    const s = t.signatures?.find((x) => x.side === side);
    return `<div class="sign${s ? " signed" : ""}"><span class="label">${label} :</span>${
      s
        ? `<img alt="" src="data:image/png;base64,${s.image.toString("base64")}"><span class="name" dir="auto">${esc(s.signerName)}</span>`
        : ""
    }<span class="date">Date:</span><span class="box">${s ? esc(signedTime(s.signedAt)) : ""}</span></div>`;
  };
  const at = (left: number, top: number, text: string) =>
    `<div class="at" style="left:${left}pt;top:${top}pt" dir="auto">${esc(text)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Arimo;src:url(data:font/woff2;base64,${arimo.toString("base64")})}
@font-face{font-family:Yekan;src:url(data:font/woff2;base64,${yekan.toString("base64")})}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{width:554.4pt;font:8.3pt/1.15 Arimo,Yekan,sans-serif;color:#000}
.head{position:relative;height:134.6pt}
h1{position:absolute;inset:0 0 auto;margin:0;font-size:18pt;font-weight:normal;line-height:1.2;text-align:center}
.at{position:absolute;white-space:nowrap}
.remarks{position:absolute;left:52.6pt;top:108.7pt;width:293pt;height:21.6pt;border:.72pt solid #000;padding:2pt 4pt;overflow:hidden}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:.72pt solid #000}
thead{display:table-header-group}
th{font-size:9pt;font-weight:normal;height:13pt;padding:0 2pt;border:.72pt solid #000}
td{padding:1.6pt 3pt;border-left:.72pt solid #000;border-right:.72pt solid #000;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
tr{break-inside:avoid}
td.fit{white-space:nowrap;overflow:hidden;overflow-wrap:normal}
.barcode{display:block;height:21pt;width:auto;max-width:100%;margin:1pt 0 0 4pt}
tr.fill td{padding:0}
.total{text-align:right;padding:2pt 2.4pt 0;height:16pt}
.sign{position:relative;height:20pt;break-inside:avoid}
.sign.signed{height:62pt}
.sign .label{position:absolute;left:6pt;bottom:6pt;text-decoration:underline}
.sign.signed .label{bottom:16pt}
.sign img{position:absolute;left:110pt;bottom:1pt;width:225pt;height:58pt;object-fit:contain;object-position:left bottom}
.sign .name{position:absolute;left:6pt;bottom:4pt;max-width:100pt;overflow:hidden;white-space:nowrap;font-size:7.5pt}
.sign .date{position:absolute;left:340pt;bottom:6pt}
.sign .box{position:absolute;left:441pt;bottom:2pt;width:113.4pt;height:14.4pt;border:.72pt solid #000;text-align:center;line-height:13pt}
</style></head><body><div class="head"><h1>MEHDI ALI TRADING Co.</h1>${at(416, 54, qbmDate(t.date))}${at(416, 69, t.number)}${at(421, 97, "Confirmed")}${at(82, 78, t.source)}${at(82, 95, t.destination)}<div class="remarks" dir="auto">${esc(t.remarks)}</div></div><table><colgroup><col style="width:139pt"><col style="width:288pt"><col style="width:77pt"><col style="width:50.4pt"></colgroup><thead><tr><th>Item</th><th>Description</th><th>Quantity</th><th>Unit</th></tr></thead><tbody>${rows.join("")}<tr class="fill"><td></td><td></td><td></td><td></td></tr></tbody></table><div class="total">${esc(t.total)}</div>${signature("SOURCE", "Signature of Sender")}${signature("DESTINATION", "Signature of Receiver")}</body></html>`;
}
// Fit a long unit or quantity on one line, then stretch the table down to
// the total and signatures on a one-page transfer, as QBM does.
async function layoutScript(pageHeight: number) {
  // Crop each drawn signature to its ink so it fills its space, however
  // small it was drawn inside the signing box.
  for (const img of document.querySelectorAll<HTMLImageElement>(".sign img")) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const { data, width, height } = g.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    let [top, left, bottom, right] = [height, width, -1, -1];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 16) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    if (bottom < 0) continue;
    const pad = 4;
    const crop = document.createElement("canvas");
    crop.width = right - left + 1 + pad * 2;
    crop.height = bottom - top + 1 + pad * 2;
    crop
      .getContext("2d")!
      .drawImage(
        canvas,
        left,
        top,
        crop.width - pad * 2,
        crop.height - pad * 2,
        pad,
        pad,
        crop.width - pad * 2,
        crop.height - pad * 2,
      );
    img.src = crop.toDataURL("image/png");
    await img.decode();
  }
  for (const cell of document.querySelectorAll<HTMLElement>("td.fit")) {
    let size = 8.3;
    while (cell.scrollWidth > cell.clientWidth && size > 5) {
      size -= 0.3;
      cell.style.fontSize = `${size}pt`;
    }
  }
  const height = document.body.scrollHeight;
  const fill = document.querySelector<HTMLElement>("tr.fill td")!;
  if (height <= pageHeight)
    fill.style.height = `${Math.floor(pageHeight - height - 1)}px`;
  return height > pageHeight;
}
// Serverless hosts have no Playwright browser download; they use the
// compressed Chromium build from @sparticuz/chromium instead.
// Playwright is loaded on demand so the rest of the API never depends on it.
async function launchBrowser() {
  const { chromium } = await import("playwright");
  if (!process.env.VERCEL) return chromium.launch({ headless: true });
  const { default: serverless } = await import("@sparticuz/chromium");
  return chromium.launch({
    headless: true,
    executablePath: await serverless.executablePath(),
    args: serverless.args,
  });
}
export async function generatePdf(t: DocumentData) {
  const release = await acquirePdfSlot();
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(await documentHtml(t), { waitUntil: "load" });
    // Letter is 792pt tall. Within the 18pt top and 24pt bottom margins, QBM
    // ends its last signature row 14pt early; heights go in CSS pixels.
    await page.setViewportSize({ width: 816, height: 1056 });
    const pages = await page.evaluate(
      layoutScript,
      ((792 - 42 - 14) * 96) / 72,
    );
    // Page numbers only when the items run onto more than one page.
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: pages,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;text-align:center;font-size:7px;color:#555">${esc(t.number)} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      // 18pt, 24pt, 23pt and 34.6pt; Playwright takes no point units.
      margin: {
        top: "24px",
        bottom: "32px",
        left: "30.67px",
        right: "46.13px",
      },
    });
  } finally {
    await browser?.close();
    release();
  }
}
export type OrderFormData = {
  // ORIGINAL: as the requester sent it. CURRENT: with the source's changes.
  version: "ORIGINAL" | "CURRENT" | "DRAFT";
  number: string;
  creatorName: string;
  supplier: string;
  requester: string;
  createdAt: Date;
  remarks: string;
  lines: {
    code: string;
    description: string;
    quantity: string;
    unit: string;
    note?: string;
    // What the source sends; blank on the original to fill in by hand.
    sourceQty?: string;
    sourceUnit?: string;
  }[];
};
// An open request as the shops' paper ORDER FORM (A4): what was ordered on
// the left; SOURCE STOCK blank for the source to fill in by hand, and the
// item's note (if any) in SOURCE DISCRIPTION. At least the form's 30 numbered
// rows; longer lists continue on the next page under the repeated headings.
export async function orderFormHtml(r: OrderFormData) {
  const [yekan, arimo] = await Promise.all(
    ["YekanBakh-Regular.woff2", "Arimo-Regular.woff2"].map((name) =>
      readFile(path.join(process.cwd(), "public/fonts", name)),
    ),
  );
  const [d, m, y] = r.createdAt
    .toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })
    .split("/");
  const rows = [
    ...r.lines.map(
      (l, i) =>
        `<tr><td class="c">${i + 1}</td><td dir="ltr">${esc(l.code)}</td><td class="c" dir="auto">${esc(l.description)}</td><td dir="ltr">${esc(l.quantity)}</td><td class="unit" dir="auto">${esc(l.unit)}</td><td dir="ltr">${esc(l.sourceQty ?? "")}</td><td class="unit" dir="auto">${esc(l.sourceUnit ?? "")}</td><td class="note" dir="auto">${l.note ? esc(l.note) : ""}</td></tr>`,
    ),
    ...Array.from(
      { length: Math.max(30 - r.lines.length, 0) },
      (_, k) =>
        `<tr><td class="c">${r.lines.length + k + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
    ),
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Arimo;src:url(data:font/woff2;base64,${arimo.toString("base64")})}
@font-face{font-family:Yekan;src:url(data:font/woff2;base64,${yekan.toString("base64")})}
*{box-sizing:border-box}html,body{margin:0}
body{font:10pt Arimo,Yekan,sans-serif;color:#000}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{border:1px solid #000;padding:2px 4px;vertical-align:middle;text-align:left;overflow-wrap:anywhere}
th{font-weight:normal;height:14.25pt}td{height:21.5pt}
thead{display:table-header-group}tr{break-inside:avoid}
.c{text-align:center}.nw,.unit{white-space:nowrap;overflow:hidden}.unit{font-size:8.5pt}
.head td{height:23.45pt}.head span{display:inline-block;margin-right:16px;white-space:nowrap}
.head b{font-weight:normal;border-bottom:1px solid #000;padding:0 4px}
.note{font-size:8pt}
p{margin:8px 0 0}
</style></head><body><table><colgroup><col style="width:5.2%"><col style="width:9.1%"><col style="width:25%"><col style="width:9.1%"><col style="width:9.1%"><col style="width:7.6%"><col style="width:9.1%"><col style="width:25.8%"></colgroup><thead><tr class="head"><td colspan="8"><span>Transfer Order By <b dir="auto">${esc(r.creatorName)}</b></span><span>From <b dir="auto">${esc(r.supplier)}</b></span><span>To <b dir="auto">${esc(r.requester)}</b></span><span>Date : ${y} / ${m} / ${d}</span><span>No. <b>${esc(r.number)}</b></span></td></tr><tr><th colspan="5" class="c">ORDER FORM · ${r.version}</th><th colspan="2">SOURCE STOCK</th><th rowspan="2" class="c">SOURCE<br>DISCRIPTION</th></tr><tr><th class="c nw">NO.</th><th>CODE</th><th class="c">NAME</th><th>QTY</th><th>UNIT</th><th>QTY</th><th>UNIT</th></tr></thead><tbody>${rows.join("")}</tbody></table>${r.remarks ? `<p dir="auto">Remarks: ${esc(r.remarks)}</p>` : ""}</body></html>`;
}
export async function orderFormPdf(r: OrderFormData) {
  const release = await acquirePdfSlot();
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(await orderFormHtml(r), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
  } finally {
    await browser?.close();
    release();
  }
}
