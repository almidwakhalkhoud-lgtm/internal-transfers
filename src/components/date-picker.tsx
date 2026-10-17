"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "./modal";
import { Dropdown } from "./dropdown";
import { useBuzz } from "./shell";

// Calendar arithmetic uses UTC dates; persisted dates are timezone-free ISO days.
function parse(value: string) {
  return new Date(`${value}T12:00:00Z`);
}
function iso(value: Date) {
  return value.toISOString().slice(0, 10);
}
function moveMonth(day: Date, delta: number) {
  const first = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + delta, 1, 12),
  );
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  first.setUTCDate(Math.min(day.getUTCDate(), last));
  return first;
}
export function DatePicker({
  value,
  onChange,
  label,
  clearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  clearable?: boolean;
}) {
  const { locale, t } = useBuzz();
  const [today, setToday] = useState("");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const formatter = new Intl.DateTimeFormat(
    `${locale === "fa" ? "fa-IR" : "en-GB"}-u-ca-gregory`,
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  );
  return (
    <div className="date-picker">
      <button
        type="button"
        className="date-trigger"
        ref={trigger}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setToday(
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
          );
          setOpen(true);
        }}
      >
        <span>{value ? formatter.format(parse(value)) : label}</span>
        <CalendarDays size={17} />
      </button>
      {open &&
        createPortal(
          <Modal title="Select date" onClose={close} dismissOnBackdrop>
            <Calendar
              value={value || today}
              today={today}
              onChoose={(date) => {
                onChange(date);
                close();
              }}
              clearable={clearable}
            />
            <p className="calendar-hint">
              {t(
                "Gregorian calendar · Use arrow keys to move and Enter to select.",
              )}
            </p>
          </Modal>,
          document.body,
        )}
    </div>
  );
}
function Calendar({
  value,
  today,
  onChoose,
  clearable,
}: {
  value: string;
  today: string;
  onChoose: (value: string) => void;
  clearable: boolean;
}) {
  const { locale, t } = useBuzz();
  const id = useId();
  const [focused, setFocused] = useState(value);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => {
    buttons.current.get(focused)?.focus();
  }, [focused]);
  const date = parse(focused);
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const startOfWeek = locale === "fa" ? 6 : 0;
  const first = new Date(Date.UTC(year, month, 1, 12));
  const offset = (first.getUTCDay() - startOfWeek + 7) % 7;
  const calendarLocale = `${locale === "fa" ? "fa-IR" : "en-GB"}-u-ca-gregory`;
  const fullDate = new Intl.DateTimeFormat(calendarLocale, {
    dateStyle: "full",
    timeZone: "UTC",
  });
  const monthFormat = new Intl.DateTimeFormat(calendarLocale, {
    month: "long",
    timeZone: "UTC",
  });
  const weekFormat = new Intl.DateTimeFormat(calendarLocale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const number = new Intl.NumberFormat(locale);
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(Date.UTC(year, month, i - offset + 1, 12)),
  );
  const todayYear = parse(today).getUTCFullYear();
  function navigate(key: string, shift: boolean) {
    let target = new Date(date);
    if (key === "ArrowRight" || key === "ArrowLeft")
      target.setUTCDate(
        target.getUTCDate() +
          (key === "ArrowRight" ? 1 : -1) * (locale === "fa" ? -1 : 1),
      );
    else if (key === "ArrowDown" || key === "ArrowUp")
      target.setUTCDate(target.getUTCDate() + (key === "ArrowDown" ? 7 : -7));
    else if (key === "Home" || key === "End")
      target.setUTCDate(
        target.getUTCDate() -
          ((target.getUTCDay() - startOfWeek + 7) % 7) +
          (key === "End" ? 6 : 0),
      );
    else if (key === "PageUp" || key === "PageDown")
      target = moveMonth(
        target,
        (key === "PageDown" ? 1 : -1) * (shift ? 12 : 1),
      );
    else return false;
    setFocused(iso(target));
    return true;
  }
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <button
          type="button"
          className="icon-button"
          aria-label={t("Previous month")}
          onClick={() => setFocused(iso(moveMonth(date, -1)))}
        >
          <ChevronLeft size={18} />
        </button>
        <Dropdown
          aria-label={t("Month")}
          value={String(month)}
          onChange={(e) =>
            setFocused(iso(moveMonth(date, Number(e.target.value) - month)))
          }
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {monthFormat.format(new Date(Date.UTC(year, i, 1, 12)))}
            </option>
          ))}
        </Dropdown>
        <Dropdown
          aria-label={t("Year")}
          value={String(year)}
          onChange={(e) =>
            setFocused(
              iso(moveMonth(date, (Number(e.target.value) - year) * 12)),
            )
          }
        >
          {Array.from({ length: 201 }, (_, i) => todayYear - 100 + i).map(
            (y) => (
              <option key={y} value={y}>
                {number.format(y).replaceAll(",", "").replaceAll("٬", "")}
              </option>
            ),
          )}
        </Dropdown>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Next month")}
          onClick={() => setFocused(iso(moveMonth(date, 1)))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div
        role="grid"
        aria-label={t("Gregorian calendar")}
        aria-labelledby={`${id}-month`}
      >
        <span id={`${id}-month`} className="sr-only" aria-live="polite">
          {monthFormat.format(date)} {number.format(year)}
        </span>
        <div role="row" className="calendar-week">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              role="columnheader"
              key={i}
              aria-label={weekFormat.format(
                new Date(Date.UTC(2026, 9, 18 + startOfWeek + i, 12)),
              )}
            >
              {locale === "fa"
                ? ["ی", "د", "س", "چ", "پ", "ج", "ش"][(startOfWeek + i) % 7]
                : weekFormat.format(new Date(Date.UTC(2026, 9, 18 + i, 12)))}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div role="row" className="calendar-week" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((day) => {
              const key = iso(day);
              return (
                <div role="gridcell" key={key} aria-selected={key === value}>
                  <button
                    type="button"
                    ref={(element) => {
                      if (element) buttons.current.set(key, element);
                      else buttons.current.delete(key);
                    }}
                    tabIndex={key === focused ? 0 : -1}
                    data-initial-focus={key === focused ? true : undefined}
                    aria-label={fullDate.format(day)}
                    aria-current={key === today ? "date" : undefined}
                    className={`calendar-day ${day.getUTCMonth() !== month ? "outside-month" : ""} ${key === value ? "selected-day" : ""}`}
                    onKeyDown={(event) => {
                      if (navigate(event.key, event.shiftKey))
                        event.preventDefault();
                    }}
                    onClick={() => onChoose(key)}
                  >
                    {number.format(day.getUTCDate())}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="calendar-footer">
        <button
          type="button"
          className="text-button"
          onClick={() => onChoose(today)}
        >
          {t("Today")}
        </button>
        {clearable && (
          <button
            type="button"
            className="text-button"
            onClick={() => onChoose("")}
          >
            {t("Clear date")}
          </button>
        )}
      </div>
    </div>
  );
}
