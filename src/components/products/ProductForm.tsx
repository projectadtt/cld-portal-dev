"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/app/products/actions";
import { ImageField } from "@/components/media/ImageField";
import { cn } from "@/lib/cn";
import { RETAIL_READINESS } from "@/lib/status";

/**
 * Entering a product.
 *
 * Laid out the way the workbook's Product Master reads, in the order someone
 * actually knows things: what the item is, how it is packed and positioned,
 * and only then what it costs — because the commercial terms are usually the
 * last thing to arrive and are all optional here.
 *
 * Not an admin form. The same underlined controls, the same editorial
 * headings and the same spacing as every other CLD screen, so entering data
 * feels like part of the portal rather than a trip to a back office.
 */

export interface ProductFormValues {
  name: string;
  itemId: string;
  category: string;
  readiness: string;
  packSize: string;
  positioning: string;
  upc: string;
  sourceNotes: string;
  fobCost: string;
  landedCost: string;
  suggestedRetail: string;
  moq: string;
  casePack: string;
  leadTimeDays: string;
}

export const BLANK_PRODUCT: ProductFormValues = {
  name: "", itemId: "", category: "", readiness: "In preparation",
  packSize: "", positioning: "", upc: "", sourceNotes: "",
  fobCost: "", landedCost: "", suggestedRetail: "",
  moq: "", casePack: "", leadTimeDays: "",
};

/* Not exported from the action module: a "use server" file may only export
   async functions, and a constant from one arrives here as undefined. */
export const NO_PRODUCT_STATE: ProductFormState = { errors: {}, saved: null, savedAt: 0 };

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="type-label block">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={htmlFor + "-error"} className="mt-1.5 text-[13px] leading-5 text-red">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] leading-5 text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">{description}</p>
      <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export function ProductForm({
  productId,
  values,
  submitLabel,
  cancelHref,
  imageUrl,
  imagePlaceholder,
}: {
  /** Absent when creating. */
  productId?: string;
  values: ProductFormValues;
  submitLabel: string;
  cancelHref: string;
  /**
   * Built server-side from the stored path. This component is a client
   * component and must never reach the storage module, which holds the
   * service-role credential.
   */
  imageUrl: string | null;
  /** The record's own no-image treatment, rendered on the server. */
  imagePlaceholder: ReactNode;
}) {
  const action = productId
    ? updateProductAction.bind(null, productId)
    : createProductAction;

  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    NO_PRODUCT_STATE,
  );
  const { errors } = state;

  const input = (
    name: keyof ProductFormValues,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      id={name}
      name={name}
      defaultValue={values[name]}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? name + "-error" : undefined}
      className={CONTROL}
      {...extra}
    />
  );

  return (
    <form action={formAction} className="mt-10 lg:mt-12">
      {errors.form ? (
        <p
          role="alert"
          className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="space-y-12 lg:space-y-14">
        <Section
          title="What the item is"
          description="The four things every product needs before it can be talked about at all."
        >
          <Field label="Product name" htmlFor="name" error={errors.name}>
            {input("name", { type: "text", maxLength: 120, required: true })}
          </Field>

          <Field
            label="Item number"
            htmlFor="itemId"
            error={errors.itemId}
            hint="Whatever number this item is listed under on the Product Master."
          >
            {input("itemId", { type: "text", maxLength: 40, required: true })}
          </Field>

          <Field
            label="Category"
            htmlFor="category"
            error={errors.category}
            hint="The set it would sit in on shelf."
          >
            {input("category", { type: "text", maxLength: 80, required: true })}
          </Field>

          <Field
            label="Readiness"
            htmlFor="readiness"
            error={errors.readiness}
            hint="Whether it can be taken to a buyer as it stands."
          >
            <select
              id="readiness"
              name="readiness"
              defaultValue={values.readiness}
              aria-invalid={errors.readiness ? true : undefined}
              aria-describedby={errors.readiness ? "readiness-error" : undefined}
              className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
              style={{ backgroundImage: CHEVRON }}
            >
              {RETAIL_READINESS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section
          title="How it is packed and pitched"
          description="What a buyer sees, and the line CLD leads with. Both optional — an item can be entered before either is settled."
        >
          <ImageField
            className="sm:col-span-2"
            label="Product image"
            hint="Optional. JPG, PNG or WEBP, up to 5 MB. Used on the product card and at the top of its page."
            error={errors.image}
            currentUrl={imageUrl}
            placeholder={imagePlaceholder}
          />

          <Field label="Pack size" htmlFor="packSize" hint="e.g. 7.05 oz box.">
            {input("packSize", { type: "text", maxLength: 60 })}
          </Field>

          <Field label="UPC" htmlFor="upc" error={errors.upc} hint="8 to 14 digits.">
            {input("upc", { type: "text", maxLength: 14, inputMode: "numeric" })}
          </Field>

          <Field
            label="Positioning"
            htmlFor="positioning"
            className="sm:col-span-2"
            hint="One or two sentences: what this item claims."
          >
            <textarea
              id="positioning"
              name="positioning"
              rows={2}
              maxLength={400}
              defaultValue={values.positioning}
              className={cn(CONTROL, "resize-y leading-relaxed")}
            />
          </Field>

          <Field
            label="Notes"
            htmlFor="sourceNotes"
            className="sm:col-span-2"
            hint="Anything CLD needs to remember when this item comes up."
          >
            <textarea
              id="sourceNotes"
              name="sourceNotes"
              rows={2}
              maxLength={600}
              defaultValue={values.sourceNotes}
              className={cn(CONTROL, "resize-y leading-relaxed")}
            />
          </Field>
        </Section>

        <Section
          title="Commercial terms"
          description="All optional, and usually the last thing to be known. Leave a box empty and the portal reports it as not recorded rather than as zero."
        >
          <Field label="FOB cost" htmlFor="fobCost" error={errors.fobCost}>
            {input("fobCost", { type: "text", inputMode: "decimal" })}
          </Field>

          <Field label="Landed cost" htmlFor="landedCost" error={errors.landedCost}>
            {input("landedCost", { type: "text", inputMode: "decimal" })}
          </Field>

          <Field
            label="Suggested retail"
            htmlFor="suggestedRetail"
            error={errors.suggestedRetail}
            hint="Retailer margin is worked out from this and landed cost."
          >
            {input("suggestedRetail", { type: "text", inputMode: "decimal" })}
          </Field>

          <Field label="MOQ" htmlFor="moq" error={errors.moq} hint="Minimum order, in units.">
            {input("moq", { type: "text", inputMode: "numeric" })}
          </Field>

          <Field label="Case pack" htmlFor="casePack" error={errors.casePack}>
            {input("casePack", { type: "text", inputMode: "numeric" })}
          </Field>

          <Field label="Lead time" htmlFor="leadTimeDays" error={errors.leadTimeDays} hint="In days.">
            {input("leadTimeDays", { type: "text", inputMode: "numeric" })}
          </Field>
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
            pending ? "opacity-60" : "hover:opacity-90",
          )}
        >
          {pending ? "Saving…" : submitLabel}
        </button>

        <Link
          href={cancelHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Cancel
        </Link>

        {state.saved ? (
          <p role="status" className="text-[13px] leading-5 text-forest">
            {state.saved.length === 0
              ? "Saved. Nothing had changed."
              : "Saved · " + state.saved.join(" · ")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
