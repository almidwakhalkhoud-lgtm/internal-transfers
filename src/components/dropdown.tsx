"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  useController,
  useFormContext,
  type Control,
  type FieldValues,
} from "react-hook-form";
import { useBuzz } from "./shell";
type Option = {
  value: string;
  label: ReactNode;
  text: string;
  disabled?: boolean;
};
function collect(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (
      !isValidElement<{
        value?: string;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type !== "option") return collect(child.props.children);
    return [
      {
        value: String(child.props.value ?? child.props.children ?? ""),
        label: child.props.children,
        text: String(child.props.children ?? ""),
        disabled: child.props.disabled,
      },
    ];
  });
}
type DropdownProps = SelectHTMLAttributes<HTMLSelectElement>;
export function Dropdown(props: DropdownProps) {
  const form = useFormContext();
  return form && props.name ? (
    <RegisteredDropdown {...props} name={props.name} control={form.control} />
  ) : (
    <DropdownControl {...props} />
  );
}
function RegisteredDropdown({
  control,
  ...props
}: DropdownProps & { name: string; control: Control<FieldValues> }) {
  const { t } = useBuzz();
  const options = collect(props.children);
  const { field, fieldState } = useController({
    name: props.name,
    control,
    defaultValue: props.defaultValue ?? options[0]?.value ?? "",
    rules: {
      required: props.required ? t("This field is required.") : false,
      validate: (value) =>
        options.some((option) => option.value === value && !option.disabled) ||
        t("The entered format is invalid."),
    },
  });
  return (
    <>
      <DropdownControl
        {...props}
        value={props.value ?? field.value}
        buttonRef={field.ref}
        onBlur={field.onBlur}
        onChange={(event) => {
          field.onChange(event.target.value);
          props.onChange?.(event);
        }}
      />
      {fieldState.error && (
        <span className="inline-error" role="alert">
          {fieldState.error.message}
        </span>
      )}
    </>
  );
}
function DropdownControl({
  children,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  name,
  id,
  disabled,
  className,
  buttonRef,
  onBlur,
  ...props
}: DropdownProps & {
  buttonRef?: (element: HTMLButtonElement | null) => void;
}) {
  const options = collect(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const selected = String(value ?? local);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const typeahead = useRef({ value: "", time: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const trigger = button.current;
    if (!list || !trigger) return;
    // The browser's top layer escapes card overflow and animation stacking
    // contexts while the listbox itself remains entirely custom coded.
    list.showPopover();
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 170), window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const flip = below < 180 && above > below;
      const height = Math.max(44, Math.min(240, flip ? above : below));
      const rtl = getComputedStyle(trigger).direction === "rtl";
      list.style.width = `${width}px`;
      list.style.maxHeight = `${height}px`;
      list.style.left = `${Math.max(8, Math.min(rtl ? rect.right - width : rect.left, window.innerWidth - width - 8))}px`;
      list.style.top = `${flip ? Math.max(8, rect.top - Math.min(list.scrollHeight, height) - 6) : rect.bottom + 6}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (list.matches(":popover-open")) list.hidePopover();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${listId}-${active}`);
    const list = option?.parentElement;
    if (!option || !list) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, active, listId]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setLocal(option.value);
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
    } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    button.current?.focus();
  }
  return (
    <div className={`dropdown ${className ?? ""}`} ref={root}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        ref={(element) => {
          button.current = element;
          buttonRef?.(element);
        }}
        id={id}
        role="combobox"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        className="dropdown-trigger"
        onBlur={(e) => {
          onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget))
            setOpen(false);
        }}
        onClick={() => {
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.value === selected),
            ),
          );
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === "Tab") {
            if (open) choose(active);
            onKeyDown?.(
              event as unknown as React.KeyboardEvent<HTMLSelectElement>,
            );
            return;
          }
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Home" ||
            event.key === "End"
          ) {
            event.preventDefault();
            setOpen(true);
            setActive((i) =>
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        options.length - 1,
                        i + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
            );
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else setOpen(true);
            return;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            const now = event.timeStamp;
            typeahead.current = {
              value:
                (now - typeahead.current.time < 700
                  ? typeahead.current.value
                  : "") + event.key.toLowerCase(),
              time: now,
            };
            const index = options.findIndex((o) =>
              o.text.toLowerCase().startsWith(typeahead.current.value),
            );
            if (index >= 0) {
              setOpen(true);
              setActive(index);
            }
          }
        }}
      >
        <span>{options.find((o) => o.value === selected)?.label ?? "—"}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          ref={listRef}
          popover="manual"
          id={listId}
          role="listbox"
          className="dropdown-list"
        >
          {options.map((option, i) => (
            <div
              role="option"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") choose(i);
              }}
              id={`${listId}-${i}`}
              key={option.value}
              aria-selected={option.value === selected}
              aria-disabled={option.disabled}
              className={`dropdown-option ${active === i ? "highlighted" : ""}`}
              onPointerMove={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                choose(i);
              }}
            >
              {option.label}
              {option.value === selected && <Check size={14} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
