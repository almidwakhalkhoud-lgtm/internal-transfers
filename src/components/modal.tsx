"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBuzz } from "./shell";
export function Modal({
  title,
  onClose,
  children,
  dismissOnBackdrop = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
}) {
  const { t, locale } = useBuzz();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal-backdrop"
      dir={locale === "fa" ? "rtl" : "ltr"}
      lang={locale}
      aria-label={t(title)}
      onPointerDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget)
          onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal">
        <div className="modal-heading">
          <h2>{t(title)}</h2>
          <button
            className="icon-button"
            aria-label={t("Cancel")}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
