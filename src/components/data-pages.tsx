"use client";
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
} from "lucide-react";
import { api } from "@/lib/client";
import { PageTitle, NewTransferLink, Status, useBuzz } from "./shell";
import { SuccessActions, Modal, type Product } from "./transfer-form";
import type { SnapshotLine, CatalogRow } from "@/lib/domain";
import {
  validateCatalog,
  unitsFromDescription,
  outerUnits,
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
    <div className="error" role="alert">
      {t(error)} <button onClick={load}>{t("Retry")}</button>
    </div>
  ) : null;
}
export function TransferTable({ items }: { items: Summary[] }) {
  const { t, locale } = useBuzz();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Transfer number",
              "Date",
              "Route",
              "Total quantity",
              "Approval",
              "Created by",
              "Actions",
            ].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    className="reference-link"
                    href={`/transfers/${row.id}`}
                  >
                    <FileText size={15} />
                    {row.number}
                  </Link>
                </td>
                <td className="muted">
                  {new Date(row.date).toLocaleDateString(
                    locale === "fa" ? "fa-IR" : "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Dubai",
                    },
                  )}
                </td>
                <td>
                  <span className="table-route">
                    {row.source}
                    <ArrowRight size={13} />
                    {row.destination}
                  </span>
                </td>
                <td dir="ltr">{Number(row.total).toLocaleString()}</td>
                <td>
                  <Status value={row.approval} />
                </td>
                <td>{row.creator.name}</td>
                <td>
                  <Link
                    className="icon-button"
                    aria-label={t("View transfer")}
                    href={`/transfers/${row.id}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>
                <Empty title="No transfers yet" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Empty({ title }: { title: string }) {
  const { t } = useBuzz();
  return (
    <div className="empty-state">
      <span>
        <Package size={24} />
      </span>
      <p>{t(title)}</p>
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
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">BUZZ / {t("Internal transfers")}</span>
          <h2>{t("Move stock. Keep clarity.")}</h2>
          <p>{t("Prepare, confirm and share inventory transfer documents.")}</p>
          <Link href="/new-transfer" className="text-button">
            {t("Create transfer")}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="intro-art" aria-hidden="true">
          <span>
            <Package size={33} />
          </span>
          <div className="dashed-route">
            <i />
            <i />
            <i />
            <i />
          </div>
          <ArrowLeftRight size={26} />
          <div className="dashed-route">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span>
            <MapPin size={33} />
          </span>
        </div>
      </div>
      <div className="stats">
        {(
          [
            ["All transfers", data?.total, ArrowLeftRight],
            ["Awaiting review", data?.pending, Clock3],
            ["Approved transfers", data?.approved, CheckCircle2],
            ["Catalog products", data?.products, Package],
          ] as const
        ).map(([label, value, Icon]) => (
          <div className="stat card" key={label}>
            <div>
              <span>{t(label)}</span>
              <Icon size={19} />
            </div>
            <strong>{value?.toLocaleString() ?? "—"}</strong>
            <small>
              {label === "Catalog products"
                ? "ITEMS.xls"
                : t("Internal transfers")}
            </small>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>{t("Recent transfers")}</h2>
          </div>
          <Link href="/transfers" className="text-button">
            {t("View all")}
            <ArrowRight size={15} />
          </Link>
        </div>
        {data ? <TransferTable items={data.recent} /> : <Skeleton />}
      </section>
      <div className="dashboard-bottom">
        <span className="muted">
          {user.name} · {t(user.role === "ADMIN" ? "Administrator" : "Staff")}
        </span>
        <span className="muted">
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
    ...(user.role === "ADMIN" ? { creator } : {}),
  });
  const { data, error, load } = useLoad<{ items: Summary[]; count: number }>(
    `transfers?${params}`,
  );
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Transfer history"
        action={<NewTransferLink />}
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      <section className="card">
        <Form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(q);
          }}
        >
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label={t("Transfer number")}
              placeholder={t("Transfer number")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Dropdown
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
          <DatePicker
            label={t("Start date")}
            value={from}
            onChange={setFrom}
            clearable
          />
          <DatePicker
            label={t("End date")}
            value={to}
            onChange={setTo}
            clearable
          />
          <button className="button">
            <SlidersHorizontal size={15} />
            {t("Filter")}
          </button>
          <Dropdown
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
      </section>
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
    <div className="pagination">
      <span>
        {count
          ? `${page * size + 1}–${Math.min((page + 1) * size, count)}`
          : "0"}{" "}
        / {count.toLocaleString()}
      </span>
      <div>
        <button
          className="button"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          {t("Previous")}
        </button>
        <button
          className="button"
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
    Summary & { lines: SnapshotLine[]; remarks: string; pdfReady: boolean }
  >(`transfers/${id}`);
  const [err, setErr] = useState("");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
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
          <Link href="/transfers" className="button">
            {t("Back")}
          </Link>
        }
      />
      <LoadError error={error || err} load={load} />
      {data && (
        <>
          <div className="detail-header card">
            <h2 dir="ltr">{data.number}</h2>
            <span>{data.source}</span>
            <ArrowRight size={16} />
            <span>{data.destination}</span>
            <Status value={data.approval} />
            {user.role === "ADMIN" && (
              <div className="detail-approval">
                {(data.approval === "PENDING"
                  ? ["APPROVED", "REJECTED"]
                  : data.approval === "APPROVED"
                    ? ["RECEIVED"]
                    : []
                ).map((s) => (
                  <button
                    key={s}
                    className="button"
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
                  </button>
                ))}
                <button
                  className="button danger"
                  onClick={() => {
                    setReason("");
                    setDeleting(true);
                  }}
                >
                  <Trash2 size={16} />
                  {t("Delete transfer")}
                </button>
              </div>
            )}
          </div>
          {deleting && (
            <Modal
              title="Delete transfer"
              onClose={() => !busy && setDeleting(false)}
            >
              <p className="muted">
                {t(
                  "The confirmed transfer and its saved PDF will be permanently deleted. A full copy is kept in the audit log.",
                )}
              </p>
              <dl className="review-grid">
                <dt>{t("Transfer number")}</dt>
                <dd dir="ltr">{data.number}</dd>
                <dt>{t("Route")}</dt>
                <dd>
                  {data.source} → {data.destination}
                </dd>
              </dl>
              <label>
                {t("Reason (optional)")}
                <textarea
                  value={reason}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button
                  className="button"
                  data-initial-focus
                  disabled={busy}
                  onClick={() => setDeleting(false)}
                >
                  {t("Cancel")}
                </button>
                <button
                  className="button danger-solid"
                  disabled={busy}
                  onClick={remove}
                >
                  <Trash2 size={16} />
                  {t(busy ? "Please wait…" : "Delete transfer")}
                </button>
              </div>
            </Modal>
          )}
          <section className="card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      "Code / Barcode",
                      "Product description",
                      "Quantity",
                      "Unit",
                    ].map((h) => (
                      <th key={h}>{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => (
                    <tr key={i}>
                      <td dir="ltr">
                        {l.code}
                        <small>{l.barcodes.join(" · ")}</small>
                      </td>
                      <td dir="auto">
                        {l.description}
                        {l.note && <small dir="auto">{l.note}</small>}
                      </td>
                      <td>{l.quantity}</td>
                      <td>{l.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="items-total">
              {data.lines.length} {t("items")}
              <strong>
                {t("Total quantity")}: {Number(data.total)}
              </strong>
            </div>
            {data.remarks && (
              <p className="detail-remarks" dir="auto">
                {data.remarks}
              </p>
            )}
          </section>
          <SuccessActions transfer={data} />
        </>
      )}
    </>
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
              <button className="button" onClick={() => setCreating(true)}>
                <Plus size={17} />
                {t("New product")}
              </button>
              <button
                className="button primary"
                onClick={() => setImporting(true)}
              >
                <Upload size={17} />
                {t("Import catalog")}
              </button>
            </>
          )
        }
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      <section className="card">
        <Form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q);
            setPage(0);
          }}
        >
          <div className="search-field wide">
            <Search size={17} />
            <input
              placeholder={t("Search code, barcode or description")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="button">{t("Search")}</button>
          <span className="muted">
            {data?.count.toLocaleString() ?? "—"} {t("Products")}
          </span>
        </Form>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Code / Barcode",
                  "Product description",
                  "Units",
                  "Barcodes",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p) => (
                <tr key={p.id}>
                  <td className="mono" dir="ltr">
                    {p.code}
                  </td>
                  <td dir="auto">{p.description}</td>
                  <td>{p.units.join(" · ") || "—"}</td>
                  <td dir="ltr">
                    {p.barcodes.map((b) => b.value).join(" · ") || "—"}
                  </td>
                  <td>
                    {user.role === "ADMIN" && (
                      <button
                        className="text-button"
                        onClick={() => setEditing(p)}
                      >
                        {t("Edit")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data && !data.items.length && (
                <tr>
                  <td colSpan={5}>
                    <Empty title="No products found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <Pagination
            page={page}
            count={data.count}
            size={50}
            setPage={setPage}
          />
        )}
      </section>
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
  const [units, setUnits] = useState(product?.units.join("|") ?? "");
  // A new product follows its name until the admin types units themselves.
  const [unitsTouched, setUnitsTouched] = useState(Boolean(product));
  const [err, setErr] = useState("");
  const detect = (name: string, outerUnit: string) =>
    setUnits(unitsFromDescription(name, outerUnit).join("|"));
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
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body = {
            description,
            units: split(units),
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
        {err && (
          <p className="error" role="alert">
            {t(err)}
          </p>
        )}
        {product ? (
          <p dir="ltr">{product.code}</p>
        ) : (
          <label>
            {t("Product code")}
            <input name="code" required dir="ltr" autoComplete="off" />
          </label>
        )}
        <label>
          {t("Product description")}
          <textarea
            name="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (!unitsTouched) detect(e.target.value, outer);
            }}
            required
          />
        </label>
        <label>
          {t("Outer unit for (1xN)")}
          <select
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
        </label>
        <label>
          {t("Units")}
          <input
            name="units"
            value={units}
            onChange={(e) => {
              setUnits(e.target.value);
              setUnitsTouched(true);
            }}
            dir="ltr"
          />
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() => detect(description, outer)}
        >
          {t("Detect units from description")}
        </button>
        <p className="muted">
          {t(
            "(1xN) gives the outer unit and PCS; (1xNxM) gives CTN, BOX and PCS. No pack size, no units.",
          )}
        </p>
        <label>
          {t("Barcodes")}
          <input
            name="barcodes"
            defaultValue={product?.barcodes.map((b) => b.value).join("|")}
            dir="ltr"
          />
        </label>
        <p className="muted">{t("Separate multiple values with |")}</p>
        <button className="button primary">
          {t(product ? "Save changes" : "Add product")}
        </button>
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
  const table = sheets[sheet] ?? [];
  return (
    <Modal title="Catalog import" onClose={onClose}>
      <p className="muted">
        {t(
          "Product codes and barcodes are matched exactly. Units are never inferred.",
        )}
      </p>
      <label>
        {t("Source")}
        <Dropdown value={source} onChange={(e) => setSource(e.target.value)}>
          <option>ITEMS.xls</option>
          <option>mehdiali.om export</option>
        </Dropdown>
      </label>
      <label>
        {t("Choose workbook")}
        <input
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
      </label>
      {Object.keys(sheets).length > 0 && (
        <>
          <label>
            {t("Worksheet")}
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
          </label>
          <div className="mapping-grid">
            {(["code", "description", "barcodes", "units"] as const).map(
              (field, i) => (
                <label key={field}>
                  {t(
                    [
                      "Item code column",
                      "Description column",
                      "Barcode column",
                      "Unit column",
                    ][i],
                  )}
                  <Dropdown
                    value={map[field]}
                    onChange={(e) => {
                      setMap((m) => ({ ...m, [field]: e.target.value }));
                      setRows(null);
                    }}
                  >
                    <option value="">{t("Not supplied")}</option>
                    {table[0]?.map((value, index) => (
                      <option value={index} key={index}>
                        {value || index + 1}
                      </option>
                    ))}
                  </Dropdown>
                </label>
              ),
            )}
          </div>
          <button
            className="button"
            onClick={() => {
              const proposed = table
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
          </button>
        </>
      )}
      {rows && (
        <>
          <p>
            {rows.length.toLocaleString()} {t("Rows")}
          </p>
          <div className="import-preview">
            {rows.slice(0, 5).map((r, i) => (
              <div key={i}>
                <b>{r.code}</b> · <span dir="auto">{r.description}</span> ·{" "}
                {r.units.join("|") || "—"}
              </div>
            ))}
          </div>
          <button
            className="button primary"
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
          </button>
        </>
      )}
      {!!errors.length && (
        <div className="error">{errors.slice(0, 10).join("\n")}</div>
      )}
      {message && <p className="notice">{message}</p>}
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
    <section className="card conflicts-card">
      <div className="card-heading">
        <h2>
          {t("Review conflicts")}{" "}
          <span className="count">{data?.count ?? 0}</span>
        </h2>
        <p className="muted small">
          {t("Review source conflicts before applying updates.")}
        </p>
      </div>
      <LoadError error={error || err} load={load} />
      {!data?.items.length ? (
        <p className="muted detail-remarks">{t("No pending conflicts")}</p>
      ) : (
        data.items.map((c) => (
          <details key={c.id} className="conflict">
            <summary>
              <b>{c.code}</b> · {c.source}
            </summary>
            <div className="conflict-values">
              <div>
                <h3>{t("Current catalog value")}</h3>
                <pre>{JSON.stringify(c.current, null, 2)}</pre>
                <details>
                  <summary>{t("Original source value")}</summary>
                  <pre>{JSON.stringify(c.existing, null, 2)}</pre>
                </details>
              </div>
              <div>
                <h3>{t("Proposed")}</h3>
                <pre>{JSON.stringify(c.proposed, null, 2)}</pre>
              </div>
            </div>
            <div className="modal-actions">
              {[false, true].map((accept) => (
                <button
                  className="button"
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
                </button>
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
    </section>
  );
}
