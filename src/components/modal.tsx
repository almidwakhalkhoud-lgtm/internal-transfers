"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBuzz } from "./shell";
import { iconButton } from "./ui";
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
      className="fixed inset-0 z-[100] m-0 flex h-dvh max-h-none w-screen max-w-none items-end justify-center border-0 bg-zinc-900/40 p-0 text-inherit backdrop-blur-[2px] not-open:hidden sm:items-center sm:p-5"
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
      {/* "modal" stays as a hook for content still styled by the old sheet. */}
      <div className="modal max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl rounded-b-none bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90vh] sm:w-[560px] sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">{t(title)}</h2>
          <button
            type="button"
            className={iconButton}
            aria-label={t("Cancel")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
