"use client";
import { dateLocale } from "@/lib/i18n";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  FileText,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Dropdown } from "./dropdown";
import { Form } from "./form";
import { Skeleton } from "./skeleton";
import { PageTitle, Status, useBuzz } from "./shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CellLabel,
  Field,
  Notice,
  buttonStyles,
  cx,
  iconButton,
  inputStyles,
  table,
} from "./ui";
import {
  DuplicateDialog,
  ItemsCard,
  Modal,
  SuccessActions,
  useLines,
} from "./transfer-form";
import { Empty, LoadError, Pagination, useLoad } from "./data-pages";
import { api } from "@/lib/client";
import {
  quantity,
  renamable,
  totalQuantity,
  formatTotal,
  type RequestLine,
} from "@/lib/domain";
import { hasMenu } from "@/lib/permissions";
import { useFormBackup } from "./form-backup";
import type { Line } from "./transfer-form";
type RequestDraftData = {
  requesterId: string;
  supplierId: string;
  remarks: string;
  lines: Line[];
};
type SavedRequestDraft = {
  id: string;
  updatedAt: string;
  data: RequestDraftData;
};
type RequestSummary = {
  id: string;
  number: string;
  requester: string;
  supplier: string;
  status: string;
  createdAt: string;
  creatorName: string;
  lines: number;
  canSupply: boolean;
  transfer: { id: string; number: string } | null;
};
type RequestRecord = Omit<RequestSummary, "lines" | "transfer"> & {
  // The supplier also gets each product's units, to send in another one.
  lines: (RequestLine & { units?: string[] })[];
  remarks: string;
  canCancel: boolean;
  closedAt: string | null;
  updatedAt: string;
  transfer: { id: string; number: string; pdfReady: boolean } | null;
};
const reviewGrid =
  "m-0 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-sm";
