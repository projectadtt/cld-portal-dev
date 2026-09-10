"use client";

import { useActionState, useState } from "react";

import {
  archiveProductAction,
  type ProductFormState,
} from "@/app/products/actions";
import { NO_PRODUCT_STATE } from "@/components/products/ProductForm";
import { cn } from "@/lib/cn";

/**
 * Withdrawing a product from the working range.
 *
 * Archive rather than delete, and the copy says so: the records that mention
 * this item — the accounts it was taken to, what buyers said about it — stay
 * exactly as they are. Nothing about the history stops being true because the
 * item stopped being offered.
 *
 * Two steps rather than one button, because it is the only destructive-looking
 * control in the portal and a stray click should not fire it. Red is used
 * here for what red is for: a decision that changes what the portal shows.
 */
export function ArchiveProduct({
  productId,
  inWorkstream,
}: {
  productId: string;
  /** How many retail conversations mention this item. */
  inWorkstream: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    archiveProductAction.bind(null, productId),
    NO_PRODUCT_STATE,
  );

  return (
    <section className="mt-16 border-t border-rule pt-6 lg:mt-20">
      <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
        Archive this product
      </h2>

      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
        Takes the item off the working range. It stops appearing in the
        portfolio, in the workstream and in anything to be pitched
        {inWorkstream > 0
          ? `, and the ${inWorkstream === 1 ? "one account" : inWorkstream + " accounts"} it has already been taken to keep their record of it in full.`
          : ". Nothing is deleted."}
      </p>

      {state.errors.form ? (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-red">
          {state.errors.form}
        </p>
      ) : null}

      <form action={formAction} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {confirming ? (
          <>
            <input type="hidden" name="confirm" value="archive" />
            <button
              type="submit"
              disabled={pending}
              className={cn(
                "border border-red px-5 py-2.5 text-[13px] tracking-[0.02em] text-red transition-colors",
                pending ? "opacity-60" : "hover:bg-red-tint",
              )}
            >
              {pending ? "Archiving…" : "Yes, archive it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-ink-muted transition-colors hover:text-forest"
            >
              Keep it on the range
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-ink-muted underline decoration-rule underline-offset-4 transition-colors hover:text-red"
          >
            Archive this product
          </button>
        )}
      </form>
    </section>
  );
}
