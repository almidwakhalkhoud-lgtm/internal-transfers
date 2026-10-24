"use client";
import { dateLocale } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import { Form } from "@/components/form";
import Link from "next/link";
import { menus } from "@/lib/permissions";
import { Skeleton } from "./skeleton";
import { Fragment, useState } from "react";
import { MapPin, Plus, Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/client";
import { PageTitle, useBuzz } from "./shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CellLabel,
  Field,
  Notice,
  checkbox,
  cx,
  inputStyles,
  linkButton,
  table,
} from "./ui";
const fieldset = "m-0 flex flex-col gap-1 rounded-xl border border-line p-3";
const legend = "px-1 text-sm font-medium text-muted";
const locationBox =
  "m-0 flex size-11 w-16 cursor-pointer items-center justify-center rounded-lg hover:bg-zinc-50 md:size-9 md:w-16";
const checkRow =
  "m-0 flex min-h-11 cursor-pointer flex-row items-center gap-3 rounded-lg px-2 text-sm font-normal text-ink hover:bg-zinc-50 md:min-h-9";
import { useLoad, LoadError, Empty, Pagination } from "./data-pages";
import { Modal } from "./transfer-form";
export function LocationsPage() {
  const { t, user } = useBuzz();
  const { data, error, load } =
    useLoad<{ id: string; name: string; active: boolean }[]>("locations");
  const [add, setAdd] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [err, setErr] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="Workspace"
        title="Locations"
        action={
          user.role === "ADMIN" && (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setErr("");
                setAdd(true);
              }}
            >
              <Plus size={16} />
              {t("Add location")}
            </Button>
          )
        }
      />
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {data?.map((l) => (
          <article
            key={l.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 md:flex-col md:items-start md:gap-4 md:p-6"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand md:size-12">
              <MapPin size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 truncate text-base font-semibold md:text-lg">
                {l.name}
              </h2>
              <div className="mt-1.5">
                <Badge tone={l.active ? "ok" : "bad"}>
                  {t(l.active ? "Active" : "Inactive")}
                </Badge>
              </div>
            </div>
            {user.role === "ADMIN" && (
              <div className="flex shrink-0 flex-col items-end md:flex-row md:items-center md:gap-4">
                <button
                  type="button"
                  className={linkButton}
                  onClick={() => {
                    setEditing(l);
                    setErr("");
                    setAdd(true);
                  }}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  className={linkButton}
                  onClick={async () => {
                    try {
                      await api(
                        `locations/${l.id}`,
                        { active: !l.active },
                        "PATCH",
                      );
                      load();
                    } catch (e) {
                      setErr((e as Error).message);
                    }
                  }}
                >
                  {t(l.active ? "Deactivate" : "Activate")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {data && !data.length && <Empty title="No locations configured" />}
      {add && (
        <Modal
          title={editing ? "Edit location" : "Add location"}
          onClose={() => setAdd(false)}
        >
          <Form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api(
                  editing ? `locations/${editing.id}` : "locations",
                  { name: f.get("name") },
                  editing ? "PATCH" : "POST",
                );
                setAdd(false);
                load();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            <Field label={t("Location name")}>
              <input
                className={inputStyles}
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                maxLength={100}
              />
            </Field>
            {err && <Notice tone="error">{t(err)}</Notice>}
            <Button type="submit" variant="primary">
              {t("Save")}
            </Button>
          </Form>
        </Modal>
      )}
    </>
  );
}
type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  menus: string[];
  locations: { id: string; name: string }[];
  viewLocations: { id: string; name: string }[];
  signBothSides: boolean;
};
const menuLabels: Record<string, string> = {
  dashboard: "Overview",
  "new-transfer": "New transfer",
  requests: "Requests",
  transfers: "Transfer history",
  products: "Products",
  locations: "Locations",
};
export function UsersPage() {
  const { t, user } = useBuzz();
  const { data, error, load } = useLoad<UserRecord[]>("users");
  const locations = useLoad<{ id: string; name: string }[]>("locations");
  const [modal, setModal] = useState<UserRecord | "new" | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [rotate, setRotate] = useState<UserRecord | null>(null);
  const [busy, setBusy] = useState(false);
  async function update(id: string, data: object) {
    try {
      await api(`users/${id}`, data, "PATCH");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Administration"
        title="Users"
        action={
          <Button
            variant="primary"
            onClick={() => {
              setErr("");
              setModal("new");
            }}
          >
            <Plus size={16} />
            {t("Create user")}
          </Button>
        }
      />
      <LoadError error={error || err} load={load} />
      {notice && (
        <div className="mb-4">
          <Notice>{t(notice)}</Notice>
        </div>
      )}
      {!data && !error && <Skeleton />}
      <Card>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                {[
                  "Name",
                  "Role",
                  "Accessible locations",
                  "Menu permissions",
                  "Status",
                  "Actions",
                ].map((k) => (
                  <th key={k} className={table.th}>
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={table.body}>
              {data?.map((u) => (
                <tr key={u.id} className={table.row}>
                  <td className={cx(table.td, "flex items-start gap-3")}>
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand md:hidden">
                      {u.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block font-semibold text-ink">
                        {u.name}
                      </strong>
                      <small
                        className="block truncate text-xs text-subtle"
                        dir="ltr"
                      >
                        {u.email}
                      </small>
                    </div>
                    <span className="md:hidden">
                      <Badge tone={u.active ? "ok" : "bad"}>
                        {t(u.active ? "Active" : "Inactive")}
                      </Badge>
                    </span>
                  </td>
                  <td className={table.td}>
                    <CellLabel>{t("Role")}</CellLabel>
                    {t(u.role === "ADMIN" ? "Administrator" : "Staff")}
                  </td>
                  <td className={table.td}>
                    <CellLabel>{t("Accessible locations")}</CellLabel>
                    {u.role === "ADMIN" ? (
                      t("All locations")
                    ) : (
                      <>
                        {u.locations.map((l) => l.name).join(" · ")}
                        {u.viewLocations.length > 0 && (
                          <small className="block text-xs text-subtle">
                            {t("View only")}:{" "}
                            {u.viewLocations.map((l) => l.name).join(" · ")}
                          </small>
                        )}
                        {u.signBothSides && (
                          <small className="block text-xs text-subtle">
                            {t("Can sign both sides")}
                          </small>
                        )}
                      </>
                    )}
                  </td>
                  <td className={table.td}>
                    <CellLabel>{t("Menu permissions")}</CellLabel>
                    {u.role === "ADMIN"
                      ? t("All menus")
                      : u.menus.map((m) => t(menuLabels[m])).join(" · ")}
                  </td>
                  <td className={cx(table.td, "hidden md:table-cell")}>
                    <Badge tone={u.active ? "ok" : "bad"}>
                      {t(u.active ? "Active" : "Inactive")}
                    </Badge>
                  </td>
                  <td className={table.td}>
                    <div className="-mx-1 flex flex-wrap gap-x-3 md:flex-nowrap">
                      <button
                        type="button"
                        className={linkButton}
                        onClick={() => {
                          setErr("");
                          setModal(u);
                        }}
                      >
                        {t("Edit")}
                      </button>
                      <Link
                        className={linkButton}
                        href={`/transfers?creator=${encodeURIComponent(u.id)}`}
                      >
                        {t("User transfers")}
                      </Link>
                      <button
                        type="button"
                        className={linkButton}
                        onClick={() => setRotate(u)}
                      >
                        {t("Manage access code")}
                      </button>
                      <button
                        type="button"
                        className={linkButton}
                        disabled={u.id === user.id}
                        onClick={() => update(u.id, { active: !u.active })}
                      >
                        {t(u.active ? "Deactivate" : "Activate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && (
        <Modal
          title={modal === "new" ? "Create user" : "Edit user"}
          onClose={() => setModal(null)}
        >
          <Form
            className="flex flex-col gap-4"
            key={modal === "new" ? "new" : modal.id}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr("");
              const f = new FormData(e.currentTarget);
              const values = {
                name: f.get("name"),
                email: f.get("email"),
                accessCode: f.get("accessCode"),
                role: f.get("role"),
                locationIds: f.getAll("locations"),
                viewLocationIds: f.getAll("viewLocations"),
                signBothSides: f.get("signBothSides") === "on",
                menus: f.getAll("menus"),
              };
              try {
                if (modal === "new") {
                  await api("users", values);
                  setNotice(
                    "User saved. The access code stays valid until you change or revoke it.",
                  );
                } else
                  await api(
                    `users/${modal.id}`,
                    {
                      name: values.name,
                      locationIds: values.locationIds,
                      viewLocationIds: values.viewLocationIds,
                      signBothSides: values.signBothSides,
                      menus: values.menus,
                    },
                    "PATCH",
                  );
                setModal(null);
                load();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={t("Name")}>
              <input
                className={inputStyles}
                name="name"
                defaultValue={modal === "new" ? "" : modal.name}
                required
                maxLength={100}
              />
            </Field>
            {modal === "new" && (
              <>
                <Field label={t("Email")}>
                  <input
                    className={inputStyles}
                    dir="ltr"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("Role")}>
                  <Dropdown name="role" defaultValue="STAFF">
                    <option value="STAFF">{t("Staff")}</option>
                    <option value="ADMIN">{t("Administrator")}</option>
                  </Dropdown>
                </Field>
                <Field label={t("Access code")}>
                  <input
                    className={inputStyles}
                    name="accessCode"
                    required
                    minLength={8}
                    maxLength={32}
                    pattern="[A-Za-z0-9_-]{8,32}"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                  />
                </Field>
                <p className="m-0 text-xs leading-relaxed text-subtle">
                  {t(
                    "Choose 8–32 English letters or digits. Codes ignore letter case and stay valid until changed or revoked.",
                  )}
                </p>
              </>
            )}
            {/* Work locations send, sign and see; view-only ones just see. */}
            <fieldset className={fieldset}>
              <legend className={legend}>{t("Accessible locations")}</legend>
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 text-sm">
                <span className="px-2 text-xs text-subtle">
                  {t("Location")}
                </span>
                <span className="w-16 text-center text-xs text-subtle">
                  {t("Works here")}
                </span>
                <span className="w-16 text-center text-xs text-subtle">
                  {t("View only")}
                </span>
                {locations.data?.map((l) => (
                  <Fragment key={l.id}>
                    <span className="px-2">{l.name}</span>
                    <label className={locationBox}>
                      <input
                        className={checkbox}
                        type="checkbox"
                        name="locations"
                        value={l.id}
                        aria-label={l.name}
                        defaultChecked={
                          modal !== "new" &&
                          modal.locations.some((x) => x.id === l.id)
                        }
                      />
                    </label>
                    <label className={locationBox}>
                      <input
                        className={checkbox}
                        type="checkbox"
                        name="viewLocations"
                        value={l.id}
                        aria-label={`${t("View only")} · ${l.name}`}
                        defaultChecked={
                          modal !== "new" &&
                          modal.viewLocations.some((x) => x.id === l.id)
                        }
                      />
                    </label>
                  </Fragment>
                ))}
              </div>
              <p className="m-0 px-2 pt-1 text-xs leading-relaxed text-subtle">
                {t(
                  "View only shows that location's transfers. It does not let the user send from it or sign for it.",
                )}
              </p>
            </fieldset>
            <label className={cx(checkRow, "rounded-xl border border-line")}>
              <input
                className={checkbox}
                type="checkbox"
                name="signBothSides"
                defaultChecked={modal !== "new" && modal.signBothSides}
              />
              <span>
                {t("Can sign both sides")}
                <small className="block text-xs text-subtle">
                  {t(
                    "Exception: may sign as both sender and receiver of the same transfer.",
                  )}
                </small>
              </span>
            </label>
            <fieldset className={fieldset}>
              <legend className={legend}>{t("Menu permissions")}</legend>
              {menus.map((m) => (
                <label className={checkRow} key={m}>
                  <input
                    className={checkbox}
                    type="checkbox"
                    name="menus"
                    value={m}
                    defaultChecked={modal === "new" || modal.menus.includes(m)}
                  />
                  {t(menuLabels[m])}
                </label>
              ))}
            </fieldset>
            {err && <Notice tone="error">{t(err)}</Notice>}
            <Button type="submit" variant="primary" disabled={busy}>
              <UsersIcon size={16} />
              {t("Save")}
            </Button>
          </Form>
        </Modal>
      )}
      {rotate && (
        <Modal title="Manage access code" onClose={() => setRotate(null)}>
          <p className="m-0 font-semibold">{rotate.name}</p>
          <p className="mt-1 mb-4 text-sm leading-relaxed text-muted">
            {t(
              "Replacing or revoking the code signs out all existing sessions.",
            )}
          </p>
          <Form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setErr("");
              const form = new FormData(event.currentTarget);
              try {
                await api(
                  `users/${rotate.id}`,
                  { accessCode: form.get("accessCode") },
                  "PATCH",
                );
                setNotice(
                  "Access code saved. It stays valid until changed or revoked.",
                );
                setRotate(null);
                load();
              } catch (error) {
                setErr((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={t("New access code")}>
              <input
                className={inputStyles}
                name="accessCode"
                required
                minLength={8}
                maxLength={32}
                pattern="[A-Za-z0-9_-]{8,32}"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
              />
            </Field>
            <p className="m-0 text-xs leading-relaxed text-subtle">
              {t(
                "Choose 8–32 English letters or digits. Codes ignore letter case and stay valid until changed or revoked.",
              )}
            </p>
            {err && <Notice tone="error">{t(err)}</Notice>}
            <Button type="submit" variant="primary" disabled={busy}>
              {t("Save access code")}
            </Button>
          </Form>
          <Button
            variant="danger"
            className="mt-3 w-full"
            disabled={busy}
            onClick={async () => {
              await update(rotate.id, { revokeCode: true });
              setRotate(null);
            }}
          >
            {t("Revoke code")}
          </Button>
        </Modal>
      )}
    </>
  );
}
type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  canApprove: boolean;
  _count: { qbmEntries: number };
};
// Keys for programs such as the QBM entry app. A new key is shown once.
function ApiKeys() {
  const { t, locale } = useBuzz();
  const { data, error, load } = useLoad<ApiKeyRecord[]>("api-keys");
  const [name, setName] = useState("QBM sync");
  const [canApprove, setCanApprove] = useState(false);
  const [created, setCreated] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const when = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(dateLocale(locale), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Dubai",
        })
      : t("Never");
  return (
    <Card className="max-w-2xl">
      <CardHeader title={t("API keys")} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <p className="m-0 text-sm leading-relaxed text-muted">
          {t(
            "Programs such as the QBM entry app use a key to read confirmed transfers and their items, and to mark them as entered in QBM. A key cannot change or delete anything else.",
          )}{" "}
          {t(
            "A key allowed to approve may also approve a pending transfer after it has been entered in QBM.",
          )}
        </p>
        <LoadError error={error} load={load} />
        {data?.map((k) => (
          <div
            key={k.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="truncate text-sm">{k.name}</strong>
                <Badge tone={k.revokedAt ? "bad" : "ok"}>
                  {t(k.revokedAt ? "Revoked" : "Active")}
                </Badge>
                {k.canApprove && !k.revokedAt && (
                  <Badge tone="warn">{t("Can approve")}</Badge>
                )}
              </div>
              <div className="mt-1 text-xs text-subtle" dir="ltr">
                {k.prefix}…
              </div>
              <div className="mt-1 text-xs text-subtle">
                {t("Last used")}: {when(k.lastUsedAt)} ·{" "}
                {t("Transfers entered")}: {k._count.qbmEntries}
              </div>
            </div>
            {!k.revokedAt && (
              <button
                type="button"
                className={linkButton}
                onClick={async () => {
                  try {
                    await api(
                      `api-keys/${k.id}`,
                      { canApprove: !k.canApprove },
                      "PATCH",
                    );
                    load();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                {t(k.canApprove ? "Stop approving" : "Allow approving")}
              </button>
            )}
            {!k.revokedAt && (
              <button
                type="button"
                className={cx(linkButton, "text-red-700")}
                onClick={async () => {
                  if (
                    !confirm(
                      t("Revoke this key? Programs using it stop working."),
                    )
                  )
                    return;
                  try {
                    await api(`api-keys/${k.id}/revoke`, {});
                    load();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                {t("Revoke")}
              </button>
            )}
          </div>
        ))}
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr("");
            try {
              const result = await api<{ key: string }>("api-keys", {
                name,
                canApprove,
              });
              setCreated(result.key);
              setCopied(false);
              load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Key name")} className="flex-1">
            <input
              className={inputStyles}
              value={name}
              maxLength={60}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <label className={cx(checkRow, "shrink-0 whitespace-nowrap")}>
            <input
              type="checkbox"
              className={checkbox}
              checked={canApprove}
              onChange={(e) => setCanApprove(e.target.checked)}
            />
            {t("Can approve")}
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            <Plus size={16} />
            {t("Create key")}
          </Button>
        </form>
        {err && <Notice tone="error">{t(err)}</Notice>}
      </div>
      {created && (
        <Modal title="New API key" onClose={() => setCreated("")}>
          <p className="mt-0 mb-3 text-sm leading-relaxed text-muted">
            {t(
              "Copy the key now and paste it into the program. It is not shown again; if it is lost, revoke it and create a new one.",
            )}
          </p>
          <code
            className="block rounded-xl bg-brand-soft p-3 font-mono text-sm break-all select-all"
            dir="ltr"
          >
            {created}
          </code>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(created);
                setCopied(true);
              }}
            >
              {t(copied ? "Copied" : "Copy key")}
            </Button>
            <Button onClick={() => setCreated("")}>{t("Done")}</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
export function AdminSettingsPage() {
  const { t } = useBuzz();
  const { data, error, load } = useLoad<{ value: number; request: number }>(
    "settings",
  );
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton rows={3} />}
      <div className="flex flex-col gap-4 md:gap-5">
        <ApiKeys />
        <Card className="max-w-2xl">
          <CardHeader title={t("Numbering sequence")} />
          {data && (
            <Form
              className="flex flex-col gap-4 p-4 md:p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(
                    "settings",
                    {
                      nextValue: Number(
                        new FormData(e.currentTarget).get("nextValue"),
                      ),
                    },
                    "PATCH",
                  );
                  setMessage("Changes saved");
                  load();
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              <p className="m-0 text-sm leading-relaxed text-muted">
                {t(
                  "Numbers are the first letters of the source and destination and one shared counter, e.g. MA-0001.",
                )}
              </p>
              <p className="m-0 text-sm text-muted">
                {t("Last transfer number")}:{" "}
                <strong className="text-ink">{data.value}</strong>
              </p>
              <Field label={t("Next transfer number")} className="sm:max-w-xs">
                <input
                  className={inputStyles}
                  type="number"
                  name="nextValue"
                  min={1}
                  max={2147483647}
                  defaultValue={data.value + 1}
                  required
                  dir="ltr"
                />
              </Field>
              <Button type="submit" variant="primary" className="sm:self-start">
                {t("Save changes")}
              </Button>
              {message && <Notice>{t(message)}</Notice>}
            </Form>
          )}
        </Card>
        <Card className="max-w-2xl">
          <CardHeader title={t("Request numbering")} />
          {data && (
            <Form
              className="flex flex-col gap-4 p-4 md:p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(
                    "settings",
                    {
                      nextRequest: Number(
                        new FormData(e.currentTarget).get("nextRequest"),
                      ),
                    },
                    "PATCH",
                  );
                  setRequestMessage("Changes saved");
                  load();
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              <p className="m-0 text-sm leading-relaxed text-muted">
                {t(
                  "Requests have their own counter, e.g. REQ-0001. The transfer made from a request is numbered like every transfer: the first letters of its source and destination and the transfer counter, e.g. NM-0012.",
                )}
              </p>
              <p className="m-0 text-sm text-muted">
                {t("Last reserved number")}:{" "}
                <strong className="text-ink">{data.request}</strong>
              </p>
              <Field label={t("Next request number")} className="sm:max-w-xs">
                <input
                  className={inputStyles}
                  type="number"
                  name="nextRequest"
                  min={1}
                  max={2147483647}
                  defaultValue={data.request + 1}
                  required
                  dir="ltr"
                />
              </Field>
              <Button type="submit" variant="primary" className="sm:self-start">
                {t("Save changes")}
              </Button>
              {requestMessage && <Notice>{t(requestMessage)}</Notice>}
            </Form>
          )}
        </Card>
      </div>
    </>
  );
}
type AuditEntry = {
  id: string;
  actor: string;
  actorName: string | null;
  action: string;
  target: string;
  targetName: string | null;
  createdAt: string;
  detail: Record<string, unknown> | null;
};
const auditActions = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGIN_BLOCKED",
  "LOGOUT",
  "NOTIFICATION_SETTINGS_UPDATED",
  "NOTIFICATIONS_ON",
  "NOTIFICATIONS_OFF",
  "QBM_ENTERED",
  "QBM_ENTRY_REMOVED",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "API_KEY_UPDATED",
  "TRANSFER_CONFIRMED",
  "TRANSFER_DELETED",
  "TRANSFER_SIGNED",
  "TRANSFER_RENUMBERED",
  "DRAFT_DELETED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "CATALOG_IMPORTED",
  "CONFLICT_RESOLVED",
  "CONFLICTS_CLEANED",
  "USER_CREATED",
  "USER_UPDATED",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "SETTINGS_UPDATED",
  "REQUEST_CREATED",
  "REQUEST_FULFILLED",
  "REQUEST_CANCELLED",
  "REQUEST_DECLINED",
  "REQUEST_DELETED",
];
// English names for the stored action codes; Persian ones live in i18n.
const actionNames: Record<string, string> = {
  LOGIN: "Signed in",
  LOGIN_FAILED: "Sign-in failed",
  LOGIN_BLOCKED: "Sign-in blocked",
  LOGOUT: "Signed out",
  NOTIFICATION_SETTINGS_UPDATED: "Reminder settings changed",
  NOTIFICATIONS_ON: "Notifications on",
  NOTIFICATIONS_OFF: "Notifications off",
  QBM_ENTERED: "Entered in QBM",
  QBM_ENTRY_REMOVED: "QBM entry removed",
  API_KEY_CREATED: "API key created",
  API_KEY_REVOKED: "API key revoked",
  API_KEY_UPDATED: "API key changed",
  REQUEST_CREATED: "Request sent",
  REQUEST_FULFILLED: "Request filled",
  REQUEST_CANCELLED: "Request cancelled",
  REQUEST_DECLINED: "Request declined",
  REQUEST_DELETED: "Request deleted",
  TRANSFER_CONFIRMED: "Transfer confirmed",
  TRANSFER_DELETED: "Transfer deleted",
  TRANSFER_SIGNED: "Transfer signed",
  TRANSFER_RENUMBERED: "Transfer number changed",
  DRAFT_DELETED: "Draft deleted",
  APPROVED: "Transfer approved",
  REJECTED: "Transfer rejected",
  RECEIVED: "Transfer received",
  PRODUCT_CREATED: "Product added",
  PRODUCT_UPDATED: "Product edited",
  CATALOG_IMPORTED: "Catalog imported",
  CONFLICT_RESOLVED: "Conflict reviewed",
  CONFLICTS_CLEANED: "Conflicts cleaned up",
  USER_CREATED: "User added",
  USER_UPDATED: "User edited",
  LOCATION_CREATED: "Location added",
  LOCATION_UPDATED: "Location edited",
  SETTINGS_UPDATED: "Settings changed",
  ADMIN_PROVISIONED: "Administrator created",
  SOURCES_RECONCILED: "Sources reconciled",
  CONFLICTING_UNITS_HELD_FOR_REVIEW: "Units held for review",
  BOOTSTRAP_ACCOUNT_PRESERVED: "First account kept",
};
function actionName(action: string, t: (key: string) => string) {
  const translated = t(action);
  if (translated !== action) return translated;
  return (
    actionNames[action] ??
    action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ")
  );
}
// One readable line per entry, built from what the entry recorded.
function describe(a: AuditEntry, t: (key: string) => string) {
  const d = a.detail ?? {};
  const s = (key: string) =>
    d[key] === undefined || d[key] === null || d[key] === ""
      ? ""
      : String(d[key]);
  const where = [s("device"), s("place"), s("ip") && `IP ${s("ip")}`]
    .filter(Boolean)
    .join(" · ");
  const list = (value: unknown) =>
    Array.isArray(value) && value.length ? value.join(", ") : "—";
  switch (a.action) {
    case "LOGIN":
    case "LOGOUT":
    case "LOGIN_BLOCKED":
    case "NOTIFICATIONS_ON":
    case "NOTIFICATIONS_OFF":
      return [s("method") && t(s("method")), where].filter(Boolean).join(" · ");
    case "LOGIN_FAILED":
      return [t(s("reason")), s("method") && t(s("method")), where]
        .filter(Boolean)
        .join(" · ");
    case "TRANSFER_CONFIRMED":
    case "TRANSFER_DELETED":
      return [
        s("number") || a.targetName,
        (s("from") || s("source")) &&
          `${s("from") || s("source")} → ${s("to") || s("destination")}`,
        s("lines") && `${s("lines")} ${t("items")}`,
        s("total") && `${t("Total quantity")} ${s("total")}`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "TRANSFER_SIGNED":
      return [
        s("number") || a.targetName,
        s("side") && t(s("side") === "SOURCE" ? "Sender" : "Receiver"),
        s("from") && `${s("from")} → ${s("to")}`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "TRANSFER_RENUMBERED":
      return `${s("from")} → ${s("to")}`;
    case "DRAFT_DELETED":
      return s("number") || (s("lines") && `${s("lines")} ${t("items")}`);
    case "PRODUCT_CREATED":
      return [s("code"), s("description"), `${t("Units")}: ${list(d.units)}`]
        .filter(Boolean)
        .join(" · ");
    case "PRODUCT_UPDATED": {
      const before = (d.before ?? {}) as Record<string, unknown>;
      const after = (d.after ?? {}) as Record<string, unknown>;
      const changes = [
        before.description !== after.description &&
          `${t("Product description")}: ${String(before.description ?? "—")} → ${String(after.description ?? "—")}`,
        list(before.units) !== list(after.units) &&
          `${t("Units")}: ${list(before.units)} → ${list(after.units)}`,
      ].filter(Boolean);
      return [String(before.code ?? a.targetName ?? ""), ...changes]
        .filter(Boolean)
        .join(" · ");
    }
    case "USER_UPDATED":
      return [
        a.targetName,
        d.passwordReset && t("Password reset"),
        d.codeRotated && t("Access code changed"),
        d.codeRevoked && t("Access code revoked"),
      ]
        .filter(Boolean)
        .join(" · ");
    case "CATALOG_IMPORTED":
      return `${t("Imported")}: ${s("imported")} · ${t("Conflicts")}: ${s("conflicts")}`;
    case "QBM_ENTERED":
    case "QBM_ENTRY_REMOVED":
      return [s("number"), s("reference") && `QBM ${s("reference")}`]
        .filter(Boolean)
        .join(" · ");
    case "API_KEY_CREATED":
    case "API_KEY_REVOKED":
      return s("name");
    case "NOTIFICATION_SETTINGS_UPDATED":
      return `${t("Reminder interval (minutes)")}: ${s("intervalMinutes")} · ${t("Reminders after the initial alert")}: ${d.maxReminders === null ? t("Until the shop acknowledges") : s("maxReminders")}`;
    case "SETTINGS_UPDATED":
      return s("nextRequest")
        ? `${t("Next request number")}: ${s("nextRequest")}`
        : s("nextValue") && `${t("Next transfer number")}: ${s("nextValue")}`;
    default:
      return a.targetName ?? "";
  }
}
export function AuditPage() {
  const { t } = useBuzz();
  const [page, setPage] = useState(0);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const { data, error, load } = useLoad<{
    items: AuditEntry[];
    count: number;
    users: { id: string; name: string }[];
  }>(
    `audit?page=${page}&actor=${encodeURIComponent(actor)}&action=${encodeURIComponent(action)}`,
  );
  return (
    <>
      <PageTitle eyebrow="Administration" title="Audit log" />
      <LoadError error={error} load={load} />
      <Card>
        <div className="grid grid-cols-1 gap-2 border-b border-line p-3 sm:grid-cols-2 md:flex md:items-center md:gap-3 md:p-4 [&>.dropdown]:md:max-w-64">
          <Dropdown
            aria-label={t("User")}
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("All users")}</option>
            {data?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Dropdown>
          <Dropdown
            aria-label={t("Action")}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("All events")}</option>
            {auditActions.map((a) => (
              <option key={a} value={a}>
                {actionName(a, t)}
              </option>
            ))}
          </Dropdown>
          <span className="text-sm text-subtle sm:col-span-2 md:ms-auto">
            {data?.count.toLocaleString() ?? "—"} {t("entries")}
          </span>
        </div>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                {["Date", "User", "Action", "Details"].map((h) => (
                  <th key={h} className={table.th}>
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={table.body}>
              {data?.items.map((a) => (
                <tr
                  key={a.id}
                  className={cx(
                    "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-line px-4 py-4 md:table-row md:p-0",
                    (a.action === "LOGIN_FAILED" ||
                      a.action === "LOGIN_BLOCKED") &&
                      "bg-red-50/60",
                  )}
                >
                  <td
                    className={cx(
                      table.td,
                      "col-start-2 row-start-1 text-end text-xs whitespace-nowrap text-subtle md:text-start md:text-sm md:text-ink",
                    )}
                    dir="ltr"
                  >
                    {new Date(a.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dubai",
                    })}
                  </td>
                  <td
                    className={cx(
                      table.td,
                      "col-span-2 text-subtle md:text-ink",
                    )}
                  >
                    {a.actorName ??
                      (a.actor === "unknown"
                        ? t("Unknown person")
                        : a.actor.startsWith("api:")
                          ? `API · ${a.actor.slice(4)}`
                          : a.actor.replace(/^system:/, ""))}
                  </td>
                  <td
                    className={cx(
                      table.td,
                      "col-start-1 row-start-1 md:whitespace-nowrap",
                    )}
                  >
                    <strong className="font-semibold text-ink">
                      {actionName(a.action, t)}
                    </strong>
                  </td>
                  <td
                    className={cx(
                      table.td,
                      "col-span-2 [overflow-wrap:anywhere]",
                    )}
                    dir="auto"
                  >
                    {describe(a, t) || "—"}
                    {a.detail && Object.keys(a.detail).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-subtle">
                          {t("More")}
                        </summary>
                        <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-wrap">
                          {JSON.stringify(a.detail, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {data && !data.items.length && (
                <tr className="block md:table-row">
                  <td colSpan={4} className="block md:table-cell">
                    <Empty title="No records" />
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
      </Card>
    </>
  );
}