const reviewValue = "m-0 text-end font-semibold";
const modalActions = "mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end";
const shortDate = (value: string, locale: string) =>
  new Date(value).toLocaleDateString(dateLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
const showTotal = (value: string) =>
  Number(value).toLocaleString("en", { maximumFractionDigits: 3 });
export function NewRequestLink() {
  const { t } = useBuzz();
  return (
    <Link className={buttonStyles.primary} href="/requests/new">
      <Plus size={17} />
      {t("New request")}
    </Link>
  );
}
export function RequestsPage() {
  const { t, user, locale } = useBuzz();
  // Staff mostly work on what other locations ask of them.
  const [box, setBox] = useState(user.role === "ADMIN" ? "" : "incoming");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({
    box,
    status,
    q: query,
    page: String(page),
  });
  const { data, error, load } = useLoad<{
    items: RequestSummary[];
    count: number;
  }>(`requests?${params}`);
  const tabs = [
    ["incoming", "Requests to us"],
    ["outgoing", "Our requests"],
    ["", "All requests"],
  ] as const;
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Requests"
        subtitle="Ask another location for items. It sets what it can send, and confirming creates the transfer."
        action={<NewRequestLink />}
      />
      <LoadError error={error} load={load} />
      <Card>
        <div
          className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2 md:px-4"
          role="tablist"
        >
          {tabs.map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={box === value}
              className={cx(
                "min-h-11 border-0 border-b-2 bg-transparent px-3 text-sm font-semibold whitespace-nowrap md:min-h-10",
                box === value
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-ink",
              )}
              onClick={() => {
                setBox(value);
                setPage(0);
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <Form
          className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center md:gap-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(q);
          }}
        >
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              size={17}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              className={cx(inputStyles, "ps-10")}
              aria-label={t("Request number")}
              placeholder={t("Request number")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Dropdown
            className="sm:w-44"
            aria-label={t("Status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("All statuses")}</option>
            {["OPEN", "FULFILLED", "DECLINED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {t(s[0] + s.slice(1).toLowerCase())}
              </option>
            ))}
          </Dropdown>
          <Button type="submit" variant="primary">
            <Search size={16} />
            {t("Search")}
          </Button>
        </Form>
        {!data ? (
          <Skeleton />
        ) : !data.items.length ? (
          <Empty title="No requests yet" />
        ) : (
          <>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    {[
                      "Request number",
                      "Date",
                      "Route",
                      "Items",
                      "Status",
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
                  {data.items.map((r) => (
                    <tr
                      key={r.id}
                      className="relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-zinc-50/60 md:table-row md:p-0"
                    >
                      <td className={table.td}>
                        <Link
                          className="inline-flex items-center gap-2 font-semibold text-ink after:absolute after:inset-0 md:after:hidden"
                          href={`/requests/${r.id}`}
                          dir="ltr"
                        >
                          <ClipboardList size={16} className="text-subtle" />
                          {r.number}
                        </Link>
                      </td>
                      <td
                        className={cx(
                          table.td,
                          "col-start-2 row-start-2 text-end text-xs text-subtle md:text-start md:text-sm",
                        )}
                      >
                        {shortDate(r.createdAt, locale)}
                      </td>
                      <td className={cx(table.td, "col-start-1 row-start-2")}>
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted md:text-ink">
                          {r.supplier}
                          <ArrowRight size={13} className="rtl:-scale-x-100" />
                          {r.requester}
                        </span>
                      </td>
                      <td
                        className={cx(
                          table.td,
                          "col-start-1 row-start-3 text-xs text-subtle md:text-sm md:text-ink",
                        )}
                      >
                        <CellLabel>{t("Items")}</CellLabel>
                        {r.lines}
                      </td>
                      <td
                        className={cx(
                          table.td,
                          "col-start-2 row-start-1 text-end md:text-start",
                        )}
                      >
                        <span className="inline-flex flex-wrap justify-end gap-1 md:justify-start">
                          <Status value={r.status} />
                          {r.status === "OPEN" && r.canSupply && (
                            <Badge tone="warn">
                              {t("Awaiting your reply")}
                            </Badge>
                          )}
                          {r.transfer && (
                            <Badge tone="neutral">
                              <span dir="ltr">{r.transfer.number}</span>
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td
                        className={cx(
                          table.td,
                          "col-start-2 row-start-3 text-end text-xs text-subtle md:text-start md:text-sm md:text-ink",
                        )}
                      >
                        {r.creatorName}
                      </td>
                      <td className={cx(table.td, "hidden md:table-cell")}>
                        <Link
                          className={iconButton}
                          aria-label={t("View request")}
                          href={`/requests/${r.id}`}
                        >
                          <ArrowUpRight
                            size={16}
                            className="rtl:-scale-x-100"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
export function RequestForm({ initialLineId }: { initialLineId: string }) {
  const { t, user, locale, toast } = useBuzz();
  const router = useRouter();
  const editor = useLines(initialLineId);
  const { lines, validLines, setLines } = editor;
  // The server draft this form is written in; saving again updates it.
  const [draftKey, setDraftKey] = useState(initialLineId);
  const [drafts, setDrafts] = useState<SavedRequestDraft[]>([]);
  const [deleting, setDeleting] = useState<SavedRequestDraft | null>(null);
  const [locations, setLocations] = useState<
    { id: string; name: string; mine: boolean }[]
  >([]);
  const own = locations.filter((l) => l.mine);
  const [requesterId, setRequester] = useState("");
  const [supplierId, setSupplier] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const loadDrafts = () =>
    api<SavedRequestDraft[]>("request-drafts")
      .then(setDrafts)
      .catch(() => {});
  useEffect(() => {
    api<{ id: string; name: string; active: boolean; mine: boolean }[]>(
      "locations",
    )
      .then((rows) => {
        const active = rows.filter((l) => l.active);
        setLocations(active);
        // A user tied to one location always requests for it.
        const mine = active.filter((l) => l.mine);
        if (mine.length === 1) setRequester(mine[0].id);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
    void loadDrafts();
  }, []);
  const data: RequestDraftData = { requesterId, supplierId, remarks, lines };
  const fill = (d: RequestDraftData) => {
    if (d.requesterId) setRequester(d.requesterId);
    setSupplier(d.supplierId ?? "");
    setRemarks(d.remarks ?? "");
    if (d.lines?.length) setLines(d.lines);
  };
  // Typing is kept on this device until the request is sent.
  const backup = useFormBackup(
    `buzz:request-form:${user.id}`,
    { draftKey, ...data },
    loaded,
    (saved) => {
      const used =
        !!saved.supplierId ||
        !!saved.remarks ||
        !!saved.lines?.some((l) => l.code);
      if (used) {
        setDraftKey(saved.draftKey);
        fill(saved);
      }
      return used;
    },
  );
  const name = (id: string) => locations.find((l) => l.id === id)?.name;
  const draftLabel = (d: SavedRequestDraft) =>
    `${name(d.data.supplierId) ?? "—"} → ${name(d.data.requesterId) ?? "—"} · ${new Date(
      d.updatedAt,
    ).toLocaleString(dateLocale(locale), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Dubai",
    })}`;
  function startOver() {
    backup.clear();
    setDraftKey(crypto.randomUUID());
    setSupplier("");
    setRemarks("");
    setLines([{ id: crypto.randomUUID(), code: "", quantity: "", unit: "" }]);
  }
  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      await api("request-drafts", { id: draftKey, data });
      toast(t("Draft saved"), "ok");
      void loadDrafts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteDraft(d: SavedRequestDraft) {
    setBusy(true);
    try {
      await api(`request-drafts/${d.id}`, undefined, "DELETE");
      setDrafts((all) => all.filter((x) => x.id !== d.id));
      if (d.id === draftKey) startOver();
      toast(t("Draft deleted"), "ok");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }
  async function submit() {
    setError("");
    const message =
      !requesterId ||
      !supplierId ||
      !validLines.length ||
      lines.some(
        (l) =>
          l.code && (!l.product || !quantity.safeParse(l.quantity).success),
      )
        ? "Please complete both locations and at least one valid item."
        : requesterId === supplierId
          ? "Source and destination must differ"
          : remarks.length > 2000
            ? "Remarks must not exceed 2000 characters."
            : "";
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ id: string }>("requests", {
        requesterId,
        supplierId,
        remarks,
        draftId: draftKey,
        lines: validLines.map((l) => ({
          productId: l.product!.id,
          quantity: l.quantity,
          unit: l.unit,
          note: l.note?.trim() || undefined,
          description:
            renamable(l.product!.code) && l.description?.trim()
              ? l.description.trim()
              : undefined,
        })),
      });
      backup.clear();
      router.push(`/requests/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Requests"
        title="New request"
        subtitle="Ask another location for items. It sets what it can send, and confirming creates the transfer."
        action={
          <Link href="/requests" className={buttonStyles.secondary}>
            <ArrowRight size={16} className="ltr:rotate-180" />
            {t("Back")}
          </Link>
        }
      />
      <div className="flex flex-col gap-4 pb-28 md:gap-5 md:pb-0">
        {error && <Notice tone="error">{t(error)}</Notice>}
        {backup.restored && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900"
            role="status"
          >
            <span>{t("Your unsent request was restored on this device.")}</span>
            <Button onClick={startOver}>
              <RotateCcw size={16} />
              {t("Start over")}
            </Button>
          </div>
        )}
        <Card>
          <CardHeader index="01" title={t("Request details")} />
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2 gap-y-4 p-4 md:p-6 lg:gap-x-4">
            <Field label={t("Request from")}>
              <Dropdown
                aria-label={t("Request from")}
                value={supplierId}
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option value="">{t("Select location")}</option>
                {locations
                  .filter((l) => l.id !== requesterId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Dropdown>
            </Field>
            <span className="flex h-11 items-center self-end text-subtle md:h-10">
              <ArrowRight size={18} className="rtl:-scale-x-100" />
            </span>
            <Field label={t("Deliver to")}>
              {own.length === 1 ? (
                <input
                  className={inputStyles}
                  aria-label={t("Deliver to")}
                  value={own[0].name}
                  readOnly
                />
              ) : (
                <Dropdown
                  aria-label={t("Deliver to")}
                  value={requesterId}
                  onChange={(e) => setRequester(e.target.value)}
                >
                  <option value="">{t("Select location")}</option>
                  {own.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Dropdown>
              )}
            </Field>
            <Field label={t("Remarks")} className="col-span-3">
              <textarea
                className={cx(inputStyles, "min-h-20 py-2")}
                value={remarks}
                maxLength={2000}
                rows={2}
                dir="auto"
                placeholder={t("Optional notes for this request")}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Field>
          </div>
        </Card>
        <ItemsCard editor={editor} index="02" title="Requested items" />
        {drafts.length > 0 && (
          <details className="rounded-xl border border-line bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">
              {t("Saved drafts")} ({drafts.length})
            </summary>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {drafts.map((d) => (
                <span
                  key={d.id}
                  data-draft={d.id}
                  className="flex items-center gap-2"
                >
                  <Button
                    className="flex-1 justify-start"
                    onClick={() => {
                      setDraftKey(d.id);
                      fill(d.data);
                    }}
                  >
                    {t("Open draft")} · {draftLabel(d)}
                  </Button>
                  <button
                    type="button"
                    className={cx(
                      iconButton,
                      "hover:bg-red-50 hover:text-red-700",
                    )}
                    aria-label={`${t("Delete draft")} · ${draftLabel(d)}`}
                    disabled={busy}
                    onClick={() => setDeleting(d)}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-5 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
        <Button disabled={busy} onClick={saveDraft}>
          <Save size={16} />
          {t("Save draft")}
        </Button>
        <Button variant="primary" disabled={busy} onClick={submit}>
          <Send size={16} className="rtl:-scale-x-100" />
          {t(busy ? "Please wait…" : "Send request")}
        </Button>
      </div>
      {deleting && (
        <Modal title="Delete draft" onClose={() => !busy && setDeleting(null)}>
          <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
            {t("This saved draft and all of its items will be removed.")}
          </p>
          <dl className={reviewGrid}>
            <dt className="text-subtle">{t("Draft")}</dt>
            <dd className={reviewValue}>{draftLabel(deleting)}</dd>
          </dl>
          <div className={modalActions}>
            <Button
              data-initial-focus
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="dangerSolid"
              disabled={busy}
              onClick={() => deleteDraft(deleting)}
            >
              <Trash2 size={16} />
              {t("Delete draft")}
            </Button>
          </div>
        </Modal>
      )}
      <DuplicateDialog editor={editor} />
    </>
  );
}
// What the supplier has decided for a line, before it is saved.
type Decision = { supplied: string; removed: boolean; unit: string };
// An item the supplier adds that was not asked for.
type Extra = {
  key: string;
  code: string;
  product?: { id: string; code: string; description: string; units: string[] };
  supplied: string;
  unit: string;
  error?: string;
};
export function RequestDetail({ id }: { id: string }) {
  const { t, user, locale, toast } = useBuzz();
  const { data, error, load } = useLoad<RequestRecord>(`requests/${id}`);
  // Unsaved edits per line index, on top of what the server holds. A reload
  // clears them so the page shows the saved state again.
  const [edits, setEdits] = useState<Record<number, Decision>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loadedAt, setLoadedAt] = useState("");
  if (data && data.updatedAt !== loadedAt) {
    setLoadedAt(data.updatedAt);
    setEdits({});
    setExtras(
      data.lines
        .filter((l) => l.added)
        .map((l, k) => ({
          key: `saved-${k}`,
          code: l.code,
          product: {
            id: l.productId,
            code: l.code,
            description: l.description,
            units: l.units ?? (l.unit ? [l.unit] : []),
          },
          supplied: l.supplied ?? "",
          unit: l.unit,
        })),
    );
  }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<
    "fulfill" | "decline" | "cancel" | "delete" | null
  >(null);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [created, setCreated] = useState<{
    id: string;
    number: string;
    pdfReady: boolean;
  } | null>(null);
  const editing = data?.status === "OPEN" && data.canSupply;
  // While replying, the table holds the asked lines and added items are
  // edited apart; afterwards it lists every line that was sent.
  const rows =
    (editing ? data?.lines.filter((l) => !l.added) : data?.lines) ?? [];
  const decisions: Decision[] = rows.map(
    (l, i) =>
      edits[i] ?? {
        supplied: l.supplied ?? l.quantity,
        removed: !!l.removed,
        unit: l.supplyUnit ?? l.unit,
      },
  );
  const set = (i: number, patch: Partial<Decision>) =>
    setEdits((all) => ({ ...all, [i]: { ...decisions[i], ...patch } }));
  const setExtra = (key: string, patch: Partial<Extra>) =>
    setExtras((all) =>
      all.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    );
  async function lookupExtra(e: Extra) {
    const code = e.code.trim();
    if (!code || e.product?.code === code) return;
    try {
      const result = await api<{ items: Extra["product"][] }>(
        `products?exact=1&q=${encodeURIComponent(code)}`,
      );
      const product = result.items.length === 1 ? result.items[0] : undefined;
      setExtra(e.key, {
        product,
        unit: product?.units[0] ?? "",
        error: product
          ? undefined
          : result.items.length
            ? "Multiple products match. Ask an administrator to review."
            : "Product not found. Check the exact code.",
      });
    } catch (err) {
      setExtra(e.key, { error: (err as Error).message });
    }
  }
  const invalid = decisions.findIndex(
    (d) => !d.removed && !quantity.safeParse(d.supplied).success,
  );
  const badExtra = extras.find(
    (e) =>
      (e.code.trim() && !e.product) ||
      (e.product && !quantity.safeParse(e.supplied).success),
  );
  const addedItems = extras.filter((e) => e.product);
  const sending = [
    ...decisions.filter((d) => !d.removed),
    ...addedItems.map((e) => ({ supplied: e.supplied, removed: false })),
  ];
  const payload = () => ({
    lines: decisions.map((d) =>
      d.removed ? { removed: true } : { supplied: d.supplied, unit: d.unit },
    ),
    added: addedItems.map((e) => ({
      productId: e.product!.id,
      supplied: e.supplied,
      unit: e.unit,
    })),
  });
  const checked = () => {
    if (invalid >= 0) {
      toast(t("Enter a positive quantity with up to 3 decimal places."));
      document.getElementById(`supply-${invalid}`)?.focus();
      return false;
    }
    if (badExtra) {
      toast(
        t(
          badExtra.product
            ? "Enter a positive quantity with up to 3 decimal places."
            : "Look up each added item by its exact code, or remove it.",
        ),
      );
      document
        .getElementById(
          `${badExtra.product ? "extra-qty" : "extra-code"}-${badExtra.key}`,
        )
        ?.focus();
      return false;
    }
    return true;
  };
  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      await action();
      if (done) setNotice(done);
      setDialog(null);
      load();
    } catch (e) {
      setErr((e as Error).message);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }
  const asked = data?.lines.filter((l) => !l.added) ?? [];
  const requested = formatTotal(totalQuantity(asked));
  const sent = formatTotal(
    totalQuantity(
      sending
        .filter((d) => quantity.safeParse(d.supplied).success)
        .map((d) => ({ quantity: d.supplied })),
    ),
  );
  const transfer = created ?? data?.transfer;
  return (
    <>
      <PageTitle
        title="Request details"
        action={
          <div className="flex gap-2">
            {/* The order form to print as a picking list. */}
            <a
              href={`/print/requests/${id}`}
              target="_blank"
              rel="noopener"
              className={buttonStyles.secondary}
            >
              <Printer size={16} />
              {t("Print")}
            </a>
            <Link href="/requests" className={buttonStyles.secondary}>
              <ArrowRight size={16} className="ltr:rotate-180" />
              {t("Back")}
            </Link>
          </div>
        }
      />
      <LoadError error={error} load={load} />
      {!data && !error && <Skeleton />}
      {data && (
        <div className="flex flex-col gap-4 pb-28 md:pb-0">
          {err && <Notice tone="error">{t(err)}</Notice>}
          {notice && <Notice>{t(notice)}</Notice>}
          <Card className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-semibold" dir="ltr">
                {data.number}
              </h2>
              <span className="flex flex-wrap gap-1.5">
                <Status value={data.status} />
                {editing && (
                  <Badge tone="warn">{t("Awaiting your reply")}</Badge>
                )}
              </span>
            </div>
            <dl className="mt-4 mb-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-subtle">{t("Request from")}</dt>
                <dd className="m-0 mt-1 flex items-center gap-1.5 font-medium">
                  <MapPin size={15} className="text-brand" />
                  {data.supplier}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{t("Deliver to")}</dt>
                <dd className="m-0 mt-1 flex items-center gap-1.5 font-medium">
                  <MapPin size={15} className="text-brand" />
                  {data.requester}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{t("Created by")}</dt>
                <dd className="m-0 mt-1 font-medium">{data.creatorName}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">{t("Date")}</dt>
                <dd className="m-0 mt-1 font-medium">
                  {shortDate(data.createdAt, locale)}
                </dd>
              </div>
            </dl>
            {data.remarks && (
              <p
                className="mt-4 mb-0 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-muted"
                dir="auto"
              >
                {data.remarks}
              </p>
            )}
            {data.transfer && (
              <p className="mt-4 mb-0 flex flex-wrap items-center gap-2 text-sm text-muted">
                <FileText size={16} className="text-brand" />
                {t("Transfer created")}:
                {hasMenu(user, "transfers") ? (
                  <Link
                    className="font-semibold text-brand hover:underline"
                    href={`/transfers/${data.transfer.id}`}
                    dir="ltr"
                  >
                    {data.transfer.number}
                  </Link>
                ) : (
                  <strong className="text-ink" dir="ltr">
                    {data.transfer.number}
                  </strong>
                )}
              </p>
            )}
            {user.role === "ADMIN" && (
              <div className="mt-4 flex border-t border-line pt-4 sm:justify-end">
                <Button
                  variant="danger"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setDialog("delete");
                  }}
                >
                  <Trash2 size={16} />
                  {t("Delete request")}
                </Button>
              </div>
            )}
          </Card>
          {editing && (
            <Notice>
              {t(
                "Set the quantity you can send for each item. Remove the items you do not have, then confirm to create the transfer.",
              )}
            </Notice>
          )}
          <Card>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={cx(table.th, "w-12")}>#</th>
                    <th className={table.th}>{t("Code / Barcode")}</th>
                    <th className={table.th}>{t("Product description")}</th>
                    <th className={table.th}>{t("Requested")}</th>
                    <th className={cx(table.th, editing && "w-36")}>
                      {t("Sent")}
                    </th>
                    {editing && (
                      <th
                        className={cx(table.th, "w-16")}
                        aria-label={t("Actions")}
                      />
                    )}
                  </tr>
                </thead>
                <tbody className={table.body}>
                  {rows.map((l, i) => {
                    const d = decisions[i];
                    const bad =
                      editing &&
                      !d.removed &&
                      !quantity.safeParse(d.supplied).success;
                    return (
                      <tr
                        key={i}
                        className={cx(
                          "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-line px-4 py-3.5 last:border-b-0 md:table-row md:p-0",
                          d.removed && "bg-zinc-50 text-subtle",
                        )}
                      >
                        <td
                          className={cx(
                            table.td,
                            "hidden text-xs text-subtle tabular-nums md:table-cell",
                          )}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td
                          className={cx(table.td, "col-start-1 row-start-1")}
                          dir="ltr"
                        >
                          <span
                            className={cx(
                              "font-semibold",
                              d.removed && "line-through",
                            )}
                          >
                            {l.code}
                          </span>
                        </td>
                        <td
                          className={cx(table.td, "col-span-2 text-sm")}
                          dir="auto"
                        >
                          <span className={cx(d.removed && "line-through")}>
                            {l.description}
                          </span>
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
                            "col-start-2 row-start-1 text-end tabular-nums md:text-start",
                          )}
                        >
                          <CellLabel>{t("Requested")}</CellLabel>
                          {l.added ? (
                            <Badge tone="neutral">{t("Supplier added")}</Badge>
                          ) : (
                            <>
                              <span dir="ltr">{l.quantity}</span>
                              <span className="ms-1 text-subtle">{l.unit}</span>
                            </>
                          )}
                        </td>
                        <td className={cx(table.td, "col-start-1")}>
                          {editing && !d.removed ? (
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-subtle md:hidden">
                                {t("Sent")}
                              </span>
                              <input
                                id={`supply-${i}`}
                                className={cx(
                                  inputStyles,
                                  "max-w-32 text-center font-semibold tabular-nums",
                                  bad && "border-red-300",
                                )}
                                aria-label={`${t("Sent")} ${i + 1}`}
                                aria-invalid={bad}
                                dir="ltr"
                                inputMode="decimal"
                                value={d.supplied}
                                onChange={(e) =>
                                  set(i, { supplied: e.target.value })
                                }
                              />
                              {l.units && l.units.length > 0 ? (
                                <Dropdown
                                  className="w-32"
                                  aria-label={`${t("Unit")} ${i + 1}`}
                                  value={d.unit}
                                  onChange={(e) =>
                                    set(i, { unit: e.target.value })
                                  }
                                >
                                  {[...new Set([l.unit, ...l.units])]
                                    .filter(Boolean)
                                    .map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                </Dropdown>
                              ) : (
                                <span className="text-xs text-subtle">
                                  {l.unit}
                                </span>
                              )}
                            </label>
                          ) : d.removed ? (
                            <Badge tone="bad">{t("Not available")}</Badge>
                          ) : data.status === "FULFILLED" ? (
                            <span className="font-semibold tabular-nums">
                              <CellLabel>{t("Sent")}</CellLabel>
                              <span dir="ltr">{l.supplied ?? l.quantity}</span>
                              <span className="ms-1 font-normal text-subtle">
                                {l.supplyUnit ?? l.unit}
                              </span>
                            </span>
                          ) : (
                            <span className="text-subtle max-md:hidden">—</span>
                          )}
                        </td>
                        {editing && (
                          <td
                            className={cx(
                              table.td,
                              "col-start-2 flex justify-end md:table-cell",
                            )}
                          >
                            <button
                              type="button"
                              className={cx(
                                iconButton,
                                !d.removed &&
                                  "hover:bg-red-50 hover:text-red-700",
                              )}
                              aria-label={`${t(d.removed ? "Restore item" : "Not available")} ${i + 1}`}
                              title={t(
                                d.removed ? "Restore item" : "Not available",
                              )}
                              onClick={() => set(i, { removed: !d.removed })}
                            >
                              {d.removed ? (
                                <RotateCcw size={17} />
                              ) : (
                                <Trash2 size={17} />
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-zinc-50/60 px-4 py-3 text-sm text-subtle md:px-5">
              <span>
                {asked.length} {t("items")} · {t("Requested")}{" "}
                <strong className="text-ink tabular-nums" dir="ltr">
                  {showTotal(requested)}
                </strong>
              </span>
              {(editing || data.status === "FULFILLED") && (
                <span>
                  {sending.length} {t("items")} · {t("Sent")}{" "}
                  <strong className="text-lg text-ink tabular-nums" dir="ltr">
                    {showTotal(sent)}
                  </strong>
                </span>
              )}
            </div>
          </Card>
          {editing && (
            <Card>
              <CardHeader title={t("Items you add")} />
              <div className="flex flex-col gap-3 p-4 md:p-5">
                <p className="m-0 text-sm text-muted">
                  {t(
                    "Add items that were not asked for, if you are sending them too.",
                  )}
                </p>
                {extras.map((e, k) => (
                  <div
                    key={e.key}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-line p-3 md:grid-cols-[10rem_1fr_8rem_9rem_auto]"
                  >
                    <input
                      id={`extra-code-${e.key}`}
                      className={cx(inputStyles, "font-semibold")}
                      aria-label={`${t("Added item code")} ${k + 1}`}
                      placeholder={t("Scan or enter code")}
                      dir="ltr"
                      autoComplete="off"
                      value={e.code}
                      onChange={(ev) =>
                        setExtra(e.key, {
                          code: ev.target.value.toUpperCase(),
                          product: undefined,
                          error: undefined,
                        })
                      }
                      onBlur={() => void lookupExtra(e)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          void lookupExtra(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={cx(
                        iconButton,
                        "hover:bg-red-50 hover:text-red-700 md:order-last",
                      )}
                      aria-label={`${t("Remove added item")} ${k + 1}`}
                      onClick={() =>
                        setExtras((all) => all.filter((x) => x.key !== e.key))
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                    <span
                      className={cx(
                        "col-span-2 text-sm md:col-span-1",
                        e.error ? "text-red-700" : "text-muted",
                      )}
                      dir="auto"
                    >
                      {e.error ? t(e.error) : (e.product?.description ?? "—")}
                    </span>
                    <input
                      id={`extra-qty-${e.key}`}
                      className={cx(
                        inputStyles,
                        "text-center font-semibold tabular-nums",
                      )}
                      aria-label={`${t("Added item quantity")} ${k + 1}`}
                      dir="ltr"
                      inputMode="decimal"
                      disabled={!e.product}
                      value={e.supplied}
                      onChange={(ev) =>
                        setExtra(e.key, { supplied: ev.target.value })
                      }
                    />
                    {e.product && e.product.units.length > 0 ? (
                      <Dropdown
                        aria-label={`${t("Added item unit")} ${k + 1}`}
                        value={e.unit}
                        onChange={(ev) =>
                          setExtra(e.key, { unit: ev.target.value })
                        }
                      >
                        {e.product.units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Dropdown>
                    ) : (
                      <span className="text-xs text-subtle">{e.unit}</span>
                    )}
                  </div>
                ))}
                <Button
                  className="self-start"
                  disabled={busy}
                  onClick={() =>
                    setExtras((all) => [
                      ...all,
                      {
                        key: crypto.randomUUID(),
                        code: "",
                        supplied: "",
                        unit: "",
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  {t("Add item")}
                </Button>
              </div>
            </Card>
          )}
          {transfer && <SuccessActions transfer={transfer} />}
          {data.status === "OPEN" && (data.canSupply || data.canCancel) && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
              <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                {/* One way to close a request: the asked location declines
                    it, the person who asked cancels it. */}
                {data.canCancel && !data.canSupply && (
                  <Button
                    variant="danger"
                    className="col-span-2"
                    disabled={busy}
                    onClick={() => {
                      setReason("");
                      setDialog("cancel");
                    }}
                  >
                    <X size={16} />
                    {t("Cancel request")}
                  </Button>
                )}
                {data.canSupply && (
                  <>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        setReason("");
                        setDialog("decline");
                      }}
                    >
                      <X size={16} />
                      {t("Decline request")}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        checked() &&
                        run(
                          () => api(`requests/${id}`, payload(), "PATCH"),
                          "Changes saved",
                        )
                      }
                    >
                      <Save size={16} />
                      {t("Save progress")}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={busy}
                      onClick={() => {
                        if (!checked()) return;
                        if (!sending.length) {
                          toast(
                            t(
                              "Keep at least one item, or decline the request.",
                            ),
                          );
                          return;
                        }
                        setReason("");
                        setDialog("fulfill");
                      }}
                    >
                      <Send size={16} className="rtl:-scale-x-100" />
                      {t("Confirm and create transfer")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {data && dialog === "fulfill" && (
        <Modal
          title="Confirm and create transfer"
          onClose={() => !busy && setDialog(null)}
        >
          <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
            {t(
              "A confirmed transfer is created with the quantities below and the request is closed.",
            )}
          </p>
          <dl className={reviewGrid}>
            <dt className="text-subtle">{t("From location")}</dt>
            <dd className={reviewValue}>{data.supplier}</dd>
            <dt className="text-subtle">{t("To location")}</dt>
            <dd className={reviewValue}>{data.requester}</dd>
            <dt className="text-subtle">{t("Total item lines")}</dt>
            <dd className={reviewValue}>{sending.length}</dd>
            <dt className="text-subtle">{t("Not available")}</dt>
            <dd className={reviewValue}>
              {decisions.filter((d) => d.removed).length}
            </dd>
            <dt className="text-subtle">{t("Total quantity")}</dt>
            <dd className={reviewValue} dir="ltr">
              {showTotal(sent)}
            </dd>
          </dl>
          <Field label={t("Remarks")} className="mt-4">
            <textarea
              className={cx(inputStyles, "min-h-20 py-2")}
              value={reason}
              maxLength={2000}
              rows={2}
              dir="auto"
              placeholder={t("Optional notes for this transfer")}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className={modalActions}>
            <Button disabled={busy} onClick={() => setDialog(null)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setCreated(
                    await api(`requests/${id}/fulfill`, {
                      ...payload(),
                      remarks: reason,
                    }),
                  );
                })
              }
            >
              {t(busy ? "Please wait…" : "Confirm and generate PDF")}
            </Button>
          </div>
        </Modal>
      )}
      {data && dialog === "delete" && (
        <Modal title="Delete request" onClose={() => !busy && setDialog(null)}>
          <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
            {t(
              "The request is permanently deleted. A full copy is kept in the audit log.",
            )}
            {data.transfer &&
              " " +
                t(
                  "The transfer created from it is not deleted; delete it separately if needed.",
                )}
          </p>
          <dl className={cx(reviewGrid, "mb-4")}>
            <dt className="text-subtle">{t("Request number")}</dt>
            <dd className={reviewValue} dir="ltr">
              {data.number}
            </dd>
            <dt className="text-subtle">{t("Route")}</dt>
            <dd className={reviewValue}>
              {data.supplier} → {data.requester}
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
          <div className={modalActions}>
            <Button
              data-initial-focus
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="dangerSolid"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`requests/${id}`, { reason }, "DELETE");
                  router.push("/requests");
                  router.refresh();
                } catch (e) {
                  setErr((e as Error).message);
                  setDialog(null);
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={16} />
              {t(busy ? "Please wait…" : "Delete request")}
            </Button>
          </div>
        </Modal>
      )}
      {data && (dialog === "decline" || dialog === "cancel") && (
        <Modal
          title={dialog === "decline" ? "Decline request" : "Cancel request"}
          onClose={() => !busy && setDialog(null)}
        >
          <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
            {t(
              dialog === "decline"
                ? "The request is closed without a transfer. The requester sees that it was declined."
                : "The request is withdrawn and can no longer be filled.",
            )}
          </p>
          <Field label={t("Reason (optional)")}>
            <textarea
              className={cx(inputStyles, "min-h-20 py-2")}
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className={modalActions}>
            <Button
              data-initial-focus
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              {t("Back")}
            </Button>
            <Button
              variant="dangerSolid"
              disabled={busy}
              onClick={() =>
                run(() => api(`requests/${id}/${dialog}`, { reason }))
              }
            >
              {t(
                busy
                  ? "Please wait…"
                  : dialog === "decline"
                    ? "Decline request"
                    : "Cancel request",
              )}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
