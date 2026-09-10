import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { meta } from "@/lib/cn";
import type { ProductSummary } from "@/lib/selectors";
import { fitTone, itemStatusTone, retailReadinessTone } from "@/lib/status";

/**
 * One product at a glance: what it is, how far it has got in retail, and
 * whether anything is holding it back.
 *
 * Deliberately not a bordered card — image, then type, then a hairline over
 * the status line. The grid reads as a portfolio rather than a storefront.
 */
export function ProductCard({ summary }: { summary: ProductSummary }) {
  const { product, retailerCount, bestFit, furthestStatus, feedbackCount } =
    summary;

  return (
    <li>
      <Link
        href={"/products/" + product.id}
        className="group block focus-visible:outline-offset-4"
      >
        <ProductImage product={product} />

        <h3 className="mt-4 flex min-h-[2.9375rem] items-start gap-1.5 font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink transition-colors group-hover:text-forest">
          {product.name}
          <ArrowUpRight
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="mt-1 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        </h3>

        <p className="type-label mt-1.5">
          {meta(product.category, product.packSize)}
        </p>

        {/* Fixed-height slot so cards in a row stay level whatever each
            product has to report. */}
        <div className="mt-3.5 min-h-[3.75rem] border-t border-rule-soft pt-3">
          {furthestStatus ? (
            <>
              <StatusBadge
                label={furthestStatus}
                tone={itemStatusTone[furthestStatus]}
              />
              <p className="mt-1.5 text-[13px] text-ink-muted">
                {retailerCount === 1 ? "1 retailer" : retailerCount + " retailers"}
                {bestFit ? (
                  <span className={fitTone[bestFit] === "active" ? "text-forest" : ""}>
                    {" · " + bestFit + " fit"}
                  </span>
                ) : null}
                {feedbackCount > 0 ? " · heard back" : ""}
              </p>
            </>
          ) : (
            <>
              <StatusBadge label="Not pitched" tone="dormant" />
              <p className="mt-1.5 text-[13px] text-ink-faint">
                No retail conversation yet.
              </p>
            </>
          )}

          {/* Only stated when the item is not ready to be taken to a
              retailer. Colour comes from the tone map, so work in hand reads
              as neutral and only genuine trouble earns red. */}
          {product.readiness !== "Retail ready" ? (
            <StatusBadge
              label={product.readiness}
              tone={retailReadinessTone[product.readiness]}
              className="mt-1.5"
            />
          ) : null}
        </div>
      </Link>
    </li>
  );
}
