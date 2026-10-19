"use client";
import { useForm, type ResolverResult } from "react-hook-form";
import { Dropdown } from "./dropdown";
import Link from "next/link";
import { DatePicker } from "./date-picker";
import { Modal } from "./modal";
export { Modal } from "./modal";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  memo,
  Fragment,
} from "react";
import {
  ArrowRight,
  ScanLine,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Download,
  Share2,
  FileCheck2,
  Keyboard,
  Save,
  FileText,
  MessageSquarePlus,
} from "lucide-react";
import { useBuzz, PageTitle, Status } from "./shell";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Notice,
  buttonStyles,
  cx,
  iconButton,
  iconButtonActive,
  inputStyles,
  linkButton,
  table,
} from "./ui";
const kbd =
  "rounded border border-line bg-zinc-50 px-1 py-0.5 font-sans text-[10px] text-subtle";
const reviewGrid =
  "m-0 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-sm";
const reviewValue = "m-0 text-end font-semibold";
const modalActions = "mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end";
import { api, downloadBlob } from "@/lib/client";
import {
  quantity,
  totalQuantity,
  formatTotal,
  renamable,
  numberFor,
  routeCode,
  sequenceOf,
} from "@/lib/domain";
export type Product = {
  updatedAt: string;
  id: string;
  code: string;
  description: string;
  units: string[];
  barcodes: { value: string }[];
};
export type Line = {
  id: string;
  code: string;
  product?: Product;
  quantity: string;
  unit: string;
  note?: string;
  description?: string;
  error?: string;
  duplicateAccepted?: boolean;
};
type DraftData = {
  sourceId: string;
  destinationId: string;
  date: string;
  remarks: string;
  lines: Line[];
};
const blank = (): Line => ({
  id: crypto.randomUUID(),
  code: "",
  quantity: "",
  unit: "",
});
// The code → quantity → unit entry table shared by new transfers and requests.
export function useLines(initialLineId: string) {
  const [lines, setLines] = useState<Line[]>([
    { id: initialLineId, code: "", quantity: "", unit: "" },
  ]);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    existingId: string;
    product: Product;
  } | null>(null);
  const latest = useRef(lines);
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    latest.current = lines;
    if (pendingFocus.current) {
      const control = document.getElementById(pendingFocus.current) as
        HTMLInputElement | HTMLSelectElement | null;
      if (control && !control.disabled) {
        control.focus();
        if (document.activeElement === control) pendingFocus.current = null;
      }
    }
  }, [lines]);
  const activeLookups = useRef(
    new Map<string, { code: string; controller: AbortController }>(),
  );
  useEffect(() => {
    const requests = activeLookups.current;
    return () => {
      for (const request of requests.values()) request.controller.abort();
      requests.clear();
    };
  }, []);
  const focus = (id: string, field: string) => {
    pendingFocus.current = `${field}-${id}`;
    const control = document.getElementById(pendingFocus.current) as
      HTMLInputElement | HTMLSelectElement | null;
    if (control && !control.disabled) {
      control.focus();
      if (document.activeElement === control) pendingFocus.current = null;
    }
  };
  const update = useCallback(
    (id: string, patch: Partial<Line>) =>
      setLines((rows) =>
        rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      ),
    [],
  );
  const remove = useCallback((id: string) => {
    setLines((rows) =>
      rows.length === 1 ? [blank()] : rows.filter((row) => row.id !== id),
    );
  }, []);
  const lookup = useCallback(
    async (id: string) => {
      const row = latest.current.find((l) => l.id === id);
      if (!row || !row.code.trim()) return;
      const previous = activeLookups.current.get(id);
      if (previous?.code === row.code) return;
      previous?.controller.abort();
      const controller = new AbortController();
      activeLookups.current.set(id, { code: row.code, controller });
      const code = row.code;
      try {
        const result = await api<{ items: Product[] }>(
          `products?exact=1&q=${encodeURIComponent(code.trim())}`,
          undefined,
          undefined,
          controller.signal,
        );
        if (latest.current.find((l) => l.id === id)?.code !== code) return;
        if (result.items.length !== 1) {
          update(id, {
            error: result.items.length
              ? "Multiple products match. Ask an administrator to review."
              : "Product not found. Check the exact code.",
          });
          focus(id, "code");
          return;
        }
        const product = result.items[0];
        const existing = latest.current.find(
          (l) => l.id !== id && l.product?.id === product.id,
        );
        update(id, {
          product,
          unit: product.units[0] ?? "",
          description: undefined,
          error: undefined,
        });
        if (existing) {
          setDuplicate({ id, existingId: existing.id, product });
          return;
        }
        focus(id, "qty");
      } catch {
        if (controller.signal.aborted) return;
        update(id, { error: "Lookup failed. Retry the code." });
        focus(id, "code");
      } finally {
        if (activeLookups.current.get(id)?.controller === controller)
          activeLookups.current.delete(id);
      }
    },
    [update],
  );
  const advance = useCallback(
    (id: string, fromUnit = false) => {
      const row = latest.current.find((l) => l.id === id);
      if (!row?.product) {
        focus(id, "code");
        return;
      }
      update(id, { error: undefined });
      if (row.product.units.length && !fromUnit) {
        focus(id, "unit");
        return;
      }
      const index = latest.current.findIndex((l) => l.id === id);
      const next = latest.current[index + 1];
      if (next) focus(next.id, "code");
      else {
        const newLine = blank();
        setLines((rows) => [...rows, newLine]);
        focus(newLine.id, "code");
      }
    },
    [update],
  );
  const validLines = lines.filter(
    (l) => l.product && quantity.safeParse(l.quantity).success,
  );
  const total = formatTotal(totalQuantity(validLines));
  return {
    lines,
    setLines,
    update,
    remove,
    lookup,
    advance,
    focus,
    duplicate,
    setDuplicate,
    validLines,
    total,
  };
}
export type LineEditor = ReturnType<typeof useLines>;
export function TransferForm({
  initialKey,
  initialLineId,
}: {
  initialKey: string;
  initialLineId: string;
}) {
  const { t } = useBuzz();
  const editor = useLines(initialLineId);
  const { lines, setLines, validLines, total } = editor;
  const [locations, setLocations] = useState<
    { id: string; name: string; mine: boolean }[]
  >([]);
  const own = locations.filter((l) => l.mine);
  const name = (id: string) => locations.find((l) => l.id === id)?.name;
  const [sourceId, setSource] = useState("");
  const [destinationId, setDestination] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
  );
  const [remarks, setRemarks] = useState("");
  const [key, setKey] = useState(initialKey);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    number: string;
    pdfReady: boolean;
  } | null>(null);
  const [drafts, setDrafts] = useState<
    { id: string; number: string; data: DraftData }[]
  >([]);
  const [deleting, setDeleting] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const data = { sourceId, destinationId, date, remarks, lines };
  // The reserved counter is fixed; its letters follow the chosen route.
  const liveNumber =
    number &&
    numberFor(
      sequenceOf(number),
      name(sourceId) && name(destinationId)
        ? routeCode(name(sourceId)!, name(destinationId)!)
        : "",
    );
  const loadDrafts = useCallback(
    () =>
      api<{ id: string; number: string; data: DraftData }[]>("drafts")
        .then(setDrafts)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    api<{ id: string; name: string; active: boolean; mine: boolean }[]>(
      "locations",
    )
      .then((rows) => {
        const active = rows.filter((l) => l.active);
        setLocations(active);
        // A user tied to one location always transfers from it.
        const mine = active.filter((l) => l.mine);
        if (mine.length === 1) setSource(mine[0].id);
      })
      .catch((e) => setError(e.message));
    loadDrafts();
  }, [loadDrafts]); // initial server state
  async function save() {
    const result = await api<{ number: string }>("drafts", { id: key, data });
    setNumber(result.number);
    setNotice("Draft saved");
    loadDrafts();
    return result.number;
  }
  const reviewForm = useForm<DraftData>({
    resolver: async (values): Promise<ResolverResult<DraftData>> => {
      const message =
        !values.sourceId ||
        !values.destinationId ||
        !values.lines.some((l) => l.product) ||
        values.lines.some(
          (l) =>
            l.code && (!l.product || !quantity.safeParse(l.quantity).success),
        )
          ? "Please complete source, destination and at least one valid item."
          : values.sourceId === values.destinationId
            ? "Source and destination must differ"
            : !/^\d{4}-\d{2}-\d{2}$/.test(values.date)
              ? "Enter a valid transfer date."
              : values.remarks.length > 2000
                ? "Remarks must not exceed 2000 characters."
                : "";
      return message
        ? { values: {}, errors: { sourceId: { type: "validate", message } } }
        : { values, errors: {} };
    },
  });
  async function openReview() {
    reviewForm.reset(data);
    await reviewForm.handleSubmit(
      async () => {
        await reviewValidated();
      },
      (errors) => {
        setError(
          errors.sourceId?.message ??
            "Invalid input. Please check the entered fields.",
        );
      },
    )();
  }
  async function reviewValidated() {
    setBusy(true);
    setError("");
    try {
      await save();
      setReview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        id: string;
        number: string;
        pdfReady: boolean;
      }>("transfers", {
        key,
        sourceId,
        destinationId,
        date,
        remarks,
        lines: validLines.map((l) => ({
          productId: l.product!.id,
          version: l.product!.updatedAt,
          quantity: l.quantity,
          unit: l.unit,
          note: l.note?.trim() || undefined,
          description:
            renamable(l.product!.code) && l.description?.trim()
              ? l.description.trim()
              : undefined,
          duplicateAccepted: l.duplicateAccepted,
        })),
      });
      setSuccess(result);
      setReview(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteDraft(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`drafts/${id}`, undefined, "DELETE");
      setDrafts((rows) => rows.filter((d) => d.id !== id));
      if (id === key) reset();
      setNotice("Draft deleted");
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setKey(crypto.randomUUID());
    setNumber("");
    setLines([blank()]);
    setSuccess(null);
    setNotice("");
    setRemarks("");
    setError("");
  }
  if (success)
    return (
      <>
        <PageTitle eyebrow="Internal transfers" title="New transfer" />
        <SuccessActions transfer={success} onAnother={reset} />
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="Internal transfers"
        title="New transfer"
        subtitle="Prepare, confirm and share inventory transfer documents."
        action={
          <span className="hidden items-center gap-2 text-xs text-subtle lg:flex">
            <span className="size-1.5 rounded-full bg-ok" />
            {t("Keyboard ready")}
          </span>
        }
      />
      <div className="mb-5 hidden items-center gap-3 text-xs text-subtle md:flex">
        {["Transfer details", "Transfer items", "Review and confirm"].map(
          (step, i) => (
            <Fragment key={step}>
              {i > 0 && <span className="h-px max-w-12 flex-1 bg-line" />}
              <span
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap",
                  i === 0 && "text-ink",
                )}
              >
                <b
                  className={cx(
                    "inline-flex size-5 items-center justify-center rounded-full border text-[10px] font-medium",
                    i === 0
                      ? "border-brand-soft bg-brand-soft text-brand"
                      : "border-line",
                  )}
                >
                  {i + 1}
                </b>
                {t(step)}
              </span>
            </Fragment>
          ),
        )}
        <div className="ms-auto hidden items-center gap-2 lg:flex">
          <Keyboard size={15} />
          <kbd className={kbd}>TAB</kbd> {t("Next item")}
        </div>
      </div>
      <div className="flex flex-col gap-4 pb-28 md:gap-5 md:pb-0">
        {error && <Notice tone="error">{t(error)}</Notice>}
        {notice && <Notice>{t(notice)}</Notice>}
        <Card>
          <CardHeader index="01" title={t("Transfer details")}>
            <Status value="DRAFT" />
          </CardHeader>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2 gap-y-4 p-4 md:p-6 lg:grid-cols-[1.2fr_auto_1.2fr_1fr_1fr] lg:gap-x-4">
            <Field label={t("From location")}>
              {own.length === 1 ? (
                <input
                  className={inputStyles}
                  aria-label={t("From location")}
                  value={own[0].name}
                  readOnly
                />
              ) : (
                <Dropdown
                  aria-label={t("From location")}
                  value={sourceId}
                  onChange={(e) => setSource(e.target.value)}
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
            <span className="flex h-11 items-center self-end text-subtle md:h-10">
              <ArrowRight size={18} className="rtl:-scale-x-100" />
            </span>
            <Field label={t("To location")}>
              <Dropdown
                aria-label={t("To location")}
                value={destinationId}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">{t("Select location")}</option>
                {locations
                  .filter((l) => l.id !== sourceId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Dropdown>
            </Field>
            <Field label={t("Transfer date")} className="max-lg:col-start-1">
              <DatePicker
                label={t("Transfer date")}
                value={date}
                onChange={setDate}
              />
            </Field>
            <Field label={t("Transfer number")} className="max-lg:col-start-3">
              <input
                className={inputStyles}
                value={liveNumber || t("Assigned on save")}
                readOnly
                dir="ltr"
              />
            </Field>
          </div>
        </Card>
        <ItemsCard editor={editor} index="02" title="Transfer items" />
        <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-subtle">
          <FileCheck2 size={16} className="shrink-0" />
          {t(
            "Confirmed documents are permanent. Administrator approval is tracked separately.",
          )}
        </p>
        {drafts.length > 0 && (
          <details className="rounded-xl border border-line bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">
              {t("Saved drafts")} ({drafts.length})
            </summary>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {drafts.map((d) => (
                <span key={d.id} className="flex items-center gap-2">
                  <Button
                    className="flex-1 justify-start"
                    onClick={() => {
                      setKey(d.id);
                      setNumber(d.number);
                      if (own.length !== 1) setSource(d.data.sourceId);
                      setDestination(d.data.destinationId);
                      setDate(d.data.date);
                      setRemarks(d.data.remarks);
                      setLines(d.data.lines);
                      setNotice("");
                    }}
                  >
                    {t("Open draft")} · <span dir="ltr">{d.number}</span>
                  </Button>
                  <button
                    type="button"
                    className={cx(
                      iconButton,
                      "hover:bg-red-50 hover:text-red-700",
                    )}
                    aria-label={`${t("Delete draft")} · ${d.number}`}
                    disabled={busy}
                    onClick={() => setDeleting({ id: d.id, number: d.number })}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
      {/* Fixed to the bottom of the screen on phones, inline from md up. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-5 md:flex md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0 lg:ps-0">
        <span className="hidden items-center gap-2 text-xs text-subtle md:flex">
          <FileText size={15} />
          {t("Drafts are saved to the server.")}
        </span>
        <div className="grid grid-cols-2 gap-2 md:flex">
          {drafts.some((d) => d.id === key) && (
            <Button
              variant="danger"
              className="col-span-2"
              disabled={busy}
              onClick={() => setDeleting({ id: key, number })}
            >
              <Trash2 size={16} />
              {t("Delete draft")}
            </Button>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await save();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            {t("Save draft")}
          </Button>
          <Button variant="primary" disabled={busy} onClick={openReview}>
            <Check size={17} />
            {t(busy ? "Please wait…" : "Confirm Transfer")}
          </Button>
        </div>
      </div>
      {deleting && (
        <Modal title="Delete draft" onClose={() => !busy && setDeleting(null)}>
          <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
            {t(
              "This saved draft and all of its items will be removed. Its number will not be reused.",
            )}
          </p>
          <dl className={reviewGrid}>
            <dt className="text-subtle">{t("Transfer number")}</dt>
            <dd className={reviewValue} dir="ltr">
              {deleting.number}
            </dd>
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
              onClick={() => deleteDraft(deleting.id)}
            >
              <Trash2 size={16} />
              {t(busy ? "Please wait…" : "Delete draft")}
            </Button>
          </div>
        </Modal>
      )}
      {review && (
        <Modal
          title="Review transfer"
          onClose={() => !busy && setReview(false)}
        >
          <p className="mt-0 mb-4 text-sm text-muted">
            {t("Review the document before confirming.")}
          </p>
          <dl className={reviewGrid}>
            <dt className="text-subtle">{t("Transfer number")}</dt>
            <dd className={reviewValue} dir="ltr">
              {liveNumber}
            </dd>
            <dt className="text-subtle">{t("From location")}</dt>
            <dd className={reviewValue}>
              {locations.find((l) => l.id === sourceId)?.name}
            </dd>
            <dt className="text-subtle">{t("To location")}</dt>
            <dd className={reviewValue}>
              {locations.find((l) => l.id === destinationId)?.name}
            </dd>
            <dt className="text-subtle">{t("Total item lines")}</dt>
            <dd className={reviewValue}>{validLines.length}</dd>
            <dt className="text-subtle">{t("Total quantity")}</dt>
            <dd className={reviewValue}>{Number(total)}</dd>
          </dl>
          {error && (
            <div className="mt-4">
              <Notice tone="error">{t(error)}</Notice>
            </div>
          )}
          <div className={modalActions}>
            <Button disabled={busy} onClick={() => setReview(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="primary" disabled={busy} onClick={confirm}>
              {t(busy ? "Please wait…" : "Confirm and generate PDF")}
            </Button>
          </div>
        </Modal>
      )}
      <DuplicateDialog editor={editor} />
    </>
  );
}
export function ItemsCard({
  editor,
  index,
  title,
}: {
  editor: LineEditor;
  index: string;
  title: string;
}) {
  const { t } = useBuzz();
  const { lines, setLines, update, lookup, advance, remove, focus } = editor;
  const { validLines, total } = editor;
  return (
    <Card className="overflow-visible">
      <CardHeader index={index} title={t(title)}>
        <span className="rounded-md border border-line px-1.5 text-xs text-subtle">
          {validLines.length}
        </span>
      </CardHeader>
      <div className={table.wrap}>
        <table className={table.table}>
          <thead className={table.head}>
            <tr>
              <th className={cx(table.th, "w-12")}>#</th>
              <th className={cx(table.th, "w-56")}>{t("Code / Barcode")}</th>
              <th className={table.th}>{t("Product description")}</th>
              <th className={cx(table.th, "w-28")}>{t("Quantity")}</th>
              <th className={cx(table.th, "w-36")}>{t("Unit")}</th>
              <th className={cx(table.th, "w-24")} aria-label={t("Actions")} />
            </tr>
          </thead>
          <tbody className={table.body}>
            {lines.map((line, index) => (
              <EntryRow
                key={line.id}
                line={line}
                index={index}
                update={update}
                lookup={lookup}
                advance={advance}
                remove={remove}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-2 py-1 md:px-4">
        <button
          type="button"
          className={cx(linkButton, "gap-2 px-2")}
          onClick={() => {
            const row = blank();
            setLines((rows) => [...rows, row]);
            focus(row.id, "code");
          }}
        >
          <Plus size={18} />
          {t("Add item")}
        </button>
        <span className="hidden items-center gap-1.5 text-xs text-subtle lg:flex">
          {t("Code / Barcode")}
          <ArrowRight size={12} className="rtl:-scale-x-100" />
          {t("Quantity")}
          <ArrowRight size={12} className="rtl:-scale-x-100" />
          {t("Unit")}
          <ArrowRight size={12} className="rtl:-scale-x-100" />
          {t("Next item")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-zinc-50/60 px-4 py-3 text-sm text-subtle md:px-6">
        <span>
          {validLines.length} {t("items")}
        </span>
        <span className="flex items-center gap-3">
          {t("Total quantity")}
          <strong className="text-lg text-ink tabular-nums" dir="ltr">
            {Number(total).toLocaleString("en", {
              maximumFractionDigits: 3,
            })}
          </strong>
        </span>
      </div>
    </Card>
  );
}
export function DuplicateDialog({ editor }: { editor: LineEditor }) {
  const { t } = useBuzz();
  const { duplicate, setDuplicate, update, setLines, focus } = editor;
  if (!duplicate) return null;
  return (
    <Modal
      title="Product already added"
      onClose={() => {
        update(duplicate.id, { code: "", product: undefined, unit: "" });
        setDuplicate(null);
      }}
    >
      <p className="mt-0 mb-1 font-semibold" dir="auto">
        {duplicate.product.description}
      </p>
      <p className="m-0 text-sm text-muted">
        {t("Resolve this duplicate before continuing.")}
      </p>
      <div className={modalActions}>
        <Button
          onClick={() => {
            setLines((rows) => rows.filter((l) => l.id !== duplicate.id));
            focus(duplicate.existingId, "qty");
            setDuplicate(null);
          }}
        >
          {t("Update existing quantity")}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            update(duplicate.id, { duplicateAccepted: true });
            focus(duplicate.id, "qty");
            setDuplicate(null);
          }}
        >
          {t("Keep separate row")}
        </Button>
      </div>
    </Modal>
  );
}
const EntryRow = memo(function EntryRow({
  line,
  index,
  update,
  lookup,
  advance,
  remove,
}: {
  line: Line;
  index: number;
  update: (id: string, patch: Partial<Line>) => void;
  lookup: (id: string) => void;
  advance: (id: string, fromUnit?: boolean) => void;
  remove: (id: string) => void;
}) {
  const { t, toast } = useBuzz();
  const rowForm = useForm<{ quantity: string }>({
    values: { quantity: line.quantity },
    resetOptions: { keepErrors: true, keepTouched: true },
    mode: "onTouched",
  });
  const quantityField = rowForm.register("quantity", {
    validate: (value) =>
      quantity.safeParse(value).success ||
      t("Enter a positive quantity with up to 3 decimal places."),
  });
  const product = line.product;
  const [noteOpen, setNoteOpen] = useState(Boolean(line.note));
  return (
    <tr
      className={cx(
        "grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-line px-4 py-4 last:border-b-0 md:table-row md:p-0",
        line.error && "bg-red-50/50",
      )}
    >
      <td
        className={cx(
          table.td,
          "col-start-1 row-start-1 self-center text-xs text-subtle tabular-nums",
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </td>
      <td className={cx(table.td, "col-span-2")}>
        <div className="relative">
          <ScanLine
            size={16}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            className={cx(
              inputStyles,
              "ps-10 pe-9 font-semibold",
              line.error && "border-red-300",
            )}
            id={`code-${line.id}`}
            aria-label={`${t("Code / Barcode")} ${index + 1}`}
            dir="ltr"
            autoComplete="off"
            enterKeyHint="next"
            value={line.code}
            placeholder={t("Scan or enter code")}
            onChange={(e) => {
              // Codes are always entered in capitals; keep the caret in place.
              const input = e.target;
              const caret = input.selectionStart;
              input.value = input.value.toUpperCase();
              input.setSelectionRange(caret, caret);
              update(line.id, {
                code: input.value,
                product: undefined,
                error: undefined,
                unit: "",
                duplicateAccepted: false,
              });
            }}
            onKeyDown={(e) => {
              if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
                e.preventDefault();
                lookup(line.id);
              }
            }}
          />
          {product && (
            <CheckCircle2
              size={16}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-ok"
            />
          )}
        </div>
        {line.error && (
          <span className="mt-1 block text-xs text-red-700" role="alert">
            {t(line.error)}
          </span>
        )}
      </td>
      <td className={cx(table.td, "col-span-2")}>
        {product && renamable(product.code) ? (
          <input
            id={`description-${line.id}`}
            className={inputStyles}
            aria-label={`${t("Product description")} ${index + 1}`}
            dir="auto"
            maxLength={2000}
            value={line.description ?? product.description}
            onChange={(e) => update(line.id, { description: e.target.value })}
          />
        ) : (
          <span
            dir="auto"
            className={cx(
              "block text-sm",
              product ? "text-ink" : "text-subtle max-md:hidden",
            )}
          >
            {product?.description ?? t("Description appears automatically")}
          </span>
        )}
        {noteOpen && (
          <input
            id={`note-${line.id}`}
            className={cx(inputStyles, "mt-2 border-brand/30 bg-brand-soft/40")}
            aria-label={`${t("Item note")} ${index + 1}`}
            dir="auto"
            maxLength={500}
            value={line.note ?? ""}
            placeholder={t("Note for this item")}
            onChange={(e) => update(line.id, { note: e.target.value })}
          />
        )}
      </td>
      <td className={cx(table.td, "relative")}>
        <span className="mb-1.5 block text-xs text-subtle md:hidden">
          {t("Quantity")}
        </span>
        <input
          {...quantityField}
          aria-invalid={!!rowForm.formState.errors.quantity}
          className={cx(
            inputStyles,
            "text-center font-semibold tabular-nums disabled:bg-zinc-50 aria-invalid:border-red-300",
          )}
          id={`qty-${line.id}`}
          aria-label={`${t("Quantity")} ${index + 1}`}
          dir="ltr"
          inputMode="decimal"
          enterKeyHint="next"
          value={line.quantity}
          placeholder="0"
          disabled={!product}
          onChange={(e) => {
            void quantityField.onChange(e);
            update(line.id, { quantity: e.target.value, error: undefined });
          }}
          onBlur={async (e) => {
            await quantityField.onBlur(e);
            const error = rowForm.getFieldState("quantity").error;
            if (error?.message && line.quantity !== "") toast(error.message);
          }}
          onKeyDown={async (e) => {
            if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
              e.preventDefault();
              if (await rowForm.trigger("quantity")) advance(line.id);
              else {
                toast(String(rowForm.getFieldState("quantity").error?.message));
                rowForm.setFocus("quantity");
              }
            }
          }}
        />
      </td>
      <td className={table.td}>
        <span className="mb-1.5 block text-xs text-subtle md:hidden">
          {t("Unit")}
        </span>
        {product?.units.length ? (
          <Dropdown
            id={`unit-${line.id}`}
            aria-label={`${t("Unit")} ${index + 1}`}
            value={line.unit}
            onChange={(e) => update(line.id, { unit: e.target.value })}
            onKeyDown={(e) => {
              if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
                e.preventDefault();
                advance(line.id, true);
              }
            }}
          >
            {product.units.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
            <option value="">{t("No unit")}</option>
          </Dropdown>
        ) : (
          <span
            className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-50 text-subtle md:min-h-10 md:bg-transparent"
            title={t("No defined unit")}
          >
            —
          </span>
        )}
      </td>
      <td
        className={cx(
          table.td,
          "col-start-2 row-start-1 -my-2 flex justify-end md:my-0 md:table-cell",
        )}
      >
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className={noteOpen ? iconButtonActive : iconButton}
            tabIndex={-1}
            aria-label={`${t("Item note")} ${index + 1}`}
            aria-pressed={noteOpen}
            title={t("Add a note")}
            onClick={() => {
              if (noteOpen && !line.note?.trim()) {
                update(line.id, { note: undefined });
                setNoteOpen(false);
                return;
              }
              setNoteOpen(true);
              requestAnimationFrame(() =>
                document.getElementById(`note-${line.id}`)?.focus(),
              );
            }}
          >
            <MessageSquarePlus size={17} />
          </button>
          <button
            type="button"
            className={cx(iconButton, "hover:bg-red-50 hover:text-red-700")}
            tabIndex={-1}
            aria-label={`${t("Remove item")} ${index + 1}`}
            onClick={() => remove(line.id)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </td>
    </tr>
  );
});
function canSharePdf(file: File) {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}
export function SuccessActions({
  transfer,
  onAnother,
}: {
  transfer: { id: string; number: string; pdfReady: boolean };
  onAnother?: () => void;
}) {
  const { t } = useBuzz();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = `/api/transfers/${transfer.id}/pdf`;
  const prepare = useCallback(
    () =>
      fetch(url)
        .then(async (res) => {
          if (!res.ok)
            throw new Error(
              "The transfer is saved. PDF generation can be retried safely.",
            );
          const blob = await res.blob();
          setFile(
            new File([blob], transfer.number + ".pdf", {
              type: "application/pdf",
            }),
          );
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false)),
    [url, transfer.number],
  );
  useEffect(() => {
    void prepare();
  }, [prepare]);
  const text = `${t("Transfer No")}: ${transfer.number} — MEHDI ALI TRADING Co. ${t("Inventory transfer document")}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  async function share() {
    if (!file) return;
    setError("");
    if (canSharePdf(file)) {
      try {
        await navigator.share({ files: [file], title: transfer.number, text });
        setMessage("File shared using your device.");
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    downloadBlob(file, file.name);
    setFallback(true);
    setMessage("The PDF has downloaded. Attach it manually in WhatsApp.");
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <Card className="flex flex-col items-center px-5 py-10 text-center md:py-14">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-50 text-ok">
        <Check size={30} />
      </div>
      <span className="text-[11px] font-bold tracking-[0.18em] text-ok uppercase">
        {t("Confirmed")}
      </span>
      <h2 className="mt-2 mb-1 text-xl font-semibold md:text-2xl">
        {t("Transfer Confirmed Successfully")}
      </h2>
      <p className="mt-0 mb-6 text-sm text-muted">
        {t("Transfer No")}:{" "}
        <strong className="text-ink" dir="ltr">
          {transfer.number}
        </strong>
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          variant="primary"
          disabled={!file || busy}
          onClick={() => file && downloadBlob(file, file.name)}
        >
          <Download size={18} />
          {t("Download PDF")}
        </Button>
        <Button variant="whatsapp" disabled={!file || busy} onClick={share}>
          <Share2 size={18} />
          {t("Share via WhatsApp")}
        </Button>
      </div>
      {busy && (
        <p className="mt-3 mb-0 text-sm text-muted" role="status">
          {t("Preparing PDF…")}
        </p>
      )}
      {error && (
        <div className="mt-4 flex w-full max-w-md flex-col items-center gap-2">
          <Notice tone="error">{t(error)}</Notice>
          <Button onClick={prepare}>{t("Retry PDF")}</Button>
        </div>
      )}
      {message && (
        <div className="mt-4 w-full max-w-md">
          <Notice>{t(message)}</Notice>
        </div>
      )}
      {fallback && (
        <a
          className={cx(buttonStyles.whatsapp, "mt-3")}
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Open WhatsApp")}
          <ArrowRight size={16} className="rtl:-scale-x-100" />
        </a>
      )}
      <p className="mt-3 mb-0 text-xs text-subtle">
        {t(
          file && canSharePdf(file)
            ? "Choose WhatsApp from your device’s share menu."
            : "Download first, then open WhatsApp and attach the PDF.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1">
        <a
          className={cx(linkButton, "gap-1.5")}
          href={`${url}?inline=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FileText size={15} />
          {t("Preview / Print")}
        </a>
        {onAnother ? (
          <button
            type="button"
            className={cx(linkButton, "gap-1.5")}
            onClick={onAnother}
          >
            <Plus size={15} />
            {t("Create another transfer")}
          </button>
        ) : (
          <Link className={linkButton} href="/new-transfer">
            {t("Create another transfer")}
          </Link>
        )}
      </div>
    </Card>
  );
}
