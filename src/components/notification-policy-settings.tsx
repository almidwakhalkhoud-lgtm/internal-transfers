"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import {
  reminderSummary,
  type NotificationPolicy,
} from "@/lib/notification-policy";
import { useBuzz } from "./shell";
import { inputStyles } from "./ui";

export function NotificationPolicySettings({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const { t, locale } = useBuzz();
  const [policy, setPolicy] = useState<NotificationPolicy>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = () =>
    api<NotificationPolicy>("notifications/settings")
      .then((loaded) => {
        setPolicy(loaded);
        setError("");
      })
      .catch(() => setError("Could not load reminder settings. Please retry."));
  useEffect(() => {
    void load();
  }, []);
  return (
    <details className="card notification-settings notification-help notification-policy-settings">
      <summary>{t("Reminder frequency and limit")}</summary>
      <p>
        {t(
          "Applies to all shops and devices. The initial alert is immediate; these settings control its reminders.",
        )}
      </p>
      {error && (
        <p className="error" role="alert">
          {t(error)} <button onClick={() => void load()}>{t("Retry")}</button>
        </p>
      )}
      {policy && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              const updated = await api<NotificationPolicy>(
                "notifications/settings",
                policy,
                "PATCH",
              );
              setPolicy(updated);
              setSaved(true);
              onSaved();
            } catch {
              setError("Could not save reminder settings. Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="notification-policy-fields">
            <label>
              {t("Reminder interval (minutes)")}
              <input
                className={inputStyles}
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                value={
                  Number.isFinite(policy.intervalMinutes)
                    ? policy.intervalMinutes
                    : ""
                }
                onChange={(e) => {
                  setSaved(false);
                  setPolicy({
                    ...policy,
                    intervalMinutes: e.target.valueAsNumber,
                  });
                }}
              />
            </label>
            <label>
              {t("Repeat reminders")}
              <select
                aria-label={t("Repeat reminders")}
                className={inputStyles}
                value={policy.maxReminders === null ? "unlimited" : "limited"}
                onChange={(e) => {
                  setSaved(false);
                  setPolicy({
                    ...policy,
                    maxReminders: e.target.value === "unlimited" ? null : 3,
                  });
                }}
              >
                <option value="unlimited">
                  {t("Until the shop acknowledges")}
                </option>
                <option value="limited">{t("A limited number")}</option>
              </select>
            </label>
            {policy.maxReminders !== null && (
              <label>
                {t("Reminders after the initial alert")}
                <input
                  className={inputStyles}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={
                    Number.isFinite(policy.maxReminders)
                      ? policy.maxReminders
                      : ""
                  }
                  onChange={(e) => {
                    setSaved(false);
                    setPolicy({
                      ...policy,
                      maxReminders: e.target.valueAsNumber,
                    });
                  }}
                />
              </label>
            )}
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-brand"
              checked={policy.requireDevice !== false}
              onChange={(e) => {
                setSaved(false);
                setPolicy({ ...policy, requireDevice: e.target.checked });
              }}
            />
            <span>
              {t("Require notifications on every device")}
              <small className="block text-xs text-muted">
                {t(
                  "Each signed-in device must turn notifications on before it can use the app.",
                )}
              </small>
            </span>
          </label>
          <p>
            {Number.isFinite(policy.intervalMinutes) &&
            (policy.maxReminders === null ||
              Number.isFinite(policy.maxReminders))
              ? reminderSummary(policy, locale)
              : t("Enter valid reminder settings.")}
          </p>
          <p className="text-sm text-muted">
            {t(
              "The limit counts successful sends per device. Failed sends retry without using the limit. Zero means the initial alert only. Inbox notifications stay saved until acknowledged or resolved.",
            )}
          </p>
          <p className="text-sm text-muted">
            {t(
              "Changes apply to existing pending transfers too. Scheduling runs every minute; a device may display an alert later when it reconnects.",
            )}
          </p>
          <button className="button primary" disabled={busy} type="submit">
            {t(busy ? "Saving…" : "Save reminder settings")}
          </button>
          {saved && (
            <p className="notification-success" role="status">
              {t("Reminder settings saved")}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
