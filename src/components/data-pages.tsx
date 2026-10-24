"use client";
import { dateLocale } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import { Form } from "@/components/form";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { DatePicker } from "./date-picker";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "./skeleton";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Clock3,
  CheckCircle2,
  Package,
  Search,
  MapPin,
  Upload,
  SlidersHorizontal,
  FileText,
  Trash2,
  Plus,
  Hash,
} from "lucide-react";
import { api } from "@/lib/client";
import { hasMenu } from "@/lib/permissions";
import { PageTitle, NewTransferLink, Status, useBuzz } from "./shell";
import {
  Button,
  Card,
  Field,
  Notice,
  CardHeader,
  CellLabel,
  buttonStyles,
  cx,
  iconButton,
  inputStyles,
  linkButton,
  table,
} from "./ui";
import { SuccessActions, Modal, type Product } from "./transfer-form";
import {
  SignatureBadge,
  SignaturesCard,
  type SignatureView,
} from "./signatures";
import type { SnapshotLine, CatalogRow } from "@/lib/domain";
import {
  validateCatalog,
  unitsFromDescription,
  outerUnits,
  numberFor,
  sequenceOf,
} from "@/lib/domain";
type Summary = {
  id: string;
  number: string;
  source: string;
  destination: string;
  date: string;
  total: string;
  approval: string;
  creator: { name: string };
  qbmEntry?: { reference: string; enteredAt: string } | null;
  signatures?: { side: string; signerName: string }[];
  canSign?: ("SOURCE" | "DESTINATION")[];
};
export function useLoad<T>(path: string) {
  const sequence = useRef(0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const request = ++sequence.current;
    api<T>(path)
      .then((data) => {
        if (request !== sequence.current) return;
        setData(data);
        setError("");
      })
      .catch((e) => {
        if (request === sequence.current) setError(e.message);
      });
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load };
}
export function LoadError({
  error,
  load,
}: {
  error: string;
  load: () => void;
}) {
  const { t } = useBuzz();
  return error ? (
    <div
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
      role="alert"
    >
      <span>{t(error)}</span>
      <button
        type="button"
        className="min-h-9 shrink-0 rounded-md border-0 bg-transparent px-2 font-semibold underline underline-offset-2"
        onClick={load}
      >
        {t("Retry")}
      </button>
    </div>
  ) : null;
}
export function TransferTable({ items }: { items: Summary[] }) {
  const { t, locale } = useBuzz();
  const date = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale(locale), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Dubai",
    });
  if (!items.length) return <Empty title="No transfers yet" />;
  return (
    <div className={table.wrap}>
      <table className={table.table}>
        <thead className={table.head}>
          <tr>
            {[
              "Transfer number",
              "Date",
              "Route",
              "Total quantity",
              "Approval",
              "Created by",
              "",
            ].map((h) => (
              <th key={h} className={table.th}>
                {h && t(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={table.body}>
          {items.map((row) => (
            <tr
              key={row.id}
              className="relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-zinc-50/60 md:table-row md:p-0"
            >
              <td className={table.td}>
                <Link
                  className="inline-flex items-center gap-2 font-semibold text-ink after:absolute after:inset-0 md:after:hidden"
                  href={`/transfers/${row.id}`}
                  dir="ltr"
                >
                  <FileText size={16} className="text-subtle" />
                  {row.number}
                </Link>
              </td>
              <td
                className={cx(
                  table.td,
                  "col-start-2 row-start-2 text-end text-xs text-subtle md:text-start md:text-sm",
                )}
              >
                {date(row.date)}
              </td>
              <td className={cx(table.td, "col-start-1 row-start-2")}>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted md:text-ink">
                  {row.source}
                  <ArrowRight size={13} className="rtl:-scale-x-100" />
                  {row.destination}
                </span>
              </td>
              <td
                className={cx(
                  table.td,
                  "col-start-1 row-start-3 text-xs text-subtle md:text-sm md:text-ink",
                )}
              >
                <CellLabel>{t("Total quantity")}</CellLabel>
                <span dir="ltr">{Number(row.total).toLocaleString()}</span>
              </td>
              <td
                className={cx(
                  table.td,
                  "col-start-2 row-start-1 text-end md:text-start",
                )}
              >
                <span className="inline-flex flex-wrap justify-end gap-1 md:justify-start">
                  <Status value={row.approval} />
                  {row.qbmEntry && <QbmBadge entry={row.qbmEntry} />}
                  {row.signatures && (
                    <SignatureBadge
                      signatures={row.signatures}
                      canSign={row.canSign ?? []}
                    />
                  )}
                </span>
              </td>
              <td
                className={cx(
                  table.td,
                  "col-start-2 row-start-3 text-end text-xs text-subtle md:text-start md:text-sm md:text-ink",
                )}
              >
                {row.creator.name}
              </td>
              <td className={cx(table.td, "hidden md:table-cell")}>
                <Link
                  className={iconButton}
                  aria-label={t("View transfer")}
                  href={`/transfers/${row.id}`}
                >
                  <ArrowUpRight size={16} className="rtl:-scale-x-100" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// Shown once the QBM entry app reports that it typed the transfer into QBM.
function QbmBadge({ entry }: { entry: { reference: string } }) {
  const { t } = useBuzz();
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-sky-100 bg-sky-50 px-2 py-1 text-xs whitespace-nowrap text-sky-800"
      title={`${t("Entered in QBM")} · ${entry.reference}`}
    >
      <CheckCircle2 size={12} />
      QBM <span dir="ltr">{entry.reference}</span>
    </span>
  );
}
export function Empty({ title }: { title: string }) {
  const { t } = useBuzz();
  return (
    <div className="px-5 py-10 text-center">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-subtle">
        <Package size={24} />
      </span>
      <p className="m-0 text-sm text-subtle">{t(title)}</p>
    </div>
  );
}
export function Dashboard() {
  const { t, user } = useBuzz();
  const { data, error, load } = useLoad<{
    total: number;
    pending: number;
    approved: number;
    products: number;
    recent: Summary[];
  }>("dashboard");
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Overview"
        subtitle="Ready for your next transfer"
        action={<NewTransferLink />}
      />
      <LoadError error={error} load={load} />
      <div className="mb-4 flex items-center justify-between gap-6 overflow-hidden rounded-xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white md:mb-6 md:p-8">
        <div className="min-w-0">
          <span className="text-[11px] tracking-[0.18em] text-white/70 uppercase">
            BUZZ / {t("Internal transfers")}
          </span>
          <h2 className="mt-2 mb-1.5 text-xl font-semibold md:text-2xl">
            {t("Move stock. Keep clarity.")}
          </h2>
          <p className="m-0 text-sm leading-relaxed text-white/80">
            {t("Prepare, confirm and share inventory transfer documents.")}
          </p>
          <Link
            href="/new-transfer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand hover:bg-white/90 md:min-h-10"
          >
            {t("Create transfer")}
            <ArrowRight size={16} className="rtl:-scale-x-100" />
          </Link>
        </div>
        <div
          className="hidden shrink-0 items-center gap-3 text-white/80 sm:flex"
          aria-hidden="true"
        >
          <span
            data-float
            className="flex size-14 items-center justify-center rounded-2xl bg-white/15 motion-safe:animate-[workspace-float_3.6s_ease-in-out_infinite]"
          >
            <Package size={28} />
          </span>
          <span className="w-8 border-t-2 border-dashed border-white/40" />
          <ArrowLeftRight size={22} />
          <span className="w-8 border-t-2 border-dashed border-white/40" />
          <span
            data-float
            className="flex size-14 items-center justify-center rounded-2xl bg-white/15 motion-safe:animate-[workspace-float_3.6s_ease-in-out_infinite]"
          >
            <MapPin size={28} />
          </span>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:gap-4 xl:grid-cols-4">
        {(
          [
            ["All transfers", data?.total, ArrowLeftRight],
            ["Awaiting review", data?.pending, Clock3],
            ["Approved transfers", data?.approved, CheckCircle2],
            ["Catalog products", data?.products, Package],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            className="rounded-xl border border-line bg-white p-4 md:p-5"
            key={label}
          >
            <div className="flex items-start justify-between gap-2 text-xs text-subtle md:text-sm">
              <span>{t(label)}</span>
              <Icon size={18} className="shrink-0 text-brand" />
            </div>
            <strong className="mt-2 block text-2xl font-semibold tabular-nums md:text-3xl">
              {value?.toLocaleString() ?? "—"}
            </strong>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title={t("Recent transfers")}>
          <Link href="/transfers" className={linkButton}>
            {t("View all")}
            <ArrowRight size={15} className="ms-1 rtl:-scale-x-100" />
          </Link>
        </CardHeader>
        {data ? <TransferTable items={data.recent} /> : <Skeleton />}
      </Card>
      <div className="mt-5 flex flex-col gap-1 text-xs text-subtle md:flex-row md:justify-between">
        <span>
          {user.name} · {t(user.role === "ADMIN" ? "Administrator" : "Staff")}
        </span>
        <span>
          {t(
            "Confirmed documents are permanent. Administrator approval is tracked separately.",
          )}
        </span>
      </div>
    </>
  );
}
export function HistoryPage() {
  const { t, user } = useBuzz();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const searchParams = useSearchParams();
  const [creator, setCreator] = useState(searchParams.get("creator") ?? "");
  const [sign, setSign] = useState(searchParams.get("sign") ?? "");
  const locations = useLoad<{ id: string; name: string }[]>("locations");
  const users = useLoad<{ id: string; name: string }[]>(
    user.role === "ADMIN" ? "users" : "locations",
  );
  const params = new URLSearchParams({
    q: query,
    status,
    page: String(page),
    from,
    to,
    source,
    destination,
    sign,
    ...(user.role === "ADMIN" ? { creator } : {}),
  });
  const { data, error, load } = useLoad<{ items: Summary[]; count: number }>(
    `transfers?${params}`,
  );
  // On phones the filters fold behind one button; the badge counts the set ones.
  const [filters, setFilters] = useState(false);
  const active = [status, from, to, source, destination, creator, sign].filter(
    Boolean,
  ).length;
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Transfer history"
        action={<NewTransferLink />}
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      <Card>
        <Form
          className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:flex-wrap md:items-center md:gap-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(q);
          }}
        >
          <div className="flex gap-2 md:contents">
            <div className="relative flex-1 md:max-w-xs md:min-w-48">
              <Search
                size={17}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle"
              />
              <input
                className={cx(inputStyles, "ps-10")}
                aria-label={t("Transfer number")}
                placeholder={t("Transfer number")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button
              className="md:hidden"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={16} />
              {t("Filter")}
              {active > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-xs text-white">
                  {active}
                </span>
              )}
            </Button>
          </div>
          <div
            className={cx(
              "grid grid-cols-1 gap-2 sm:grid-cols-2 md:contents",
              !filters && "max-md:hidden",
            )}
          >
            <Dropdown
              className="md:w-44"
              aria-label={t("Status")}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">{t("All statuses")}</option>
              {["PENDING", "APPROVED", "REJECTED", "RECEIVED"].map((s) => (
                <option key={s} value={s}>
                  {t(s[0] + s.slice(1).toLowerCase())}
                </option>
              ))}
            </Dropdown>
            <Dropdown
              className="md:w-52"
              aria-label={t("Signatures")}
              value={sign}
              onChange={(e) => {
                setSign(e.target.value);
                setPage(0);
              }}
            >
              <option value="">{t("All signatures")}</option>
              <option value="waiting">{t("Waiting for my signature")}</option>
            </Dropdown>
            <div className="md:w-44">
              <DatePicker
                label={t("Start date")}
                value={from}
                onChange={setFrom}
                clearable
              />
            </div>
            <div className="md:w-44">
              <DatePicker
                label={t("End date")}
                value={to}
                onChange={setTo}
                clearable
              />
            </div>
            <Dropdown
              className="md:w-44"
              aria-label={t("From location")}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">{t("From location")}</option>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Dropdown>
            <Dropdown
              className="md:w-44"
              aria-label={t("To location")}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">{t("To location")}</option>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Dropdown>
            {user.role === "ADMIN" && (
              <Dropdown
                className="md:w-44"
                aria-label={t("Created by")}
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
              >
                <option value="">{t("Created by")}</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Dropdown>
            )}
            <Button type="submit" variant="primary">
              <Search size={16} />
              {t("Search")}
            </Button>
          </div>
        </Form>
        {data ? (
          <>
            <TransferTable items={data.items} />
            <Pagination
              page={page}
              count={data.count}
              size={25}
              setPage={setPage}
            />
          </>
        ) : (
          <Skeleton />
        )}
      </Card>
    </>
  );
}
export function Pagination({
  page,
  count,
  size,
  setPage,
}: {
  page: number;
  count: number;
  size: number;
  setPage: (page: number) => void;
}) {
  const { t } = useBuzz();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-subtle md:px-5">
      <span>
        {count
          ? `${page * size + 1}–${Math.min((page + 1) * size, count)}`
          : "0"}{" "}
        / {count.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <button
          className={buttonStyles.secondary}
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          {t("Previous")}
        </button>
        <button
          className={buttonStyles.secondary}
          disabled={(page + 1) * size >= count}
          onClick={() => setPage(page + 1)}
        >
          {t("Next")}
        </button>
      </div>
    </div>
  );
}
export function DetailPage({ id }: { id: string }) {
  const { t, user } = useBuzz();
  const { data, error, load } = useLoad<
    Summary & {
      lines: SnapshotLine[];
      remarks: string;
      pdfReady: boolean;
      request: { id: string; number: string } | null;
      signatures: SignatureView[];
      canSign: ("SOURCE" | "DESTINATION")[];
    }
  >(`transfers/${id}`);
  const [err, setErr] = useState("");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  async function remove() {
    setBusy(true);
    try {
      await api(`transfers/${id}`, { reason }, "DELETE");
      router.push("/transfers");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setDeleting(false);
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Transfer details"
        action={
          <Link href="/transfers" className={buttonStyles.secondary}>
            <ArrowRight size={16} className="ltr:rotate-180" />
            {t("Back")}
          </Link>
        }
      />
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton />}
      {data && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-semibold" dir="ltr">
                {data.number}
              </h2>
              <span className="flex flex-wrap gap-1.5">
                <Status value={data.approval} />
                {data.qbmEntry && <QbmBadge entry={data.qbmEntry} />}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
              <MapPin size={16} className="text-brand" />
              <span className="font-medium text-ink">{data.source}</span>
              <ArrowRight size={15} className="rtl:-scale-x-100" />
              <span className="font-medium text-ink">{data.destination}</span>
            </div>
            {data.request && (
              <p className="mt-2 mb-0 text-sm text-muted">
                {t("From request")}:{" "}
                {hasMenu(user, "requests") ? (
                  <Link
                    className="font-semibold text-brand hover:underline"
                    href={`/requests/${data.request.id}`}
                    dir="ltr"
                  >
                    {data.request.number}
                  </Link>
                ) : (
                  <strong className="text-ink" dir="ltr">
                    {data.request.number}
                  </strong>
                )}
              </p>
            )}
            {user.role === "ADMIN" && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:flex sm:flex-wrap">
                {(data.approval === "PENDING"
                  ? ["APPROVED", "REJECTED"]
                  : data.approval === "APPROVED"
                    ? ["RECEIVED"]
                    : []
                ).map((s) => (
                  <Button
                    key={s}
                    variant={s === "REJECTED" ? "secondary" : "primary"}
                    onClick={async () => {
                      try {
                        await api(`transfers/${id}`, { approval: s }, "PATCH");
                        load();
                      } catch (e) {
                        setErr((e as Error).message);
                      }
                    }}
                  >
                    {t(
                      s === "APPROVED"
                        ? "Approve"
                        : s === "REJECTED"
                          ? "Reject"
                          : "Mark received",
                    )}
                  </Button>
                ))}
                <Button
                  className="col-span-2 sm:ms-auto"
                  onClick={() => setRenumbering(true)}
                >
                  <Hash size={16} />
                  {t("Change number")}
                </Button>
                <Button
                  variant="danger"
                  className="col-span-2"
                  onClick={() => {
                    setReason("");
                    setDeleting(true);
                  }}
                >
                  <Trash2 size={16} />
                  {t("Delete transfer")}
                </Button>
              </div>
            )}
          </Card>
          {renumbering && (
            <RenumberModal
              id={data.id}
              number={data.number}
              onClose={() => setRenumbering(false)}
              onSaved={() => {
                setRenumbering(false);
                load();
              }}
            />
          )}
          {deleting && (
            <Modal
              title="Delete transfer"
              onClose={() => !busy && setDeleting(false)}
            >
              <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
                {t(
                  "The confirmed transfer and its saved PDF will be permanently deleted. A full copy is kept in the audit log.",
                )}
              </p>
              <dl className="m-0 mb-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-sm">
                <dt className="text-subtle">{t("Transfer number")}</dt>
                <dd className="m-0 text-end font-semibold" dir="ltr">
                  {data.number}
                </dd>
                <dt className="text-subtle">{t("Route")}</dt>
                <dd className="m-0 text-end font-semibold">
                  {data.source} → {data.destination}
                </dd>
              </dl>
              <Field label={t("Reason (optional)")}>
                <textarea
                  className={cx(inputStyles, "min-h-20 py-2")}
                  value={reason}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button
                  data-initial-focus
                  disabled={busy}
                  onClick={() => setDeleting(false)}
                >
                  {t("Cancel")}
                </Button>
                <Button variant="dangerSolid" disabled={busy} onClick={remove}>
                  <Trash2 size={16} />
                  {t(busy ? "Please wait…" : "Delete transfer")}
                </Button>
              </div>
            </Modal>
          )}
          <Card>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    {[
                      "Code / Barcode",
                      "Product description",
                      "Quantity",
                      "Unit",
                    ].map((h) => (
                      <th key={h} className={table.th}>
                        {t(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={table.body}>
                  {data.lines.map((l, i) => (
                    <tr
                      key={i}
                      className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 last:border-b-0 md:table-row md:p-0"
                    >
                      <td
                        className={cx(table.td, "col-start-1 row-start-1")}
                        dir="ltr"
                      >
                        <span className="font-semibold">{l.code}</span>
                        {l.barcodes.length > 0 && (
                          <small className="block text-xs text-subtle">
                            {l.barcodes.join(" · ")}
                          </small>
                        )}
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
                        <span className="ms-1 font-normal text-subtle md:hidden">
                          {l.unit}
                        </span>
                      </td>
                      <td className={cx(table.td, "hidden md:table-cell")}>
                        {l.unit}
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
          <SignaturesCard
            transferId={data.id}
            source={data.source}
            destination={data.destination}
            signatures={data.signatures}
            canSign={data.canSign}
            onSigned={load}
          />
          <SuccessActions
            transfer={data}
            version={[data.number, ...data.signatures.map((s) => s.side)].join(
              ",",
            )}
          />
        </div>
      )}
    </>
  );
}
// Brings a transfer's number back in step with QBM. The route letters stay;
// the server rebuilds the PDF and moves the Settings counter to follow.
function RenumberModal({
  id,
  number,
  onClose,
  onSaved,
}: {
  id: string;
  number: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, toast } = useBuzz();
  const [value, setValue] = useState(String(sequenceOf(number)));
  const [busy, setBusy] = useState(false);
  const dash = number.lastIndexOf("-");
  const valid = /^[1-9][0-9]{0,8}$/.test(value);
  const next = valid
    ? numberFor(Number(value), dash < 0 ? "" : number.slice(0, dash))
    : "";
  async function save() {
    setBusy(true);
    try {
      await api(`transfers/${id}`, { number: Number(value) }, "PATCH");
      toast(t("Transfer number changed"), "ok");
      onSaved();
    } catch (e) {
      toast(t((e as Error).message));
      setBusy(false);
    }
  }
  return (
    <Modal title="Change number" onClose={() => !busy && onClose()}>
      <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
        {t(
          "Use this when the number is out of step with QBM. The PDF is made again with the new number, and the next transfer number in Settings follows the highest number.",
        )}
      </p>
      <Field label={t("New number")}>
        <input
          className={inputStyles}
          inputMode="numeric"
          dir="ltr"
          data-initial-focus
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </Field>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-sm">
        <dt className="text-subtle">{t("Current number")}</dt>
        <dd className="m-0 text-end font-semibold" dir="ltr">
          {number}
        </dd>
        <dt className="text-subtle">{t("New number")}</dt>
        <dd className="m-0 text-end font-semibold" dir="ltr">
          {next || "—"}
        </dd>
      </dl>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={busy} onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={busy || !valid || next === number}
          onClick={save}
        >
          <Hash size={16} />
          {t(busy ? "Please wait…" : "Save number")}
        </Button>
      </div>
    </Modal>
  );
}
export function ProductsPage() {
  const { t, user } = useBuzz();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, error, load } = useLoad<{ items: Product[]; count: number }>(
    `products?q=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Products"
        subtitle="Product codes and barcodes are matched exactly. Units come from the (1xN) pack size in the name."
        action={
          user.role === "ADMIN" && (
            <>
              <div className="flex gap-2">
                <Button onClick={() => setCreating(true)}>
                  <Plus size={17} />
                  {t("New product")}
                </Button>
                <Button variant="primary" onClick={() => setImporting(true)}>
                  <Upload size={17} />
                  {t("Import catalog")}
                </Button>
              </div>
            </>
          )
        }
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      <Card>
        <Form
          className="flex flex-wrap items-center gap-2 border-b border-line p-3 md:gap-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q);
            setPage(0);
          }}
        >
          <div className="relative min-w-0 flex-1 md:max-w-md">
            <Search
              size={17}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              type="search"
              className={cx(inputStyles, "ps-10")}
              placeholder={t("Search code, barcode or description")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit">{t("Search")}</Button>
          <span className="w-full text-sm text-subtle md:ms-auto md:w-auto">
            {data?.count.toLocaleString() ?? "—"} {t("Products")}
          </span>
        </Form>
        {data && !data.items.length ? (
          <Empty title="No products found" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.head}>
                <tr>
                  {[
                    "Code / Barcode",
                    "Product description",
                    "Units",
                    "Barcodes",
                    "",
                  ].map((h) => (
                    <th key={h} className={table.th}>
                      {h && t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={table.body}>
                {data?.items.map((p) => (
                  <tr
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 md:table-row md:p-0"
                  >
                    <td
                      className={cx(
                        table.td,
                        "col-start-1 row-start-1 font-mono text-sm font-semibold",
                      )}
                      dir="ltr"
                    >
                      {p.code}
                    </td>
                    <td
                      className={cx(table.td, "col-span-2 text-sm")}
                      dir="auto"
                    >
                      {p.description}
                    </td>
                    <td
                      className={cx(table.td, "col-span-2 text-xs md:text-sm")}
                    >
                      {p.units.length ? (
                        <span className="flex flex-wrap gap-1" dir="ltr">
                          {p.units.map((u) => (
                            <span
                              key={u}
                              className="rounded-md bg-brand-soft px-1.5 py-0.5 text-brand"
                            >
                              {u}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-subtle">{t("No unit")}</span>
                      )}
                    </td>
                    <td
                      className={cx(
                        table.td,
                        "col-span-2 text-xs text-subtle md:text-sm",
                        !p.barcodes.length && "max-md:hidden",
                      )}
                      dir="ltr"
                    >
                      {p.barcodes.map((b) => b.value).join(" · ") || "—"}
                    </td>
                    <td
                      className={cx(
                        table.td,
                        "col-start-2 row-start-1 text-end",
                      )}
                    >
                      {user.role === "ADMIN" && (
                        <button
                          type="button"
                          className={cx(linkButton, "-my-2.5 md:my-0")}
                          onClick={() => setEditing(p)}
                        >
                          {t("Edit")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pagination
            page={page}
            count={data.count}
            size={50}
            setPage={setPage}
          />
        )}
      </Card>
      {user.role === "ADMIN" && <Conflicts />}
      {importing && (
        <CatalogImport
          onClose={() => {
            setImporting(false);
            load();
          }}
        />
      )}
      {(editing || creating) && (
        <ProductForm
          product={editing}
          onClose={(saved) => {
            setEditing(null);
            setCreating(false);
            if (saved) load();
          }}
        />
      )}
    </>
  );
}
function ProductForm({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: (saved: boolean) => void;
}) {
  const { t } = useBuzz();
  const [description, setDescription] = useState(product?.description ?? "");
  const [outer, setOuter] = useState<string>(
    product?.units[0]?.replace(/\(.*/, "") ?? "CTN",
  );
  const [units, setUnits] = useState<string[]>(product?.units ?? []);
  const [adding, setAdding] = useState("");
  // A new product follows its name until the admin types units themselves.
  const [unitsTouched, setUnitsTouched] = useState(Boolean(product));
  const [err, setErr] = useState("");
  const detect = (name: string, outerUnit: string) =>
    setUnits(unitsFromDescription(name, outerUnit));
  const add = (unit: string) => {
    const value = unit.trim();
    if (value && !units.includes(value)) setUnits([...units, value]);
    setUnitsTouched(true);
    setAdding("");
  };
  const split = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  return (
    <Modal
      title={product ? "Edit product" : "New product"}
      onClose={() => onClose(false)}
    >
      <Form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body = {
            description,
            units,
            barcodes: split(f.get("barcodes")),
          };
          try {
            if (product) await api(`products/${product.id}`, body, "PATCH");
            else
              await api("products", { ...body, code: f.get("code") }, "POST");
            onClose(true);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        {err && <Notice tone="error">{t(err)}</Notice>}
        {product ? (
          <p
            className="m-0 font-mono text-base font-semibold text-ink"
            dir="ltr"
          >
            {product.code}
          </p>
        ) : (
          <Field label={t("Product code")}>
            <input
              className={inputStyles}
              name="code"
              required
              dir="ltr"
              autoComplete="off"
            />
          </Field>
        )}
        <Field label={t("Product description")}>
          <textarea
            className={cx(inputStyles, "min-h-20 py-2")}
            name="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (!unitsTouched) detect(e.target.value, outer);
            }}
            required
          />
        </Field>
        <Field label={t("Outer unit for (1xN)")}>
          <select
            className={inputStyles}
            value={outer}
            onChange={(e) => {
              setOuter(e.target.value);
              detect(description, e.target.value);
            }}
          >
            {outerUnits.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        <fieldset className="m-0 flex flex-col gap-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium text-muted">
            {t("Units")}
          </legend>
          <div className="flex min-h-9 flex-wrap items-center gap-2" dir="ltr">
            {units.length ? (
              units.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-soft py-1 ps-2.5 pe-1 text-sm font-semibold text-brand"
                >
                  {u}
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md border-0 bg-transparent text-base text-brand hover:bg-brand/10"
                    aria-label={`${t("Remove")} ${u}`}
                    onClick={() => {
                      setUnits(units.filter((x) => x !== u));
                      setUnitsTouched(true);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-sm text-subtle">{t("No unit")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className={cx(inputStyles, "flex-1")}
              value={adding}
              placeholder="CTN(1x20)"
              aria-label={t("Add unit")}
              dir="ltr"
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(adding);
                }
              }}
            />
            <Button disabled={!adding.trim()} onClick={() => add(adding)}>
              {t("Add unit")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {["PCS", "CTN", "BOX", "DOZEN", "SET", "PKTS"].map((u) => (
              <button
                key={u}
                type="button"
                className="min-h-9 rounded-lg border border-dashed border-line bg-white px-2.5 text-sm font-semibold text-brand hover:border-brand disabled:opacity-35"
                disabled={units.includes(u)}
                onClick={() => add(u)}
              >
                + {u}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-2">
            <button
              type="button"
              className={linkButton}
              onClick={() => detect(description, outer)}
            >
              {t("Detect units from description")}
            </button>
            <button
              type="button"
              className={cx(linkButton, "text-red-700")}
              disabled={!units.length}
              onClick={() => {
                setUnits([]);
                setUnitsTouched(true);
              }}
            >
              {t("No unit")}
            </button>
          </div>
        </fieldset>
        <p className="m-0 text-xs leading-relaxed text-subtle">
          {t(
            "(1xN) gives the outer unit and PCS; (1xNxM) gives CTN, BOX and PCS. No pack size, no units.",
          )}
        </p>
        <Field label={t("Barcodes")}>
          <input
            className={inputStyles}
            name="barcodes"
            defaultValue={product?.barcodes.map((b) => b.value).join("|")}
            dir="ltr"
          />
          <span className="text-xs font-normal text-subtle">
            {t("Separate multiple values with |")}
          </span>
        </Field>
        <Button type="submit" variant="primary">
          {t(product ? "Save changes" : "Add product")}
        </Button>
      </Form>
    </Modal>
  );
}
function CatalogImport({ onClose }: { onClose: () => void }) {
  const { t } = useBuzz();
  const [sheets, setSheets] = useState<Record<string, string[][]>>({});
  const [sheet, setSheet] = useState("");
  const [map, setMap] = useState({
    code: "0",
    description: "1",
    barcodes: "",
    units: "",
  });
  const [source, setSource] = useState("ITEMS.xls");
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const cells = sheets[sheet] ?? [];
  return (
    <Modal title="Catalog import" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-muted">
          {t(
            "Product codes and barcodes are matched exactly. Units are never inferred.",
          )}
        </p>
        <Field label={t("Source")}>
          <Dropdown value={source} onChange={(e) => setSource(e.target.value)}>
            <option>ITEMS.xls</option>
            <option>mehdiali.om export</option>
          </Dropdown>
        </Field>
        <Field label={t("Choose workbook")}>
          <input
            className="block w-full text-sm text-muted file:me-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:font-semibold file:text-brand md:file:min-h-10"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 15 * 1024 * 1024) {
                setErrors(["Maximum file size: 15 MB"]);
                return;
              }
              try {
                const XLSX = await import("xlsx");
                const workbook = XLSX.read(await file.arrayBuffer(), {
                  type: "array",
                });
                const all = Object.fromEntries(
                  workbook.SheetNames.map((name) => [
                    name,
                    XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
                      header: 1,
                      raw: false,
                      defval: "",
                    }),
                  ]),
                );
                setSheets(all);
                setSheet(workbook.SheetNames[0]);
                setRows(null);
                setErrors([]);
              } catch {
                setErrors(["Could not read workbook"]);
              }
            }}
          />
        </Field>
        {Object.keys(sheets).length > 0 && (
          <>
            <Field label={t("Worksheet")}>
              <Dropdown
                value={sheet}
                onChange={(e) => {
                  setSheet(e.target.value);
                  setRows(null);
                }}
              >
                {Object.keys(sheets).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Dropdown>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["code", "description", "barcodes", "units"] as const).map(
                (field, i) => (
                  <Field
                    key={field}
                    label={t(
                      [
                        "Item code column",
                        "Description column",
                        "Barcode column",
                        "Unit column",
                      ][i],
                    )}
                  >
                    <Dropdown
                      value={map[field]}
                      onChange={(e) => {
                        setMap((m) => ({ ...m, [field]: e.target.value }));
                        setRows(null);
                      }}
                    >
                      <option value="">{t("Not supplied")}</option>
                      {cells[0]?.map((value, index) => (
                        <option value={index} key={index}>
                          {value || index + 1}
                        </option>
                      ))}
                    </Dropdown>
                  </Field>
                ),
              )}
            </div>
            <Button
              onClick={() => {
                const proposed = cells
                  .slice(1)
                  .filter((r) => r.some(Boolean))
                  .map((r) => ({
                    code: r[Number(map.code)]?.trim() ?? "",
                    description: r[Number(map.description)]?.trim() ?? "",
                    barcodes:
                      map.barcodes !== ""
                        ? (r[Number(map.barcodes)] ?? "")
                            .split("|")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [],
                    units:
                      map.units !== ""
                        ? (r[Number(map.units)] ?? "")
                            .split(/[|,]/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [],
                  }));
                setErrors(validateCatalog(proposed));
                setRows(proposed);
              }}
            >
              {t("Preview import")}
            </Button>
          </>
        )}
        {rows && (
          <>
            <p className="m-0 text-sm font-semibold">
              {rows.length.toLocaleString()} {t("Rows")}
            </p>
            <div className="flex flex-col gap-1 rounded-xl bg-zinc-50 p-3 text-xs">
              {rows.slice(0, 5).map((r, i) => (
                <div key={i} className="truncate">
                  <b>{r.code}</b> · <span dir="auto">{r.description}</span> ·{" "}
                  {r.units.join("|") || "—"}
                </div>
              ))}
            </div>
            <Button
              variant="primary"
              disabled={!!errors.length || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api<{
                    imported: number;
                    conflicts: number;
                  }>("catalog/import", { rows, source });
                  setMessage(
                    `${t("Import complete")}: ${result.imported} · ${t("Conflicts")}: ${result.conflicts}`,
                  );
                  setRows(null);
                } catch (e) {
                  setErrors([(e as Error).message]);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(busy ? "Please wait…" : "Import validated rows")}
            </Button>
          </>
        )}
        {!!errors.length && (
          <Notice tone="error">
            <span className="whitespace-pre-line">
              {errors.slice(0, 10).join("\n")}
            </span>
          </Notice>
        )}
        {message && <Notice>{message}</Notice>}
      </div>
    </Modal>
  );
}
function Conflicts() {
  const { t } = useBuzz();
  const [page, setPage] = useState(0);
  const { data, error, load } = useLoad<{
    items: {
      id: string;
      code: string;
      source: string;
      existing: unknown;
      proposed: unknown;
      current: unknown;
      currentVersion: string | null;
    }[];
    count: number;
  }>(`catalog/conflicts?page=${page}`);
  const [err, setErr] = useState("");
  return (
    <Card className="mt-4 md:mt-6">
      <div className="flex flex-col gap-1 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <h2 className="m-0 flex items-center gap-2 text-base font-semibold">
          {t("Review conflicts")}
          <span className="rounded-md bg-amber-50 px-1.5 text-xs text-amber-800">
            {data?.count ?? 0}
          </span>
        </h2>
        <p className="m-0 text-xs text-subtle md:text-sm">
          {t("Review source conflicts before applying updates.")}
        </p>
      </div>
      <LoadError error={error || err} load={load} />
      {!data?.items.length ? (
        <p className="m-0 px-4 py-4 text-sm text-subtle md:px-6">
          {t("No pending conflicts")}
        </p>
      ) : (
        data.items.map((c) => (
          <details
            key={c.id}
            className="group border-b border-line last:border-b-0"
          >
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm md:px-6">
              <b dir="ltr">{c.code}</b>
              <span className="truncate text-subtle">· {c.source}</span>
            </summary>
            <div className="grid grid-cols-1 gap-3 px-4 pb-3 md:grid-cols-2 md:px-6">
              <div className="min-w-0">
                <h3 className="mt-0 mb-1.5 text-sm font-semibold">
                  {t("Current catalog value")}
                </h3>
                <pre className="m-0 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">
                  {JSON.stringify(c.current, null, 2)}
                </pre>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-subtle">
                    {t("Original source value")}
                  </summary>
                  <pre className="m-0 mt-1.5 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">
                    {JSON.stringify(c.existing, null, 2)}
                  </pre>
                </details>
              </div>
              <div className="min-w-0">
                <h3 className="mt-0 mb-1.5 text-sm font-semibold">
                  {t("Proposed")}
                </h3>
                <pre className="m-0 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">
                  {JSON.stringify(c.proposed, null, 2)}
                </pre>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:flex sm:justify-end md:px-6">
              {[false, true].map((accept) => (
                <Button
                  variant={accept ? "primary" : "secondary"}
                  key={String(accept)}
                  onClick={async () => {
                    try {
                      await api(`catalog/conflicts/${c.id}`, {
                        accept,
                        expectedVersion: c.currentVersion,
                      });
                      load();
                    } catch (e) {
                      setErr((e as Error).message);
                    }
                  }}
                >
                  {t(accept ? "Accept proposed" : "Keep existing")}
                </Button>
              ))}
            </div>
          </details>
        ))
      )}
      {data && (
        <Pagination
          page={page}
          count={data.count}
          size={50}
          setPage={setPage}
        />
      )}
    </Card>
  );
}
