"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

type Device = { id: string; createdAt: string; updatedAt: string };
type Settings = {
  publicKey: string | null;
  devices: Device[];
  required?: boolean;
};
export const supported = () =>
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function useDeviceNotifications(userId: string) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentDevice = useRef<string | null>(null);
  const running = useRef(false);
  const optOutKey = `buzz:push-disabled:${userId}`;
  const optedOut = useCallback(() => {
    try {
      return localStorage.getItem(optOutKey) === "1";
    } catch {
      return false;
    }
  }, [optOutKey]);

  const connect = useCallback(
    async (explicit = false) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      setError("");
      try {
        if (explicit) {
          if (!supported())
            throw new Error(
              "Background notifications need HTTPS and a supported browser. On iPhone, add this app to your Home Screen first.",
            );
          // The permission prompt must run directly from the activation button.
          const permission =
            Notification.permission === "granted"
              ? "granted"
              : await Notification.requestPermission();
          if (permission !== "granted")
            throw new Error(
              "Notifications are blocked. Allow notifications in your browser and device settings, then try again.",
            );
          try {
            localStorage.removeItem(optOutKey);
          } catch {
            /* Optional storage. */
          }
        }
        const settings = await api<Settings>("notifications/push");
        setDevices(settings.devices);
        setRequired(!!settings.required);
        if (
          !supported() ||
          Notification.permission !== "granted" ||
          optedOut()
        ) {
          setEnabled(false);
          return;
        }
        if (!settings.publicKey)
          throw new Error(
            "Background notifications are not configured. Contact your administrator.",
          );
        await navigator.serviceWorker.register("/notifications-sw.js", {
          scope: "/",
        });
        const registration = await navigator.serviceWorker.ready;
        const bytes = Uint8Array.from(
          atob(settings.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );
        let sub = await registration.pushManager.getSubscription();
        if (
          sub?.options.applicationServerKey &&
          new Uint8Array(sub.options.applicationServerKey).join() !==
            bytes.join()
        ) {
          await sub.unsubscribe();
          sub = null;
        }
        sub ??= await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
        // Provider permission alone is insufficient: persist/rebind this device first.
        await api("notifications/push", sub.toJSON());
        const saved = await api<{ id: string | null }>(
          "notifications/push/status",
          { endpoint: sub.endpoint },
        );
        if (!saved.id)
          throw new Error(
            "Could not check notification devices. Please retry.",
          );
        currentDevice.current = saved.id;
        setEnabled(true);
        setDevices((await api<Settings>("notifications/push")).devices);
      } catch (e) {
        setError((e as Error).message);
        setEnabled(false);
      } finally {
        running.current = false;
        setBusy(false);
        setReady(true);
      }
    },
    [optOutKey, optedOut],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void connect();
    });
    const wake = () => {
      if (document.visibilityState === "visible") void connect();
    };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      active = false;
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [connect]);

  const remove = async (id: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      if (id === currentDevice.current) {
        // Remember an intentional opt-out so focus/reload cannot undo it.
        try {
          localStorage.setItem(optOutKey, "1");
        } catch {
          /* Optional storage. */
        }
      }
      await api("notifications/push/remove", { id });
      setDevices((list) => list.filter((d) => d.id !== id));
      if (id === currentDevice.current) {
        setEnabled(false);
        currentDevice.current = null;
        const registration = await navigator.serviceWorker.getRegistration("/");
        await (
          await registration?.pushManager.getSubscription()
        )?.unsubscribe();
        for (const n of (await registration?.getNotifications()) ?? [])
          n.close();
      }
    } catch {
      setError("Could not remove notification device. Please retry.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return {
    devices,
    enabled,
    ready,
    required,
    busy,
    error,
    enable: () => connect(true),
    retry: () => connect(),
    remove,
  };
}
