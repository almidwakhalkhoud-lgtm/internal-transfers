"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import { api } from "@/lib/client";
import { renamable, type SnapshotLine } from "@/lib/domain";
import { useBuzz } from "./shell";
import { Modal, type Product } from "./transfer-form";
import { Dropdown } from "./dropdown";
import { DatePicker } from "./date-picker";
import { Button, Field, Notice, cx, iconButton, inputStyles } from "./ui";

type EditLine = {
  key: number;
  // Index of the confirmed line this one keeps; absent for an added item.
  original?: number;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  note?: string;
};
const validQuantity = (v: string) =>
  /^\d{1,12}(\.\d{1,3})?$/.test(v) && Number(v) > 0;
async function findProduct(code: string) {
  const { items } = await api<{ items: Product[] }>(
    `products?exact=1&q=${encodeURIComponent(code.trim())}`,
  );
  return items.length === 1
    ? items[0]
    : items.find((p) => p.code === code.trim());
}
// An administrator corrects a confirmed transfer: quantities and units,
// items removed or added, the date and the remarks. The server keeps the
// replaced version, removes the signatures and raises the revision.
export function EditTransferModal({
  transfer,
  onClose,
  onSaved,
}: {
  transfer: {
    id: string;
    number: string;
    revision: number;
    date: string;
    remarks: string;
    lines: SnapshotLine[];
    signatures: unknown[];
    qbmEntry?: { reference: string } | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, toast } = useBuzz();
  const next = useRef(transfer.lines.length);
  const [lines, setLines] = useState<EditLine[]>(() =>
    transfer.lines.map((l, i) => ({
      key: i,
      original: i,
      code: l.code,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      note: l.note,
    })),
  );
  // Units each code may use: the catalog's, plus a line's own unit in case
  // the catalog dropped it since confirmation.
  const [units, setUnits] = useState<Record<string, string[]>>({});
  const [date, setDate] = useState(transfer.date.slice(0, 10));
  const [remarks, setRemarks] = useState(transfer.remarks);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const codes = [...new Set(transfer.lines.map((l) => l.code))];
    Promise.all(
      codes.map((c) =>
        findProduct(c)
          .then((p) => [c, p?.units ?? []] as const)
          .catch(() => [c, []] as const),
      ),
    ).then((found) => {
      if (live) setUnits((u) => ({ ...Object.fromEntries(found), ...u }));
    });
    return () => {
      live = false;
    };
  }, [transfer.lines]);
  const update = (key: number, change: Partial<EditLine>) =>
    setLines((all) =>
      all.map((l) => (l.key === key ? { ...l, ...change } : l)),
    );
  async function add() {
    if (!code.trim()) return;
    setFinding(true);
    setErr("");
    try {
      const p = await findProduct(code);
      if (!p) {
        setErr(t("Product not found. Check the exact code."));
        return;
      }
      setUnits((u) => ({ ...u, [p.code]: p.units }));
      setLines((all) => [
        ...all,
        {
          key: next.current++,
          code: p.code,
          description: p.description,
          quantity: "",
          unit: p.units[0] ?? "",
        },
      ]);
      setCode("");
    } catch (e) {
      setErr(t((e as Error).message));
    } finally {
      setFinding(false);
    }
  }
  const invalid =
    !lines.length ||
    !date ||
    lines.some(
      (l) =>
        !validQuantity(l.quantity) ||
        (renamable(l.code) && !l.description.trim()),
    );
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api(
        `transfers/${transfer.id}`,
        {
          revision: transfer.revision,
          date,
          remarks,
          reason,
          lines: lines.map((l) => ({
            ...(l.original === undefined ? {} : { original: l.original }),
            code: l.code,
            quantity: l.quantity,
            unit: l.unit,
            ...(l.note ? { note: l.note } : {}),
            ...(renamable(l.code) ? { description: l.description.trim() } : {}),
          })),
        },
        "PATCH",
      );
      toast(t("Transfer edited"), "ok");
      onSaved();
    } catch (e) {
      setErr(t((e as Error).message));
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit transfer" onClose={() => !busy && onClose()}>
      <p className="mt-0 mb-4 text-sm leading-relaxed text-muted">
        {t(
          "The replaced version and its PDF are kept in the edit history, and the PDF is made again.",
        )}{" "}
        {transfer.signatures.length > 0 &&
          t(
            "The signatures are removed: both sides sign the edited transfer again.",
          )}{" "}
        {transfer.qbmEntry &&
          t(
            "It was entered in QBM, so the QBM program will see it as edited and enter it again.",
          )}
      </p>
      <DatePicker label={t("Transfer date")} value={date} onChange={setDate} />
      <div className="mt-4 flex flex-col gap-2">
        {lines.map((l, i) => {
          const options = [
            ...new Set([...(units[l.code] ?? []), ...(l.unit ? [l.unit] : [])]),
          ];
          return (
            <div
              key={l.key}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-3"
            >
              <div className="min-w-0">
                <span className="font-semibold" dir="ltr">
                  {l.code}
                </span>
                {l.original === undefined && (
                  <span className="ms-2 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">
                    {t("New")}
                  </span>
                )}
                {renamable(l.code) ? (
                  <input
                    className={cx(inputStyles, "mt-1")}
                    aria-label={`${t("Product description")} ${i + 1}`}
                    dir="auto"
                    value={l.description}
                    maxLength={2000}
                    onChange={(e) =>
                      update(l.key, { description: e.target.value })
                    }
                  />
                ) : (
                  <small
                    className="block truncate text-xs text-subtle"
                    dir="auto"
                  >
                    {l.description}
                  </small>
                )}
              </div>
              <button
                type="button"
                className={cx(iconButton, "self-start")}
                aria-label={`${t("Remove item")} ${l.code}`}
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((all) => all.filter((x) => x.key !== l.key))
                }
              >
                <Trash2 size={17} />
              </button>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <input
                  className={cx(
                    inputStyles,
                    "tabular-nums",
                    l.quantity &&
                      !validQuantity(l.quantity) &&
                      "border-red-400",
                  )}
                  aria-label={`${t("Quantity")} ${i + 1}`}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder={t("Quantity")}
                  value={l.quantity}
                  onChange={(e) =>
                    update(l.key, {
                      quantity: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                />
                {options.length ? (
                  <Dropdown
                    aria-label={`${t("Unit")} ${i + 1}`}
                    value={l.unit}
                    onChange={(e) => update(l.key, { unit: e.target.value })}
                  >
                    {options.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                    <option value="">{t("No unit")}</option>
                  </Dropdown>
                ) : (
                  <span className="flex min-h-10 items-center justify-center rounded-lg bg-zinc-50 text-sm text-subtle">
                    {t("No defined unit")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className={inputStyles}
          aria-label={t("Add item by code")}
          placeholder={t("Add item by code")}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button disabled={finding || !code.trim()} onClick={add}>
          {finding ? <Search size={16} /> : <Plus size={16} />}
          {t("Add")}
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <Field label={t("Remarks")}>
          <textarea
            className={cx(inputStyles, "min-h-16 py-2")}
            dir="auto"
            value={remarks}
            maxLength={2000}
            rows={2}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </Field>
        <Field label={t("Reason for the edit (optional)")}>
          <textarea
            className={cx(inputStyles, "min-h-16 py-2")}
            dir="auto"
            value={reason}
            maxLength={500}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      {err && (
        <div className="mt-4">
          <Notice tone="error">{err}</Notice>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={busy} onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button variant="primary" disabled={busy || invalid} onClick={save}>
          <Pencil size={16} />
          {t(busy ? "Please wait…" : "Save changes")}
        </Button>
      </div>
    </Modal>
  );
}
