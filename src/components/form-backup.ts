"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Keeps what someone is typing on this device, so a reload, a phone call that
// sends the tablet back to the home screen, or a sign-out does not lose it.
// The backup belongs to one user and is dropped after a week or once sent.
const maxAge = 7 * 24 * 3600_000;
export function useFormBackup<T>(
  key: string,
  value: T,
  ready: boolean,
  restore: (saved: T) => boolean,
) {
  const started = useRef(false);
  const loaded = useRef(false);
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  });
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    // Restore after this render, like the other first loads in the app.
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as { savedAt: number; value: T };
          if (Date.now() - saved.savedAt > maxAge) localStorage.removeItem(key);
          else if (restoreRef.current(saved.value)) setRestored(true);
        }
      } catch {
        /* Storage may be blocked or hold something unreadable. */
      }
      loaded.current = true;
    });
  }, [key, ready]);
  const json = JSON.stringify(value);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, `{"savedAt":${Date.now()},"value":${json}}`);
    } catch {
      /* A full or blocked storage only loses the backup. */
    }
  }, [key, json]);
  const clear = useCallback(() => {
    setRestored(false);
    try {
      localStorage.removeItem(key);
    } catch {
      /* Nothing to remove. */
    }
  }, [key]);
  return { restored, clear };
}
