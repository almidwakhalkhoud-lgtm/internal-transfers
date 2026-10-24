"use client";
import { dateLocale } from "@/lib/i18n";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, BellRing, CheckCheck, RefreshCw, Volume2 } from "lucide-react";
import { api } from "@/lib/client";
import {
  DEFAULT_NOTIFICATION_POLICY,
  reminderDue,
  reminderSummary,
  type NotificationPolicy,
} from "@/lib/notification-policy";
import { NotificationPolicySettings } from "./notification-policy-settings";
import { useBuzz } from "./shell";

import {
  supported as pushSupported,
  useDeviceNotifications,
} from "./use-device-notifications";

const notificationUrl = "/settings?tab=notifications";

type Notice = {
  id: string;
  transferId: string;
  title: string;
  body: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedName: string | null;
  closedAt: string | null;
  transfer: {
    number: string;
    source: string;
    destination: string;
    approval: string;
  };
};
type Inbox = {
  policy: NotificationPolicy;
  items: Notice[];
  count: number;
  pending: number;
  overdue: number;
  pushConfigured: boolean;
  workerHealthy: boolean;
  retryingDevices: number;
  coverage?: {
    destinationId: string;
    name: string;
    pending: number;
    recipients: number;
    devices: number;
  }[];
};
const NotificationContext = createContext<{
  inbox?: Inbox;
  error: string;
  refresh: () => void;
  sound: boolean;
  enableSound: () => void;
  device?: ReturnType<typeof useDeviceNotifications>;
}>({ error: "", refresh: () => {}, sound: false, enableSound: () => {} });

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, locale } = useBuzz();
  const device = useDeviceNotifications(user.id);
  const [inbox, setInbox] = useState<Inbox>();
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const soundDeliveries = useRef(
    new Map<string, { successes: number; lastSuccessAt: number | null }>(),
  );
  const busy = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 8000);
    try {
      const data = await api<Inbox>(
        "notifications?compact=1",
        undefined,
        "GET",
        abort.signal,
      );
      if (alive.current) {
        setInbox(data);
        setError("");
      }
    } catch {
      if (alive.current)
        setError(
          "Notification connection interrupted. Retrying automatically; pending alerts remain saved.",
        );
    } finally {
      clearTimeout(timeout);
      busy.current = false;
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) void refresh();
    });
    const timer = setInterval(() => void refresh(), 10_000);
    const wake = () => void refresh();
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    navigator.serviceWorker?.addEventListener("message", wake);
    return () => {
      alive.current = false;
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      navigator.serviceWorker?.removeEventListener("message", wake);
    };
  }, [refresh, user.id, locale]);
  useEffect(() => {
    const title = document.title;
    if (inbox?.pending)
      document.title = `(${inbox.pending}) BUZZ · ${locale === "fa" ? "ترانسفر ورودی" : "Incoming transfers"}`;
    return () => {
      document.title = title;
    };
  }, [inbox?.pending, locale]);
  useEffect(() => {
    if (!sound || !inbox?.pending) return;
    const ring = () => {
      if (
        document.visibilityState !== "visible" ||
        audio.current?.state !== "running"
      )
        return;
      const id = inbox.items[0]?.id;
      if (!id) return;
      const key = `buzz:sound-reminder:${user.id}:${id}`;
      let previous = soundDeliveries.current.get(key) ?? {
        successes: 0,
        lastSuccessAt: null,
      };
      try {
        const stored = JSON.parse(localStorage.getItem(key) || "null");
        if (
          stored &&
          Number.isInteger(stored.successes) &&
          stored.successes >= 0 &&
          Number.isFinite(stored.lastSuccessAt)
        )
          previous = stored;
      } catch {
        /* Storage is optional. */
      }
      const now = Date.now();
      if (
        !reminderDue(inbox.policy ?? DEFAULT_NOTIFICATION_POLICY, previous, now)
      )
        return;
      const context = audio.current;
      if (!context) return;
      for (const delay of [0, 0.22, 0.44]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.frequency.value = 880;
        const start = context.currentTime + delay;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
        oscillator.start(start);
        oscillator.stop(start + 0.18);
      }
      const updated = { successes: previous.successes + 1, lastSuccessAt: now };
      soundDeliveries.current.set(key, updated);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        /* Keep session memory as fallback. */
      }
    };
    ring();
    const timer = setInterval(ring, 10_000);
    return () => clearInterval(timer);
  }, [sound, inbox, user.id]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const enableSound = () => {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      void audio.current
        .resume()
        .then(() => setSound(true))
        .catch(() => setError("Sound could not be enabled. Please try again."));
    } catch {
      setError("Sound is not supported by this browser.");
    }
  };
  return (
    <NotificationContext.Provider
      value={{ inbox, error, refresh, sound, enableSound, device }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function NotificationBell() {
  const { t } = useBuzz();
  const { inbox, error } = useContext(NotificationContext);
  return (
    <Link
      href={notificationUrl}
      className={`notification-bell ${inbox?.pending ? "has-pending" : ""}`}
      aria-label={`${t("Notifications")}${inbox ? ` (${inbox.pending})` : ""}`}
    >
      <Bell size={20} />
      {(!!inbox?.pending || error) && (
        <span className="notification-count">
          {error ? "!" : inbox!.pending > 99 ? "99+" : inbox!.pending}
        </span>
      )}
    </Link>
  );
}

export function NotificationBanner() {
  const { t, user, locale } = useBuzz();
  const { inbox, error, refresh, device } = useContext(NotificationContext);
  const path = usePathname();
  const query = useSearchParams();
  const inNotificationSettings =
    path === "/settings" &&
    (user.role !== "ADMIN" || query.get("tab") === "notifications");
  return (
    <div className="notification-banners">
      {device?.ready && device.required && !device.enabled && (
        <RequireNotifications device={device} />
      )}
      {!inNotificationSettings &&
        device?.ready &&
        !device.required &&
        !device.enabled && (
          <div className="notification-activation">
            <Bell size={20} />
            <span>
              {t(
                "Enable alerts on this device so incoming transfers reach you when the app is closed.",
              )}
            </span>
            <button
              className="button primary"
              disabled={device.busy}
              onClick={() => void device.enable()}
            >
              {t(device.busy ? "Enabling…" : "Enable device notifications")}
            </button>
            {device.error && (
              <p className="error" role="alert">
                {t(device.error)}
              </p>
            )}
          </div>
        )}
      {error && (
        <div className="notification-connection" role="alert">
          <span>{t(error)}</span>
          <button className="button" onClick={refresh}>
            {t("Retry")}
          </button>
          <Link href="/login">{t("Sign in")}</Link>
        </div>
      )}
      {!!inbox?.pending && !inNotificationSettings && (
        <div className="incoming-banner" role="status" aria-live="polite">
          <BellRing size={22} />
          <div>
            <strong>
              {inbox.pending} {t("incoming transfers need acknowledgment")}
            </strong>
            <p>{inbox.items[0]?.title}</p>
            <small>
              {reminderSummary(
                inbox.policy ?? DEFAULT_NOTIFICATION_POLICY,
                locale,
              )}
            </small>
          </div>
          <Link
            className="button primary"
            href={`${notificationUrl}&notification=${encodeURIComponent(inbox.items[0]?.id ?? "")}`}
          >
            {t("Review notifications")}
          </Link>
        </div>
      )}
    </div>
  );
}

// Shown over the whole app until this device has notifications on. It cannot
// be closed: an administrator may skip it for the visit (to reach Settings).
function RequireNotifications({
  device,
}: {
  device: ReturnType<typeof useDeviceNotifications>;
}) {
  const { t, user, locale } = useBuzz();
  const [skipped, setSkipped] = useState(false);
  if (skipped) return null;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  const blocked =
    typeof Notification !== "undefined" && Notification.permission === "denied";
  const state = !pushSupported()
    ? apple && !installed
      ? "install"
      : "unsupported"
    : blocked
      ? "blocked"
      : "ask";
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-zinc-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="require-notifications-title"
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <div className="w-full rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <BellRing size={24} />
        </span>
        <h2
          id="require-notifications-title"
          className="m-0 text-lg font-semibold"
        >
          {t("Turn on notifications")}
        </h2>
        <p className="mt-2 mb-4 text-sm leading-relaxed text-muted">
          {t(
            "Incoming transfers and requests must reach this device even when the app is closed. Turn on notifications to continue.",
          )}
        </p>
        {state === "install" && (
          <ol className="m-0 mb-4 flex list-decimal flex-col gap-1.5 ps-5 text-sm">
            <li>{t("Tap the Share button in Safari.")}</li>
            <li>{t("Choose Add to Home Screen, then Add.")}</li>
            <li>{t("Open BUZZ from the Home Screen and sign in.")}</li>
            <li>{t("Tap Turn on notifications and choose Allow.")}</li>
          </ol>
        )}
        {state === "unsupported" && (
          <p className="m-0 mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(
              "This browser cannot receive notifications. Open BUZZ in Chrome or Edge, or on iPhone and iPad add it to the Home Screen.",
            )}
          </p>
        )}
        {state === "blocked" && (
          <ol className="m-0 mb-4 flex list-decimal flex-col gap-1.5 ps-5 text-sm">
            <li>
              {t(
                "Notifications are blocked for this site. Tap the lock or settings icon next to the address.",
              )}
            </li>
            <li>{t("Set Notifications to Allow.")}</li>
            <li>{t("Come back here and tap Try again.")}</li>
          </ol>
        )}
        {device.error && (
          <p
            className="m-0 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {t(device.error)}
          </p>
        )}
        {(state === "ask" || state === "blocked") && (
          <button
            type="button"
            className="button primary w-full"
            disabled={device.busy}
            onClick={() => void device.enable()}
          >
            {t(
              device.busy
                ? "Enabling…"
                : state === "blocked"
                  ? "Try again"
                  : "Turn on notifications",
            )}
          </button>
        )}
        {user.role === "ADMIN" && (
          <button
            type="button"
            className="mt-3 w-full border-0 bg-transparent text-sm text-muted underline"
            onClick={() => setSkipped(true)}
          >
            {t("Skip on this device for now (administrators only)")}
          </button>
        )}
      </div>
    </div>
  );
}
function PushSettings() {
  const { t, locale } = useBuzz();
  const { inbox, sound, enableSound, device } = useContext(NotificationContext);
  if (!device) return null;
  return (
    <section className="card notification-settings">
      <div className="notification-toolbar notification-delivery-heading">
        <div>
          <h2>{t("Notification delivery")}</h2>
          <p>{t("In-app notifications are always on.")}</p>
        </div>
        <span className={`badge ${device.enabled ? "approved" : "pending"}`}>
          {t(
            device.enabled
              ? "This device is registered"
              : "This device is not registered",
          )}
        </span>
      </div>
      <div className="notification-toolbar">
        <button
          className="button primary"
          onClick={() => void device.enable()}
          disabled={device.busy || !device.ready}
        >
          <Bell size={17} />
          {t(
            device.busy
              ? "Enabling…"
              : device.enabled
                ? "Check this device"
                : "Enable device notifications",
          )}
        </button>
        <button className="button" onClick={enableSound} aria-pressed={sound}>
          <Volume2 size={17} />
          {t(sound ? "Sound reminders on" : "Enable sound reminders")}
        </button>
      </div>
      {device.error && (
        <p className="error" role="alert">
          {t(device.error)}{" "}
          <button onClick={() => void device.retry()}>{t("Retry")}</button>
        </p>
      )}
      {inbox && (!inbox.pushConfigured || !inbox.workerHealthy) && (
        <p className="notification-warning" role="status">
          {t(
            !inbox.pushConfigured
              ? "Background notifications are not configured. Contact your administrator."
              : "Background notification worker is unavailable. Contact your administrator; inbox alerts remain saved.",
          )}
        </p>
      )}
      {!!inbox?.retryingDevices && (
        <p className="notification-warning">
          {inbox.retryingDevices}{" "}
          {t(
            "device deliveries failed and are retrying automatically. Inbox notifications remain available.",
          )}
        </p>
      )}
      <p className="notification-policy-summary">
        {reminderSummary(inbox?.policy ?? DEFAULT_NOTIFICATION_POLICY, locale)}
      </p>
      <details className="notification-help">
        <summary>
          {t("Devices and help")} ({device.devices.length})
        </summary>
        <p>
          {t(
            "Previously allowed devices connect automatically. New devices need one browser approval.",
          )}
        </p>
        <small>
          {t(
            "Device delivery depends on permission, connectivity and operating system settings. Sound needs an open app and must be enabled after opening it.",
          )}
        </small>
        <ul className="notification-devices">
          {device.devices.map((d, i) => (
            <li key={d.id}>
              <span>
                {t("Device")} {i + 1} ·{" "}
                {new Date(d.updatedAt).toLocaleString(dateLocale(locale))}
              </span>
              <button
                className="button"
                disabled={device.busy}
                onClick={() => void device.remove(d.id)}
              >
                {t("Remove device")}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function NotificationsPage() {
  const { t, locale, user } = useBuzz();
  const { inbox, refresh } = useContext(NotificationContext);
  const query = useSearchParams();
  const router = useRouter();
  const selected = query.get("notification");
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Inbox>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await api<Inbox>(
          `notifications?page=${page}&history=${history ? 1 : 0}${selected ? `&id=${encodeURIComponent(selected)}` : ""}`,
          undefined,
          "GET",
          signal,
        );
        setData(result);
        setError("");
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      }
    },
    [page, history, selected],
  );
  useEffect(() => {
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) void load(abort.signal);
    });
    return () => abort.abort();
  }, [load, inbox]);
  const acknowledge = async (id: string) => {
    setWorking(id);
    setError("");
    setMessage("");
    try {
      await api(`notifications/${id}/acknowledge`, {});
      try {
        const registration =
          await navigator.serviceWorker?.getRegistration("/");
        for (const notification of (await registration?.getNotifications({
          tag: `transfer:${id}`,
        })) ?? [])
          notification.close();
      } catch {
        /* Acknowledgment is already durable, even without device APIs. */
      }
      setMessage(
        "Acknowledgment saved. Reminders for this transfer have stopped for your shop.",
      );
      refresh();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(null);
    }
  };
  return (
    <>
      <PushSettings />
      {user.role === "ADMIN" && (
        <NotificationPolicySettings onSaved={refresh} />
      )}
      {user.role === "ADMIN" &&
        inbox?.coverage?.some((c) => !c.recipients || !c.devices) && (
          <section className="card notification-settings">
            <details className="notification-help">
              <summary>{t("Shops needing notification setup")}</summary>
              {inbox.coverage
                .filter((c) => !c.recipients || !c.devices)
                .map((c) => (
                  <p key={c.destinationId} className="notification-warning">
                    <strong>{c.name}</strong> · {c.pending} {t("pending")} ·{" "}
                    {c.recipients} {t("active recipients")} · {c.devices}{" "}
                    {t("registered devices")}
                  </p>
                ))}
              <Link className="button" href="/users">
                {t("Manage shop access")}
              </Link>
            </details>
          </section>
        )}
      {!!inbox?.overdue && (
        <div className="notification-warning" role="status">
          {inbox.overdue}{" "}
          {t("transfers have waited over 30 minutes for acknowledgment.")}
        </div>
      )}
      <h2 className="notification-inbox-title">
        {t("Incoming transfers")}{" "}
        <small>{t("Open a transfer to read the full notification.")}</small>
      </h2>
      <div className="notification-toolbar">
        <button
          className={`button ${!history ? "primary" : ""}`}
          onClick={() => {
            setHistory(false);
            setPage(0);
            router.replace(notificationUrl);
          }}
        >
          {t("Needs acknowledgment")} ({inbox?.pending ?? "…"})
        </button>
        <button
          className={`button ${history ? "primary" : ""}`}
          onClick={() => {
            setHistory(true);
            setPage(0);
            router.replace(notificationUrl);
          }}
        >
          {t("All notifications")}
        </button>
        <button
          className="button"
          onClick={() => {
            refresh();
            void load();
          }}
        >
          <RefreshCw size={16} />
          {t("Refresh")}
        </button>
      </div>
      {message && (
        <p className="notification-success" role="status">
          {t(message)}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)} <button onClick={() => void load()}>{t("Retry")}</button>
        </p>
      )}
      {!data && <p role="status">{t("Loading notifications…")}</p>}
      {data?.items.map((n) => (
        <details
          open={selected === n.id}
          key={n.id}
          id={`notification-${n.id}`}
          className={`card notification-card ${!n.acknowledgedAt && !n.closedAt ? "unacknowledged" : ""}`}
        >
          <summary className="notification-card-heading">
            <BellRing size={21} />
            <div className="notification-summary-text">
              <strong>{n.transfer.number}</strong>
              <span>
                {n.transfer.source} → {n.transfer.destination}
              </span>
            </div>
            <span
              className={`badge ${n.acknowledgedAt || n.closedAt ? "approved" : "pending"}`}
            >
              {t(
                n.acknowledgedAt
                  ? "Acknowledged"
                  : n.closedAt
                    ? "Resolved"
                    : "Needs acknowledgment",
              )}
            </span>
            <time dateTime={n.createdAt}>
              {new Date(n.createdAt).toLocaleString(dateLocale(locale))}
            </time>
          </summary>
          <div
            className="notification-full-text"
            dir={locale === "fa" ? "rtl" : "ltr"}
          >
            {n.body}
          </div>
          <div className="notification-card-actions">
            {!n.acknowledgedAt && !n.closedAt ? (
              <button
                className="button primary"
                disabled={!!working}
                onClick={() => void acknowledge(n.id)}
              >
                <CheckCheck size={18} />
                {t(
                  working === n.id
                    ? "Saving acknowledgment…"
                    : "Acknowledge transfer",
                )}
              </button>
            ) : (
              <p className="notification-success">
                {n.acknowledgedAt
                  ? `${t("Acknowledged by")} ${n.acknowledgedName} · ${new Date(n.acknowledgedAt).toLocaleString(dateLocale(locale))}`
                  : t(
                      "Reminders stopped because this transfer was received or rejected.",
                    )}
              </p>
            )}
            {(user.role === "ADMIN" || user.menus.includes("transfers")) && (
              <Link className="button" href={`/transfers/${n.transferId}`}>
                {t("Transfer details")}
              </Link>
            )}
          </div>
        </details>
      ))}
      {data && !data.items.length && (
        <div className="card notification-settings">
          {t(
            selected
              ? "Notification not found or access has changed."
              : history
                ? "No notifications yet."
                : "All incoming transfers have been acknowledged.",
          )}
        </div>
      )}
      {data && !selected && data.count > 20 && (
        <div className="notification-toolbar">
          <button
            className="button"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("Previous")}
          </button>
          <span>
            {page + 1} / {Math.ceil(data.count / 20)}
          </span>
          <button
            className="button"
            disabled={(page + 1) * 20 >= data.count}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("Next")}
          </button>
        </div>
      )}
    </>
  );
}
