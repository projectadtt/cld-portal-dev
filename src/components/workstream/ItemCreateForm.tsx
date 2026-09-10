"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createItemAction,
  type ItemCreateState,
} from "@/app/retailers/[retailerId]/items/actions";
import { cn } from "@/lib/cn";

/**
 * Putting one product in front of one account.
 *
 * One field, on purpose. A pairing is a fact — this item is now being worked
 * into this account — and nothing else is known at the moment it becomes true.
 * Asking for a fit, a door count or a dated next step here would be asking
 * someone to invent them, so the form does not, and the record carries nulls
 * until somebody records the real answers in the item workspace.
 *
 * The same underlined control as every other form in the portal.
 */

/** A product this account does not already carry, named for the select. */
export interface ProductChoice {
  id: string;
  /** Workbook item number, shown beside the name so the picker matches the sheet. */
  itemId: string;
  name: string;
}

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_STATE: ItemCreateState = { errors: {}, saved: null, savedAt: 0 };

export function ItemCreateForm({
  retailerId,
  products,
  cancelHref,
}: {
  retailerId: string;
  /** Resolved on the server, already minus what this account carries. */
  products: ProductChoice[];
  cancelHref: string;
}) {
  /* Bound to the account by the page, not by a form field: a request cannot
     point this write at a different account by adding one. */
  const [state, formAction, pending] = useActionState<ItemCreateState, FormData>(
    createItemAction.bind(null, retailerId),
    NO_STATE,
  );
  const errors = state.errors;

  if (products.length === 0) {
    return (
      <div className="mt-10 lg:mt-12">
        <p className="max-w-[52ch] text-sm leading-relaxed text-ink-muted">
          Every item on the range is already in this account&rsquo;s workstream.
          There is nothing left to add.
        </p>
        <Link
          href={cancelHref}
          className="mt-6 inline-block text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Back to the account
        </Link>
      </div>
    );
  }

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

      <div className="max-w-md">
        <label htmlFor="productId" className="type-label block">
          Item
        </label>

        <div className="mt-1">
          <select
            id="productId"
            name="productId"
            defaultValue=""
            required
            aria-invalid={errors.productId ? true : undefined}
            aria-describedby={errors.productId ? "productId-error" : undefined}
            className={cn(
              CONTROL,
              "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6",
            )}
            style={{ backgroundImage: CHEVRON }}
          >
            <option value="" disabled>
              Choose an item
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.itemId + " · " + product.name}
              </option>
            ))}
          </select>
        </div>

        {errors.productId ? (
          <p id="productId-error" className="mt-1.5 text-[13px] leading-5 text-red">
            {errors.productId}
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] leading-5 text-ink-faint">
            Items already in this account&rsquo;s workstream are not listed.
          </p>
        )}
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
          {pending ? "Adding…" : "Add to workstream"}
        </button>

        <Link
          href={cancelHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
