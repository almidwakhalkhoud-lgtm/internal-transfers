"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { FormProvider, useForm, type FieldValues } from "react-hook-form";
import { translate, type Locale } from "@/lib/i18n";
import { useBuzz } from "./shell";

// Shared registration keeps every standard form on the same RHF validation path.
// Business rules are also revalidated by the authenticated API.
export function Form({
  children,
  onSubmit,
  locale,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { locale?: Locale }) {
  const buzz = useBuzz();
  const formId = useId();
  const t = locale ? (key: string) => translate(locale, key) : buzz.t;
  const methods = useForm<FieldValues>({ mode: "onTouched" });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;
  function fields(nodes: ReactNode, labelText?: string): ReactNode {
    return Children.map(nodes, (node) => {
      if (
        !isValidElement<
          InputHTMLAttributes<HTMLInputElement> & { children?: ReactNode }
        >(node)
      )
        return node;
      const p = node.props;
      if (
        (node.type === "input" || node.type === "textarea") &&
        p.name &&
        p.type !== "hidden"
      ) {
        const registration = register(p.name, {
          required: p.required ? t("This field is required.") : false,
          minLength: p.minLength
            ? {
                value: p.minLength,
                message: t("The entered value is too short."),
              }
            : undefined,
          maxLength: p.maxLength
            ? {
                value: p.maxLength,
                message: t("The entered value is too long."),
              }
            : undefined,
          pattern:
            p.type === "email"
              ? {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t("Enter a valid email address."),
                }
              : p.pattern
                ? {
                    value: new RegExp(`^(?:${p.pattern})$`),
                    message: t("The entered format is invalid."),
                  }
                : undefined,
          min:
            p.min !== undefined
              ? {
                  value: Number(p.min),
                  message: t("The value is below the allowed minimum."),
                }
              : undefined,
          max:
            p.max !== undefined
              ? {
                  value: Number(p.max),
                  message: t("The value exceeds the allowed maximum."),
                }
              : undefined,
        });
        return (
          <>
            {cloneElement(node, {
              ...registration,
              "aria-label": p["aria-label"] ?? labelText,
              "aria-describedby": errors[p.name]
                ? `${formId}-${p.name}-error`
                : p["aria-describedby"],
              "aria-invalid": !!errors[p.name],
              onChange: (e) => {
                void registration.onChange(e);
                p.onChange?.(e);
              },
              onBlur: (e) => {
                void registration.onBlur(e);
                p.onBlur?.(e);
              },
            })}
            {errors[p.name] && (
              <span
                id={`${formId}-${p.name}-error`}
                className="inline-error"
                role="alert"
              >
                {String(errors[p.name]?.message)}
              </span>
            )}
          </>
        );
      }
      const nextLabel =
        node.type === "label"
          ? Children.toArray(p.children)
              .filter(
                (child) =>
                  typeof child === "string" || typeof child === "number",
              )
              .join("")
              .trim()
          : labelText;
      return p.children
        ? cloneElement(node, {}, fields(p.children, nextLabel))
        : node;
    });
  }
  return (
    <FormProvider {...methods}>
      <form
        {...props}
        noValidate
        aria-busy={isSubmitting}
        onSubmit={(event) => {
          const form = event.currentTarget;
          const stableEvent = {
            ...event,
            currentTarget: form,
            target: form,
            preventDefault: () => event.preventDefault(),
          };
          void handleSubmit(async () => {
            await onSubmit?.(stableEvent);
          })(event);
        }}
      >
        {fields(children)}
      </form>
    </FormProvider>
  );
}
