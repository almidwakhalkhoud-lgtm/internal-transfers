"use client";
import { Dropdown } from "@/components/dropdown";
import { Form } from "@/components/form";
import Link from "next/link";
import { menus } from "@/lib/permissions";
import { Skeleton } from "./skeleton";
import { useState } from "react";
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
export function SettingsPage() {
  const { t } = useBuzz();
  const { data, error, load } = useLoad<{ prefix: string; value: number }>(
    "settings",
  );
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <PageTitle eyebrow="Administration" title="Settings" />
      <LoadError error={error || err} load={load} />
      {!data && !error && <Skeleton rows={3} />}
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
                    prefix: new FormData(e.currentTarget).get("prefix"),
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
            <label>
              {t("Transfer prefix")}
              <input
                name="prefix"
                defaultValue={data.prefix}
                pattern="[A-Z]{1,8}"
                maxLength={8}
                required
                dir="ltr"
              />
            </label>
            <p>
              {t("Last reserved number")}: <strong>{data.value}</strong>
            </p>
            <label>
              {t("Next transfer number")}
              <input
                type="number"
                name="nextValue"
                min={data.value + 1}
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
export function AuditPage() {
  const { t } = useBuzz();
  const [page, setPage] = useState(0);
  const { data, error, load } = useLoad<{
    items: {
      id: string;
      actor: string;
      action: string;
      target: string;
      createdAt: string;
      detail: unknown;
    }[];
    count: number;
  }>(`audit?page=${page}`);
  return (
    <>
      <PageTitle eyebrow="Administration" title="Audit log" />
      <LoadError error={error} load={load} />
      <section className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {["Date", "Actor", "Action", "Target"].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dubai",
                    })}
                  </td>
                  <td className="mono">{a.actor}</td>
                  <td>{t(a.action)}</td>
                  <td>
                    <details>
                      <summary className="mono">{a.target}</summary>
                      <pre>{JSON.stringify(a.detail, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
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
