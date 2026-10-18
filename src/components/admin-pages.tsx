"use client";
import { Dropdown } from "@/components/dropdown";
import { Form } from "@/components/form";
import Link from "next/link";
import { menus } from "@/lib/permissions";
import { Skeleton } from "./skeleton";
import { useState, useEffect } from "react";
import { MapPin, Plus, Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/client";
import { PageTitle, useBuzz } from "./shell";
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
            <button
              className="button primary"
              onClick={() => {
                setEditing(null);
                setErr("");
                setAdd(true);
              }}
            >
              <Plus size={16} />
              {t("Add location")}
            </button>
          )
        }
      />
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton />}
      <div className="locations-grid">
        {data?.map((l) => (
          <article key={l.id} className="card location-card">
            <span className="location-pin">
              <MapPin size={23} />
            </span>
            <h2>{l.name}</h2>
            <span className={`badge ${l.active ? "approved" : "rejected"}`}>
              <span />
              {t(l.active ? "Active" : "Inactive")}
            </span>
            {user.role === "ADMIN" && (
              <div className="location-edit">
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(l);
                    setErr("");
                    setAdd(true);
                  }}
                >
                  {t("Edit")}
                </button>
                <button
                  className="text-button"
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
            <label>
              {t("Location name")}
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                maxLength={100}
              />
            </label>
            {err && (
              <div className="error" role="alert">
                {t(err)}
              </div>
            )}
            <button className="button primary">{t("Save")}</button>
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
};
const menuLabels: Record<string, string> = {
  dashboard: "Overview",
  "new-transfer": "New transfer",
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
          <button
            className="button primary"
            onClick={() => {
              setErr("");
              setModal("new");
            }}
          >
            <Plus size={16} />
            {t("Create user")}
          </button>
        }
      />
      <LoadError error={error || err} load={load} />
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      {!data && !error && <Skeleton />}
      <section className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Name",
                  "Role",
                  "Accessible locations",
                  "Menu permissions",
                  "Status",
                  "Actions",
                ].map((k) => (
                  <th key={k}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small className="block muted" dir="ltr">
                      {u.email}
                    </small>
                  </td>
                  <td>{t(u.role === "ADMIN" ? "Administrator" : "Staff")}</td>
                  <td>
                    {u.role === "ADMIN"
                      ? t("All locations")
                      : u.locations.map((l) => l.name).join(" · ")}
                  </td>
                  <td>
                    {u.role === "ADMIN"
                      ? t("All menus")
                      : u.menus.map((m) => t(menuLabels[m])).join(" · ")}
                  </td>
                  <td>
                    <span
                      className={`badge ${u.active ? "approved" : "rejected"}`}
                    >
                      {t(u.active ? "Active" : "Inactive")}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          setErr("");
                          setModal(u);
                        }}
                      >
                        {t("Edit")}
                      </button>
                      <Link
                        className="text-button"
                        href={`/transfers?creator=${encodeURIComponent(u.id)}`}
                      >
                        {t("User transfers")}
                      </Link>
                      <button
                        className="text-button"
                        onClick={() => setRotate(u)}
                      >
                        {t("Manage access code")}
                      </button>
                      <button
                        className="text-button"
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
      </section>
      {modal && (
        <Modal
          title={modal === "new" ? "Create user" : "Edit user"}
          onClose={() => setModal(null)}
        >
          <Form
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
            <label>
              {t("Name")}
              <input
                name="name"
                defaultValue={modal === "new" ? "" : modal.name}
                required
                maxLength={100}
              />
            </label>
            {modal === "new" && (
              <>
                <label>
                  {t("Email")}
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  {t("Role")}
                  <Dropdown name="role" defaultValue="STAFF">
                    <option value="STAFF">{t("Staff")}</option>
                    <option value="ADMIN">{t("Administrator")}</option>
                  </Dropdown>
                </label>
                <label>
                  {t("Access code")}
                  <input
                    name="accessCode"
                    required
                    minLength={8}
                    maxLength={32}
                    pattern="[A-Za-z0-9_-]{8,32}"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                  />
                </label>
                <p className="notice">
                  {t(
                    "Choose 8–32 English letters or digits. Codes ignore letter case and stay valid until changed or revoked.",
                  )}
                </p>
              </>
            )}
            <fieldset>
              <legend>{t("Accessible locations")}</legend>
              {locations.data?.map((l) => (
                <label className="checkbox-label" key={l.id}>
                  <input
                    type="checkbox"
                    name="locations"
                    value={l.id}
                    defaultChecked={
                      modal !== "new" &&
                      modal.locations.some((x) => x.id === l.id)
                    }
                  />
                  {l.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>{t("Menu permissions")}</legend>
              {menus.map((m) => (
                <label className="checkbox-label" key={m}>
                  <input
                    type="checkbox"
                    name="menus"
                    value={m}
                    defaultChecked={modal === "new" || modal.menus.includes(m)}
                  />
                  {t(menuLabels[m])}
                </label>
              ))}
            </fieldset>
            {err && (
              <div className="error" role="alert">
                {t(err)}
              </div>
            )}
            <button className="button primary" disabled={busy}>
              <UsersIcon size={16} />
              {t("Save")}
            </button>
          </Form>
        </Modal>
      )}
      {rotate && (
        <Modal title="Manage access code" onClose={() => setRotate(null)}>
          <p>{rotate.name}</p>
          <p>
            {t(
              "Replacing or revoking the code signs out all existing sessions.",
            )}
          </p>
          <Form
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
            <label>
              {t("New access code")}
              <input
                name="accessCode"
                required
                minLength={8}
                maxLength={32}
                pattern="[A-Za-z0-9_-]{8,32}"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
              />
            </label>
            <p className="notice">
              {t(
                "Choose 8–32 English letters or digits. Codes ignore letter case and stay valid until changed or revoked.",
              )}
            </p>
            {err && (
              <p className="error" role="alert">
                {t(err)}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {t("Save access code")}
            </button>
          </Form>
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={async () => {
              await update(rotate.id, { revokeCode: true });
              setRotate(null);
            }}
          >
            {t("Revoke code")}
          </button>
        </Modal>
      )}
    </>
  );
}
function vapidKey(base64: string) {
  const raw = atob(
    (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
// Turns transfer notifications on or off for the browser it is opened in.
function Notifications() {
  const { t } = useBuzz();
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [server, setServer] = useState<{
    publicKey: string;
    devices: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ publicKey: string; devices: number }>("push")
      .then(setServer)
      .catch((e) => setErr(e.message));
    if (!supported) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => r.pushManager.getSubscription())
      .then(setSubscription)
      .catch((e) => setErr(e.message));
  }, [supported]);
  async function run(task: () => Promise<string>) {
    setBusy(true);
    setErr("");
    setMessage("");
    try {
      setMessage(await task());
      setServer(await api("push"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card settings-card">
      <div className="card-heading">
        <h2>{t("Transfer notifications")}</h2>
      </div>
      <div className="settings-body">
        <p className="muted">
          {t(
            "Get a notification on this device whenever anyone confirms a transfer.",
          )}
        </p>
        {!supported ? (
          <p className="error">
            {t(
              "This browser cannot receive notifications. On iPhone, add the site to the Home Screen first and open it from there.",
            )}
          </p>
        ) : server && !server.publicKey ? (
          <p className="error">
            {t("Notifications are not configured on the server yet.")}
          </p>
        ) : (
          <div className="push-actions">
            {subscription ? (
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("push/test", {});
                      return "Test notification sent";
                    })
                  }
                >
                  {t("Send a test")}
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("push/unsubscribe", {
                        endpoint: subscription.endpoint,
                      });
                      await subscription.unsubscribe();
                      setSubscription(null);
                      return "Notifications turned off on this device";
                    })
                  }
                >
                  {t("Turn off on this device")}
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={busy || !server}
                onClick={() =>
                  run(async () => {
                    if ((await Notification.requestPermission()) !== "granted")
                      throw new Error(
                        "Notifications are blocked. Allow them in the browser settings.",
                      );
                    const registration = await navigator.serviceWorker.ready;
                    const sub = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: vapidKey(server!.publicKey),
                    });
                    await api("push/subscribe", sub.toJSON());
                    setSubscription(sub);
                    return "Notifications turned on for this device";
                  })
                }
              >
                {t("Turn on for this device")}
              </button>
            )}
          </div>
        )}
        {server && server.publicKey && (
          <p>
            {t("Devices receiving notifications")}:{" "}
            <strong>{server.devices}</strong>
          </p>
        )}
        {message && <p className="notice">{t(message)}</p>}
        {err && (
          <p className="error" role="alert">
            {t(err)}
          </p>
        )}
      </div>
    </section>
  );
}
export function SettingsPage() {
  const { t } = useBuzz();
  const { data, error, load } = useLoad<{ value: number }>("settings");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <PageTitle eyebrow="Administration" title="Settings" />
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton rows={3} />}
      <Notifications />
      <section className="card settings-card">
        <div className="card-heading">
          <h2>{t("Numbering sequence")}</h2>
        </div>
        {data && (
          <Form
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
            <p className="muted">
              {t(
                "Numbers are the first letters of the source and destination and one shared counter, e.g. MA-0001.",
              )}
            </p>
            <p>
              {t("Last reserved number")}: <strong>{data.value}</strong>
            </p>
            <label>
              {t("Next transfer number")}
              <input
                type="number"
                name="nextValue"
                min={1}
                max={2147483647}
                defaultValue={data.value + 1}
                required
                dir="ltr"
              />
            </label>
            <button className="button primary">{t("Save changes")}</button>
            {message && <p className="notice">{t(message)}</p>}
          </Form>
        )}
      </section>
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
  "NOTIFICATIONS_ON",
  "NOTIFICATIONS_OFF",
  "TRANSFER_CONFIRMED",
  "TRANSFER_DELETED",
  "DRAFT_DELETED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "CATALOG_IMPORTED",
  "CONFLICT_RESOLVED",
  "USER_CREATED",
  "USER_UPDATED",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "SETTINGS_UPDATED",
];
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
    case "DRAFT_DELETED":
      return s("number");
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
    case "SETTINGS_UPDATED":
      return (
        s("nextValue") && `${t("Next transfer number")}: ${s("nextValue")}`
      );
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
      <section className="card">
        <div className="filter-bar">
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
                {t(a)}
              </option>
            ))}
          </Dropdown>
          <span className="muted">
            {data?.count.toLocaleString() ?? "—"} {t("entries")}
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {["Date", "User", "Action", "Details"].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((a) => (
                <tr
                  key={a.id}
                  className={
                    a.action === "LOGIN_FAILED" || a.action === "LOGIN_BLOCKED"
                      ? "audit-warning"
                      : undefined
                  }
                >
                  <td dir="ltr">
                    {new Date(a.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dubai",
                    })}
                  </td>
                  <td>
                    {a.actorName ??
                      (a.actor === "unknown" ? t("Unknown person") : a.actor)}
                  </td>
                  <td>{t(a.action)}</td>
                  <td dir="auto">
                    {describe(a, t) || "—"}
                    <details>
                      <summary className="muted small">{t("More")}</summary>
                      <pre>{JSON.stringify(a.detail, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
              {data && !data.items.length && (
                <tr>
                  <td colSpan={4}>
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
      </section>
    </>
  );
}
