"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { downloadBlob, isMobileDevice, sharePdf } from "@/lib/client";
import { useBuzz } from "./shell";
import { Button, cx, iconButton } from "./ui";

// Prints a PDF made on the server. A computer opens it in a new tab, opened
// at the tap so it is not blocked; a phone hands it to the share sheet
// (Print, Files, WhatsApp), since a Home Screen app on iPhone cannot print a
// PDF it opens. With `body` the PDF is asked for with a POST.
export function PdfPrintButton({
  url,
  fileName,
  label,
  body,
  iconOnly = false,
}: {
  url: string;
  fileName: string;
  label: string;
  body?: unknown;
  iconOnly?: boolean;
}) {
  const { t, toast } = useBuzz();
  const [ready, setReady] = useState<{ key: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `${url}|${JSON.stringify(body ?? null)}`;
  async function print() {
    const mobile = isMobileDevice();
    const tab = mobile ? null : window.open("", "_blank");
    tab?.document.write(
      `<p style="font:16px sans-serif">${t("Preparing PDF…")}</p>`,
    );
    let pdf = ready?.key === key ? ready.file : null;
    if (!pdf) {
      setBusy(true);
      try {
        const res = await fetch(
          url,
          body === undefined
            ? undefined
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              },
        );
        if (!res.ok)
          throw new Error((await res.json().catch(() => ({}))).error);
        pdf = new File([await res.blob()], fileName, {
          type: "application/pdf",
        });
        setReady({ key, file: pdf });
      } catch (e) {
        tab?.close();
        toast(t((e as Error).message || "Request failed"));
        return;
      } finally {
        setBusy(false);
      }
    }
    if (tab) {
      tab.location.href = URL.createObjectURL(pdf);
      return;
    }
    if (!mobile) {
      downloadBlob(pdf, pdf.name);
      return;
    }
    try {
      await sharePdf(pdf);
    } catch (e) {
      const name = (e as Error).name;
      // Fetching can use up the tap the share sheet needs; the PDF is kept,
      // so the next tap opens it at once.
      if (name === "NotAllowedError")
        toast(t("The PDF is ready. Tap Print again."), "ok");
      else if (name !== "AbortError") downloadBlob(pdf, pdf.name);
    }
  }
  if (iconOnly)
    return (
      <button
        type="button"
        className={cx(iconButton, busy && "animate-pulse")}
        aria-label={label}
        title={label}
        disabled={busy}
        onClick={print}
      >
        <Printer size={16} />
      </button>
    );
  return (
    <Button disabled={busy} onClick={print}>
      <Printer size={16} />
      {busy ? t("Preparing PDF…") : label}
    </Button>
  );
}
