"use client";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eraser, FileText, MapPin, Signature } from "lucide-react";
import { api } from "@/lib/client";
import type { SnapshotLine } from "@/lib/domain";
import { PageTitle, Status, useBuzz } from "./shell";
import { Skeleton } from "./skeleton";
import { Modal } from "./modal";
import { Badge, Button, Card, buttonStyles, cx, table } from "./ui";
import { Empty, LoadError, Pagination, useLoad } from "./data-pages";
type Side = "SOURCE" | "DESTINATION";
export type SignatureView = {
  id?: string;
  side: Side;
  signerName: string;
  signedAt: string;
  image?: string;
};
type SignItem = {
  id: string;
  number: string;
  source: string;
  destination: string;
  date: string;
  approval: string;
  creator: { name: string };
  signatures: SignatureView[];
  canSign: Side[];
};
const sideLabel = { SOURCE: "Sender", DESTINATION: "Receiver" } as const;
function useDate() {
  const { locale } = useBuzz();
  return (value: string, time = false) =>
    new Date(value).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      timeZone: "Asia/Dubai",
    });
}
// The Sign menu: transfers waiting for the viewer's signature, and the ones
// they have already signed.
export function SignPage() {
  const { t } = useBuzz();
  const date = useDate();
  const [tab, setTab] = useState<"waiting" | "signed">("waiting");
  const [page, setPage] = useState(0);
  const { data, error, load } = useLoad<{ items: SignItem[]; count: number }>(
    `sign?tab=${tab}&page=${page}`,
  );
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Sign"
        subtitle="The sender signs for the source location and the receiver for the destination."
      />
      <LoadError error={error} load={load} />
      <Card>
        <div
          className="flex gap-1 border-b border-line p-2 md:p-3"
          role="tablist"
        >
          {(["waiting", "signed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={cx(
                "min-h-11 flex-1 rounded-lg border-0 px-4 text-sm font-semibold transition-colors md:min-h-10 md:flex-none",
                tab === value
                  ? "bg-brand-soft text-brand"
                  : "bg-transparent text-muted hover:bg-zinc-50",
              )}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
            >
              {t(
                value === "waiting"
                  ? "Waiting for my signature"
                  : "Signed by me",
              )}
            </button>
          ))}
        </div>
        {!data ? (
          <Skeleton />
        ) : !data.items.length ? (
          <Empty
            title={
              tab === "waiting"
                ? "Nothing is waiting for your signature"
                : "You have not signed any transfer yet"
            }
          />
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {data.items.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 md:flex-row md:items-center md:gap-5 md:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/sign/${row.id}`}
                        className="inline-flex items-center gap-2 font-semibold text-ink"
                        dir="ltr"
                      >
                        <FileText size={16} className="text-subtle" />
                        {row.number}
                      </Link>
                      <Status value={row.approval} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        {row.source}
                        <ArrowRight size={13} className="rtl:-scale-x-100" />
                        {row.destination}
                      </span>
                      <span className="text-xs text-subtle">
                        {date(row.date)} · {row.creator.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["SOURCE", "DESTINATION"] as const).map((side) => {
                      const signed = row.signatures.find(
                        (s) => s.side === side,
                      );
                      return (
                        <Badge
                          key={side}
                          tone={
                            signed
                              ? "ok"
                              : row.canSign.includes(side)
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {t(sideLabel[side])}:{" "}
                          {signed
                            ? signed.signerName
                            : t(
                                row.canSign.includes(side)
                                  ? "Your signature"
                                  : "Not signed",
                              )}
                        </Badge>
                      );
                    })}
                  </div>
                  {row.canSign.length > 0 ? (
                    <Link
                      href={`/sign/${row.id}`}
                      className={cx(buttonStyles.primary, "md:w-auto")}
                    >
                      <Signature size={16} />
                      {t("Sign")}
                    </Link>
                  ) : (
                    <Link
                      href={`/sign/${row.id}`}
                      className={buttonStyles.secondary}
                    >
                      {t("View")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              count={data.count}
              size={25}
              setPage={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
// One transfer to review and sign: its route, its items and both signatures.
export function SignTransferPage({ id }: { id: string }) {
  const { t } = useBuzz();
  const { data, error, load } = useLoad<
    SignItem & { lines: SnapshotLine[]; remarks: string; total: string }
  >(`sign/${id}`);
  return (
    <>
      <PageTitle
        title="Sign transfer"
        action={
          <Link href="/sign" className={buttonStyles.secondary}>
            <ArrowRight size={16} className="ltr:rotate-180" />
            {t("Back")}
          </Link>
        }
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      {data && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-semibold" dir="ltr">
                {data.number}
              </h2>
              <Status value={data.approval} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
              <MapPin size={16} className="text-brand" />
              <span className="font-medium text-ink">{data.source}</span>
              <ArrowRight size={15} className="rtl:-scale-x-100" />
              <span className="font-medium text-ink">{data.destination}</span>
            </div>
          </Card>
          <SignaturesCard
            transferId={data.id}
            source={data.source}
            destination={data.destination}
            signatures={data.signatures}
            canSign={data.canSign}
            onSigned={load}
          />
          <Card>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    {["Code / Barcode", "Product description", "Quantity"].map(
                      (h) => (
                        <th key={h} className={table.th}>
                          {t(h)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className={table.body}>
                  {data.lines.map((l, i) => (
                    <tr
                      key={i}
                      className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 last:border-b-0 md:table-row md:p-0"
                    >
                      <td
                        className={cx(
                          table.td,
                          "col-start-1 row-start-1 font-semibold",
                        )}
                        dir="ltr"
                      >
                        {l.code}
                      </td>
                      <td
                        className={cx(table.td, "col-span-2 text-sm")}
                        dir="auto"
                      >
                        {l.description}
                        {l.note && (
                          <small
                            className="mt-1 block text-xs text-brand"
                            dir="auto"
                          >
                            {l.note}
                          </small>
                        )}
                      </td>
                      <td
                        className={cx(
                          table.td,
                          "col-start-2 row-start-1 text-end font-semibold tabular-nums md:text-start",
                        )}
                      >
                        {l.quantity}
                        <span className="ms-1 font-normal text-subtle">
                          {l.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line bg-zinc-50/60 px-4 py-3 text-sm text-subtle md:px-5">
              <span>
                {data.lines.length} {t("items")}
              </span>
              <strong className="text-ink">
                {t("Total quantity")}: {Number(data.total)}
              </strong>
            </div>
            {data.remarks && (
              <p
                className="m-0 border-t border-line px-4 py-3 text-sm text-muted md:px-5"
                dir="auto"
              >
                {data.remarks}
              </p>
            )}
          </Card>
        </div>
      )}
    </>
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
  return (
    <Card>
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
                      {date(s.signedAt, true)}
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
