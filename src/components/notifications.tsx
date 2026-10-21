"use client";
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
import { REMINDER_MS } from "@/lib/notification-content";
import { useBuzz } from "./shell";

import { useDeviceNotifications } from "./use-device-notifications";

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
      const key = `buzz:reminder:${user.id}`;
      const value = `${inbox.items[0]?.id}:${Math.floor(Date.now() / REMINDER_MS)}`;
      try {
        if (localStorage.getItem(key) === value) return;
        localStorage.setItem(key, value);
      } catch {
        /* Storage is optional. */
      }
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
  const { t, user } = useBuzz();
  const { inbox, error, refresh, device } = useContext(NotificationContext);
  const path = usePathname();
  const query = useSearchParams();
  const inNotificationSettings =
    path === "/settings" &&
    (user.role !== "ADMIN" || query.get("tab") === "notifications");
  return (
    <div className="notification-banners">
      {!inNotificationSettings && device?.ready && !device.enabled && (
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
              {t(
                "Reminders repeat every 5 minutes until your shop explicitly acknowledges.",
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
                {new Date(d.updatedAt).toLocaleString(
                  locale === "fa" ? "fa-IR" : "en-GB",
                )}
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
              {new Date(n.createdAt).toLocaleString(
                locale === "fa" ? "fa-IR" : "en-GB",
              )}
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
                  ? `${t("Acknowledged by")} ${n.acknowledgedName} · ${new Date(n.acknowledgedAt).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB")}`
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
