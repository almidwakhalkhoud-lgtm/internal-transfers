"use client";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, Signature } from "lucide-react";
import { api } from "@/lib/client";
import { useBuzz } from "./shell";
import { Modal } from "./modal";
import { Badge, Button, Card } from "./ui";
type Side = "SOURCE" | "DESTINATION";
export type SignatureView = {
  id?: string;
  side: Side;
  signerName: string;
  signedAt: string;
  image?: string;
};
function useDate() {
  const { locale } = useBuzz();
  return (value: string) =>
    new Date(value).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Dubai",
    });
}
// The signature state of a transfer in Transfer history: amber while it
// waits for the viewer, otherwise how many of the two sides are signed.
export function SignatureBadge({
  signatures,
  canSign,
}: {
  signatures: { side: string; signerName: string }[];
  canSign: Side[];
}) {
  const { t } = useBuzz();
  const names = signatures.map((s) => s.signerName).join(" · ");
  return (
    <span title={names || undefined}>
      <Badge
        tone={
          canSign.length ? "warn" : signatures.length === 2 ? "ok" : "neutral"
        }
      >
        {canSign.length
          ? t("Your signature")
          : `${t("Signed")} ${signatures.length}/2`}
      </Badge>
    </span>
  );
}
// The sender and receiver boxes, used on the Sign page and transfer details.
export function SignaturesCard({
  transferId,
  source,
  destination,
  signatures,
  canSign,
  onSigned,
}: {
  transferId: string;
  source: string;
  destination: string;
  signatures: SignatureView[];
  canSign: Side[];
  onSigned: () => void;
}) {
  const { t } = useBuzz();
  const date = useDate();
  const [signing, setSigning] = useState<Side | null>(null);
  // Opened from Transfer history to sign: bring the boxes into view.
  useEffect(() => {
    if (window.location.hash === "#signatures")
      document
        .getElementById("signatures")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  return (
    <Card id="signatures">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold md:px-5">
        {t("Signatures")}
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {(["SOURCE", "DESTINATION"] as const).map((side) => {
          const s = signatures.find((x) => x.side === side);
          return (
            <div key={side} className="flex flex-col gap-2 bg-white p-4 md:p-5">
              <div className="text-xs text-subtle">
                {t(
                  side === "SOURCE" ? "Sender signature" : "Receiver signature",
                )}{" "}
                ·{" "}
                <span className="font-medium text-ink">
                  {side === "SOURCE" ? source : destination}
                </span>
              </div>
              {s ? (
                <>
                  {s.image && (
                    <img
                      src={s.image}
                      alt={`${t("Signature")} · ${s.signerName}`}
                      className="h-24 w-full rounded-lg border border-line bg-white object-contain"
                    />
                  )}
                  <div className="text-sm">
                    <strong className="font-semibold">{s.signerName}</strong>
                    <span className="block text-xs text-subtle">
                      {date(s.signedAt)}
                    </span>
                  </div>
                </>
              ) : canSign.includes(side) ? (
                <Button
                  variant="primary"
                  className="h-24"
                  onClick={() => setSigning(side)}
                >
                  <Signature size={18} />
                  {t(side === "SOURCE" ? "Sign as sender" : "Sign as receiver")}
                </Button>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-line text-sm text-subtle">
                  {t("Not signed")}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {signing && (
        <SignModal
          transferId={transferId}
          side={signing}
          onClose={() => setSigning(null)}
          onSigned={() => {
            setSigning(null);
            onSigned();
          }}
        />
      )}
    </Card>
  );
}
function SignModal({
  transferId,
  side,
  onClose,
  onSigned,
}: {
  transferId: string;
  side: Side;
  onClose: () => void;
  onSigned: () => void;
}) {
  const { t, toast } = useBuzz();
  const pad = useRef<PadHandle>(null);
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save() {
    const image = pad.current?.image();
    if (!image) return toast(t("Draw your signature first"));
    setBusy(true);
    try {
      await api(`sign/${transferId}`, { side, image });
      toast(t("Signature saved"), "ok");
      onSigned();
    } catch (e) {
      toast(t((e as Error).message));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={side === "SOURCE" ? "Sign as sender" : "Sign as receiver"}
      onClose={() => !busy && onClose()}
    >
      <p className="mt-0 mb-3 text-sm leading-relaxed text-muted">
        {t(
          "Sign inside the box with your finger or mouse. A saved signature cannot be changed.",
        )}
      </p>
      <SignaturePad ref={pad} onInk={setInk} />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button
          disabled={busy || !ink}
          onClick={() => {
            pad.current?.clear();
          }}
        >
          <Eraser size={16} />
          {t("Clear")}
        </Button>
        <Button variant="primary" disabled={busy || !ink} onClick={save}>
          <Signature size={16} />
          {t(busy ? "Please wait…" : "Save signature")}
        </Button>
      </div>
    </Modal>
  );
}
type PadHandle = { image: () => string | null; clear: () => void };
// A drawing box for a hand signature, crisp on high-density screens.
function SignaturePad({
  ref,
  onInk,
}: {
  ref: React.Ref<PadHandle>;
  onInk: (ink: boolean) => void;
}) {
  const { t } = useBuzz();
  const canvas = useRef<HTMLCanvasElement>(null);
  const inked = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = canvas.current!;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * scale;
    c.height = c.clientHeight * scale;
    const g = c.getContext("2d")!;
    g.scale(scale, scale);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 2.5;
    g.strokeStyle = "#111827";
  }, []);
  useImperativeHandle(ref, () => ({
    image: () =>
      inked.current ? canvas.current!.toDataURL("image/png") : null,
    clear: () => {
      const c = canvas.current!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      inked.current = false;
      onInk(false);
    },
  }));
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <canvas
      ref={canvas}
      aria-label={t("Signature box")}
      className="block h-48 w-full cursor-crosshair touch-none rounded-xl border border-line bg-zinc-50"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = point(e);
        const g = e.currentTarget.getContext("2d")!;
        g.beginPath();
        g.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
        g.fillStyle = "#111827";
        g.fill();
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        const p = point(e);
        const g = e.currentTarget.getContext("2d")!;
        g.beginPath();
        g.moveTo(last.current.x, last.current.y);
        g.lineTo(p.x, p.y);
        g.stroke();
        last.current = p;
        if (!inked.current) {
          inked.current = true;
          onInk(true);
        }
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}
