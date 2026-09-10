import Link from "next/link";

import { cn } from "@/lib/cn";
import { getBuyerSignals, getFeedbackThemes } from "@/lib/selectors";

const COLUMNS = [
  { label: "Signal", className: "w-36 pr-4" },
  { label: "Product", className: "w-44 pr-4" },
  { label: "Account", className: "w-28 pr-4" },
  { label: "What the buyer said", className: "" },
];

/**
 * The evidence layer: every buyer response on the tracker, in one place.
 *
 * Ordered by how far the item has travelled, so the responses carrying the
 * most decision weight lead.
 *
 * The line above the table is itself a finding. No theme has yet been raised
 * at a second account, which is why the reads above group by concern rather
 * than by theme label — and it is the first thing that would change as the
 * book grows.
 */
export function BuyerSignalTable() {
  const signals = getBuyerSignals();
  const themes = getFeedbackThemes();
  const repeated = themes.filter((t) => t.count > 1);

  return (
    <div>
      <p className="max-w-[74ch] text-[13px] leading-relaxed text-ink-muted">
        {signals.length +
          " responses across " +
          themes.length +
          " distinct concerns" +
          (repeated.length === 0
            ? " — none yet raised at a second account."
            : ", " +
              repeated.length +
              " now raised at more than one: " +
              repeated.map((t) => t.theme).join(", ") +
              ".")}
      </p>

      {/* Scrolls inside its own container so the page body never does. */}
      <div className="-mx-6 mt-5 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            Every buyer response on the tracker, with the product and account it
            was said about
          </caption>

          <thead>
            <tr className="border-b border-rule">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={cn(
                    "type-label pb-2.5 font-normal",
                    column.className,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {signals.map(({ record, product, retailer, quote, theme }) => (
              <tr
                key={record.id}
                className="border-b border-rule-soft align-top"
              >
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  <span className="text-[13px] leading-5 text-ink">
                    {theme ?? "—"}
                  </span>
                </th>

                <td className="py-2.5 pr-4 text-[13px] leading-5">
                  <Link
                    href={"/products/" + product.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                </td>

                <td className="py-2.5 pr-4 text-[13px] leading-5">
                  <Link
                    href={"/retailers/" + retailer.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {retailer.shortName}
                  </Link>
                </td>

                <td className="py-2.5">
                  <blockquote className="text-[13px] leading-5 text-ink-muted">
                    {"“" + quote + "”"}
                  </blockquote>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
