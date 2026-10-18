import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

// Shared Tailwind building blocks. Sizes start at phone size (44px touch
// targets, 16px inputs so iPhones do not zoom) and tighten from `md` up.
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(" ");

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-50 md:min-h-10";
export const buttonStyles = {
  primary: `${buttonBase} border-transparent bg-brand text-white shadow-sm shadow-brand/10 hover:bg-brand-dark`,
  secondary: `${buttonBase} border border-line bg-white text-ink hover:bg-zinc-50`,
  danger: `${buttonBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
  dangerSolid: `${buttonBase} border-transparent bg-red-600 text-white hover:bg-red-700`,
  ghost: `${buttonBase} border-transparent bg-transparent px-2 text-brand hover:bg-brand-soft`,
};
export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
}) {
  return (
    <button
      type={type}
      className={cx(buttonStyles[variant], className)}
      {...props}
    />
  );
}
export const iconButton =
  "inline-flex size-11 items-center justify-center rounded-lg border-0 bg-transparent text-muted transition-colors hover:bg-brand-soft hover:text-brand md:size-9";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-xl border border-line bg-white",
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({
  title,
  index,
  children,
}: {
  title: string;
  index?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
      <div className="flex items-center gap-2.5">
        {index && (
          <span className="text-xs tracking-wider text-subtle tabular-nums">
            {index}
          </span>
        )}
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}
export const inputStyles =
  "block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none [&[readonly]]:bg-zinc-50 [&[readonly]]:text-muted md:min-h-10 md:text-sm";
export function Field({
  label,
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { label: ReactNode }) {
  return (
    <label
      className={cx(
        "m-0 flex flex-col gap-1.5 text-sm font-medium text-muted",
        className,
      )}
      {...props}
    >
      {label}
      {children}
    </label>
  );
}
export function Notice({
  tone = "ok",
  children,
}: {
  tone?: "ok" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "m-0 w-full rounded-lg border px-4 py-3 text-sm",
        tone === "ok"
          ? "border-emerald-100 bg-emerald-50 text-emerald-800"
          : "border-red-100 bg-red-50 text-red-700",
      )}
    >
      {children}
    </p>
  );
}
// A table that is a list of cards on phones and a normal table from `md` up.
// Cells can add `data-label` text by rendering <CellLabel> first.
export const table = {
  wrap: "md:overflow-x-auto",
  table: "block w-full border-collapse text-sm md:table",
  head: "hidden md:table-header-group",
  th: "border-b border-line bg-zinc-50/70 px-4 py-3 text-start text-xs font-medium whitespace-nowrap text-subtle",
  body: "block md:table-row-group",
  row: "flex flex-col gap-2 border-b border-line px-4 py-4 last:border-b-0 md:table-row md:p-0",
  td: "block md:table-cell md:border-b md:border-line md:px-4 md:py-3.5 md:align-middle md:[tr:last-child>&]:border-b-0",
};
export function CellLabel({ children }: { children: ReactNode }) {
  return (
    <span className="me-1.5 text-xs text-subtle md:hidden">{children}:</span>
  );
}
export const linkButton =
  "inline-flex min-h-11 items-center rounded-md border-0 bg-transparent px-1 text-sm font-semibold whitespace-nowrap text-brand hover:underline disabled:pointer-events-none disabled:opacity-40 md:min-h-8";
export const checkbox =
  "m-0 size-5 min-h-0 shrink-0 p-0 accent-brand md:size-4";
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "bad" | "warn" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap",
        tone === "ok" && "border-emerald-100 bg-emerald-50 text-emerald-700",
        tone === "bad" && "border-red-100 bg-red-50 text-red-700",
        tone === "warn" && "border-amber-100 bg-amber-50 text-amber-800",
        tone === "neutral" && "border-line bg-zinc-50 text-muted",
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {children}
    </span>
  );
}
