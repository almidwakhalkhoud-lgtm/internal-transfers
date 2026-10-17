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
  employee: string;
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
export async function documentHtml(t: DocumentData) {
  const font = await readFile(
    path.join(process.cwd(), "public/fonts/YekanBakh-Regular.woff2"),
  );
  const rows = await Promise.all(
    t.lines.map(async (l) => {
      const code = l.barcodes.find((b) => /^[\x20-\x7e]{1,64}$/.test(b));
      const barcode = code
        ? await bwipjs.toBuffer({
            bcid: "code128",
            text: code,
            scale: 3,
            height: 9,
            includetext: true,
            textsize: 9,
            paddingwidth: 12,
            paddingheight: 3,
            backgroundcolor: "FFFFFF",
          })
        : null;
      return `<tr><td class="code">${esc(l.code)}${barcode ? `<img alt="${esc(code)}" src="data:image/png;base64,${barcode.toString("base64")}">` : ""}</td><td dir="auto">${esc(l.description)}</td><td class="num">${esc(l.quantity)}</td><td dir="auto">${esc(l.unit)}</td></tr>`;
    }),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Yekan;src:url(data:font/woff2;base64,${font.toString("base64")})} @page{size:A4;margin:15mm 12mm 20mm}*{box-sizing:border-box}body{font:11px Arial,Yekan,"Segoe UI",sans-serif;color:#181818}h1{font-size:20px;margin:0 0 5px}.title{text-align:center;margin-bottom:23px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #555;padding:6px;vertical-align:middle;overflow-wrap:anywhere}th{background:#fff;text-align:center}td{border-top:0;border-bottom:0;text-align:center}tbody{border-bottom:1px solid #555}thead{display:table-header-group}tr{break-inside:avoid}img{display:block;max-width:100%;width:auto;height:45px;margin-top:6px}.code{direction:ltr;font-size:10px}.num{text-align:right;direction:ltr}.total{font-weight:bold;text-align:right;padding:14px 0}.signatures{break-inside:avoid;display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:32px}.signature{line-height:3}footer{margin-top:22px;color:#666;font-size:9px}</style></head><body><div class="title"><h1>MEHDI ALI TRADING Co.</h1><div>INTERNAL INVENTORY TRANSFER</div></div><div class="meta"><div>Transfer No: <b>${esc(t.number)}</b></div><div>Date: ${esc(String(t.date).slice(0, 10))}</div><div>From: <b dir="auto">${esc(t.source)}</b></div><div>To: <b dir="auto">${esc(t.destination)}</b></div><div>Status: Confirmed</div><div>Employee: ${esc(t.employee)}</div></div><table><colgroup><col style="width:25%"><col style="width:52%"><col style="width:14%"><col style="width:9%"></colgroup><thead><tr><th>Item</th><th>Description</th><th>Quantity</th><th>Unit</th></tr></thead><tbody>${rows.join("")}</tbody></table><div class="total">Total transferred quantity: ${esc(t.total)}</div>${t.remarks ? `<p dir="auto">Remarks: ${esc(t.remarks)}</p>` : ""}<div class="signatures"><div class="signature">Employee signature: _________________<br>Date: __________________________</div><div class="signature">Manager signature: __________________<br>Date: __________________________</div></div><footer>BUZZ · ${esc(t.number)} · Saved transfer snapshot</footer></body></html>`;
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
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;text-align:center;font-size:8px;color:#777">${esc(t.number)} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: "15mm", bottom: "20mm", left: "12mm", right: "12mm" },
    });
  } finally {
    await browser?.close();
    release();
  }
}
