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
} from "lucide-react";
import { useBuzz, PageTitle, Status } from "./shell";
import { api, downloadBlob } from "@/lib/client";
import { quantity, totalQuantity, formatTotal } from "@/lib/domain";
export type Product = {
  updatedAt: string;
  id: string;
  code: string;
  description: string;
  units: string[];
  barcodes: { value: string }[];
};
type Line = {
  id: string;
  code: string;
  product?: Product;
  quantity: string;
  unit: string;
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
export function TransferForm({
  initialKey,
  initialLineId,
}: {
  initialKey: string;
  initialLineId: string;
}) {
  const { t } = useBuzz();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [sourceId, setSource] = useState("");
  const [destinationId, setDestination] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
  );
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { id: initialLineId, code: "", quantity: "", unit: "" },
  ]);
  const [key, setKey] = useState(initialKey);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    existingId: string;
    product: Product;
  } | null>(null);
  const [success, setSuccess] = useState<{
    id: string;
    number: string;
    pdfReady: boolean;
  } | null>(null);
  const [drafts, setDrafts] = useState<
    { id: string; number: string; data: DraftData }[]
  >([]);
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
  const data = { sourceId, destinationId, date, remarks, lines };
  const focus = (id: string, field: string) => {
    pendingFocus.current = `${field}-${id}`;
    const control = document.getElementById(pendingFocus.current) as
      HTMLInputElement | HTMLSelectElement | null;
    if (control && !control.disabled) {
      control.focus();
      if (document.activeElement === control) pendingFocus.current = null;
    }
  };
  useEffect(() => {
    api<{ id: string; name: string }[]>("locations")
      .then((rows) =>
        setLocations(rows.filter((l) => !("active" in l) || l.active)),
      )
      .catch((e) => setError(e.message));
    api<typeof drafts>("drafts")
      .then(setDrafts)
      .catch((e) => setError(e.message));
  }, []); // initial server state
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
        update(id, { product, unit: product.units[0] ?? "", error: undefined });
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
  async function save() {
    const result = await api<{ number: string }>("drafts", { id: key, data });
    setNumber(result.number);
    setNotice("Draft saved");
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
          <span className="keyboard-ready">
            <span />
            {t("Keyboard ready")}
          </span>
        }
      />
      <div className="workflow">
        <span className="current">
          <b>1</b>
          {t("Transfer details")}
        </span>
        <span className="step-line" />
        <span>
          <b>2</b>
          {t("Transfer items")}
        </span>
        <span className="step-line" />
        <span>
          <b>3</b>
          {t("Review and confirm")}
        </span>
        <div className="workflow-right">
          <Keyboard size={15} />
          <kbd>TAB</kbd> {t("Next item")}
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {t(error)}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {t(notice)}
        </div>
      )}
      <section className="card transfer-header">
        <div className="card-heading">
          <div>
            <span className="section-index">01</span>
            <h2>{t("Transfer details")}</h2>
          </div>
          <Status value="DRAFT" />
        </div>
        <div className="header-fields">
          <label>
            {t("From location")}
            <Dropdown
              aria-label={t("From location")}
              value={sourceId}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">{t("Select location")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Dropdown>
          </label>
          <span className="route-arrow">
            <ArrowRight size={19} />
          </span>
          <label>
            {t("To location")}
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
          </label>
          <label>
            {t("Transfer date")}
            <DatePicker
              label={t("Transfer date")}
              value={date}
              onChange={setDate}
            />
          </label>
          <label>
            {t("Transfer number")}
            <input
              value={number || t("Assigned on save")}
              readOnly
              dir="ltr"
              className="readonly"
            />
          </label>
        </div>
      </section>
      <section className="card items-card">
        <div className="card-heading">
          <div>
            <span className="section-index">02</span>
            <h2>{t("Transfer items")}</h2>
            <span className="count">{validLines.length}</span>
          </div>
          <span className="muted small">
            <ScanLine size={15} />
            {t("Enter code")} <kbd>Tab ↹</kbd> {t("Identify product")}
          </span>
        </div>
        <div className="table-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th className="row-number">#</th>
                <th>{t("Code / Barcode")}</th>
                <th>{t("Product description")}</th>
                <th>{t("Quantity")}</th>
                <th>{t("Unit")}</th>
                <th aria-label={t("Actions")} />
              </tr>
            </thead>
            <tbody>
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
        <div className="add-row">
          <button
            className="text-button"
            onClick={() => {
              const row = blank();
              setLines((rows) => [...rows, row]);
              focus(row.id, "code");
            }}
          >
            <Plus size={16} />
            {t("Add item")}
          </button>
          <span className="muted small">
            {t("Code / Barcode")} <ArrowRight size={12} />
            {t("Quantity")} <ArrowRight size={12} />
            {t("Unit")} <ArrowRight size={12} />
            {t("Next item")}
          </span>
        </div>
        <div className="items-total">
          <span>
            {validLines.length} {t("items")}
          </span>
          <div>
            {t("Total quantity")}
            <strong dir="ltr">
              {Number(total).toLocaleString("en", { maximumFractionDigits: 3 })}
            </strong>
          </div>
        </div>
      </section>
      <section className="remarks-section">
        <label>
          {t("Remarks")}
          <textarea
            aria-label={t("Remarks")}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={t("Optional notes for this transfer")}
            maxLength={2000}
          />
        </label>
        <div className="document-note">
          <FileCheck2 size={20} />
          <p>
            {t(
              "Confirmed documents are permanent. Administrator approval is tracked separately.",
            )}
          </p>
        </div>
      </section>
      <div className="confirmation-bar">
        <span>
          <ShieldIcon />
          {t("Drafts are saved to the server.")}
        </span>
        <div>
          <button
            className="button"
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
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={openReview}
          >
            <Check size={17} />
            {t(busy ? "Please wait…" : "Confirm Transfer")}
          </button>
        </div>
      </div>
      {drafts.length > 0 && (
        <details className="draft-list">
          <summary>
            {t("Saved drafts")} ({drafts.length})
          </summary>
          {drafts.map((d) => (
            <button
              key={d.id}
              className="button"
              onClick={() => {
                setKey(d.id);
                setNumber(d.number);
                setSource(d.data.sourceId);
                setDestination(d.data.destinationId);
                setDate(d.data.date);
                setRemarks(d.data.remarks);
                setLines(d.data.lines);
              }}
            >
              {t("Open draft")} · {d.number}
            </button>
          ))}
        </details>
      )}
      {review && (
        <Modal
          title="Review transfer"
          onClose={() => !busy && setReview(false)}
        >
          <p className="muted">{t("Review the document before confirming.")}</p>
          <dl className="review-grid">
            <dt>{t("Transfer number")}</dt>
            <dd dir="ltr">{number}</dd>
            <dt>{t("From location")}</dt>
            <dd>{locations.find((l) => l.id === sourceId)?.name}</dd>
            <dt>{t("To location")}</dt>
            <dd>{locations.find((l) => l.id === destinationId)?.name}</dd>
            <dt>{t("Total item lines")}</dt>
            <dd>{validLines.length}</dd>
            <dt>{t("Total quantity")}</dt>
            <dd>{Number(total)}</dd>
          </dl>
          {error && <div className="error">{t(error)}</div>}
          <div className="modal-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              {t("Cancel")}
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={confirm}
            >
              {t(busy ? "Please wait…" : "Confirm and generate PDF")}
            </button>
          </div>
        </Modal>
      )}
      {duplicate && (
        <Modal
          title="Product already added"
          onClose={() => {
            update(duplicate.id, { code: "", product: undefined, unit: "" });
            setDuplicate(null);
          }}
        >
          <p>{duplicate.product.description}</p>
          <p className="muted">
            {t("Resolve this duplicate before continuing.")}
          </p>
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => {
                setLines((rows) => rows.filter((l) => l.id !== duplicate.id));
                focus(duplicate.existingId, "qty");
                setDuplicate(null);
              }}
            >
              {t("Update existing quantity")}
            </button>
            <button
              className="button primary"
              onClick={() => {
                update(duplicate.id, { duplicateAccepted: true });
                focus(duplicate.id, "qty");
                setDuplicate(null);
              }}
            >
              {t("Keep separate row")}
            </button>
          </div>
        </Modal>
      )}
    </>
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
  const { t } = useBuzz();
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
  return (
    <tr
      className={line.error ? "invalid-row" : product ? "identified-row" : ""}
    >
      <td className="row-number">{String(index + 1).padStart(2, "0")}</td>
      <td>
        <div className="code-field">
          <ScanLine size={15} />
          <input
            id={`code-${line.id}`}
            aria-label={`${t("Code / Barcode")} ${index + 1}`}
            dir="ltr"
            autoComplete="off"
            value={line.code}
            placeholder={t("Scan or enter code")}
            onChange={(e) =>
              update(line.id, {
                code: e.target.value,
                product: undefined,
                error: undefined,
                unit: "",
                duplicateAccepted: false,
              })
            }
            onKeyDown={(e) => {
              if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
                e.preventDefault();
                lookup(line.id);
              }
            }}
          />
          {product && <CheckCircle2 size={14} className="success-icon" />}
        </div>
        {line.error && (
          <span className="inline-error" role="alert">
            {t(line.error)}
          </span>
        )}
      </td>
      <td>
        <span
          dir="auto"
          className={product ? "description" : "description empty-description"}
        >
          {product?.description ?? t("Description appears automatically")}
        </span>
      </td>
      <td data-label={t("Quantity")}>
        <input
          {...quantityField}
          aria-invalid={!!rowForm.formState.errors.quantity}
          className="quantity-input"
          id={`qty-${line.id}`}
          aria-label={`${t("Quantity")} ${index + 1}`}
          dir="ltr"
          inputMode="decimal"
          value={line.quantity}
          placeholder="0"
          disabled={!product}
          onChange={(e) => {
            void quantityField.onChange(e);
            update(line.id, { quantity: e.target.value, error: undefined });
          }}
          onKeyDown={async (e) => {
            if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
              e.preventDefault();
              if (await rowForm.trigger("quantity")) advance(line.id);
              else rowForm.setFocus("quantity");
            }
          }}
        />
        {rowForm.formState.errors.quantity && (
          <span className="inline-error" role="alert">
            {rowForm.formState.errors.quantity.message}
          </span>
        )}
      </td>
      <td data-label={t("Unit")}>
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
          </Dropdown>
        ) : (
          <span className="unit-empty" title={t("No defined unit")}>
            —
          </span>
        )}
      </td>
      <td>
        <button
          className="icon-button"
          tabIndex={-1}
          aria-label={`${t("Remove item")} ${index + 1}`}
          onClick={() => remove(line.id)}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
});
function ShieldIcon() {
  return <FileText size={15} />;
}
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
    <section className="success-panel card">
      <div className="success-mark">
        <Check size={31} />
      </div>
      <span className="eyebrow">{t("Confirmed")}</span>
      <h2>{t("Transfer Confirmed Successfully")}</h2>
      <p>
        {t("Transfer No")}: <strong dir="ltr">{transfer.number}</strong>
      </p>
      <div className="success-actions">
        <button
          className="button primary"
          disabled={!file || busy}
          onClick={() => file && downloadBlob(file, file.name)}
        >
          <Download size={18} />
          {t("Download PDF")}
        </button>
        <button
          className="button whatsapp"
          disabled={!file || busy}
          onClick={share}
        >
          <Share2 size={18} />
          {t("Share via WhatsApp")}
        </button>
      </div>
      {busy && <p role="status">{t("Preparing PDF…")}</p>}
      {error && (
        <div className="error" role="alert">
          {t(error)}{" "}
          <button className="button" onClick={prepare}>
            {t("Retry PDF")}
          </button>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {t(message)}
        </p>
      )}
      {fallback && (
        <a
          className="button whatsapp"
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Open WhatsApp")}
          <ArrowRight size={16} />
        </a>
      )}
      <p className="share-explanation">
        {t(
          file && canSharePdf(file)
            ? "Choose WhatsApp from your device’s share menu."
            : "Download first, then open WhatsApp and attach the PDF.",
        )}
      </p>
      <div className="success-secondary">
        <a
          className="text-button"
          href={`${url}?inline=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FileText size={15} />
          {t("Preview / Print")}
        </a>
        {onAnother ? (
          <button className="text-button" onClick={onAnother}>
            <Plus size={15} />
            {t("Create another transfer")}
          </button>
        ) : (
          <Link className="text-button" href="/new-transfer">
            {t("Create another transfer")}
          </Link>
        )}
      </div>
    </section>
  );
}
