import Link from "next/link";

import { cn } from "@/lib/cn";
import { getRetailFitMatrix } from "@/lib/selectors";
import { fitTone, isSampleWithRetailer } from "@/lib/status";
import type { Tone } from "@/lib/status";

const FIT_TEXT: Record<Tone, string> = {
  active: "text-forest",
  neutral: "text-ink",
  attention: "text-red",
  dormant: "text-ink-faint",
};

/**
 * Product against retailer, built only from pairs that exist in the tracker.
 *
 * The empty cells are the point. A sparse grid is an honest picture of an
 * early book — it shows where the range has been taken and where it has not,
 * which is the same question the white space view asks from the other side.
 */
export function RetailFitMatrix() {
  const { retailers, rows } = getRetailFitMatrix();

  return (
    <div>
      {/* Scrolls inside its own container so the page body never does. */}
      <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            Fit and item status for every product and retailer pairing in the
            workstream
          </caption>

          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="type-label w-48 pb-2.5 pr-4 font-normal">
                Product
              </th>
              {retailers.map((retailer) => (
                <th
                  key={retailer.id}
                  scope="col"
                  className="type-label px-2 pb-2.5 align-bottom font-normal"
                >
                  <Link
                    href={"/retailers/" + retailer.id}
                    className="transition-colors hover:text-forest"
                  >
                    {retailer.shortName}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(({ product, cells }) => (
              <tr key={product.id} className="border-b border-rule-soft">
                <th scope="row" className="py-3.5 pr-4 align-top font-normal">
                  <Link
                    href={"/products/" + product.id}
                    className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                </th>

                {cells.map((record, i) => (
                  <td key={retailers[i].id} className="px-2 py-3.5 align-top">
                    {record ? (
                      <>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-[13px] leading-5",
                            /* No fit recorded reads as the quietest tone —
                               nobody has formed a view, which is not the same
                               as having formed a weak one. */
                            record.fit
                              ? FIT_TEXT[fitTone[record.fit]]
                              : FIT_TEXT.dormant,
                          )}
                        >
                          {record.fit ?? "—"}
                          {/* A sample physically with the buyer is the one
                              thing worth marking beyond fit. */}
                          {isSampleWithRetailer(record.sampleStatus) ? (
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full bg-forest"
                            />
                          ) : null}
                        </span>
                        <span className="type-label mt-1 block leading-tight">
                          {record.itemStatus}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-faint" aria-label="No relationship">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule-soft pt-4 text-[13px] text-ink-muted">
        <span className="type-label">Reading this</span>
        <span>Fit is the broker read on the account.</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-forest"
          />
          A sample is with the buyer.
        </span>
        <span>A dash means the product has not been taken to that retailer.</span>
      </p>
    </div>
  );
}
