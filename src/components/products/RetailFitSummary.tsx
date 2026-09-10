import Link from "next/link";

import { getRetailFitMatrix } from "@/lib/selectors";
import type { Fit } from "@/lib/status";

/**
 * One hue, four densities. A fit read is a single ordered judgement, so it is
 * shown as weight rather than as four different colours.
 */
const FIT_FILL: Record<Fit, string> = {
  High: "bg-forest",
  Medium: "bg-forest/45",
  Low: "bg-forest/[0.18]",
  Unknown: "bg-forest/[0.18]",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "High fit", className: FIT_FILL.High },
  { label: "Medium", className: FIT_FILL.Medium },
  { label: "Low", className: FIT_FILL.Low },
  { label: "Not taken there", className: "border border-rule" },
];

/**
 * The portfolio seen against the accounts, at a glance.
 *
 * A density grid rather than the full read: this answers "where does the
 * range sit?" in one look, and the Retail fit tab answers "and what exactly
 * is happening in that cell?". Every filled square opens the account the
 * pairing lives on.
 *
 * The empty cells are the point. A sparse grid is an honest picture of an
 * early book, and it is the same question the white space section asks from
 * the other side.
 */
export function RetailFitSummary() {
  const { retailers, rows } = getRetailFitMatrix();

  return (
    <div>
      {/* Scrolls inside its own container so the page body never does. */}
      <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <table className="min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Fit strength for every product and retailer pairing in the
            workstream
          </caption>

          <thead>
            <tr>
              <th scope="col" className="w-52 pb-3 pr-5">
                <span className="sr-only">Product</span>
              </th>
              {retailers.map((retailer) => (
                <th
                  key={retailer.id}
                  scope="col"
                  className="type-label px-1.5 pb-3 text-center font-normal"
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
              <tr key={product.id}>
                <th scope="row" className="py-1.5 pr-5 text-left font-normal">
                  <Link
                    href={"/products/" + product.id}
                    className="text-[13px] leading-snug text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                </th>

                {cells.map((record, i) => (
                  <td key={retailers[i].id} className="px-1.5 py-1.5 text-center">
                    {record ? (
                      <Link
                        href={"/retailers/" + retailers[i].id}
                        aria-label={
                          product.name +
                          " at " +
                          retailers[i].name +
                          " — " +
                          (record.fit ? record.fit + " fit" : "fit not recorded") +
                          ", " +
                          record.itemStatus
                        }
                        title={
                          (record.fit ? record.fit + " fit" : "Fit not recorded") +
                          " · " +
                          record.itemStatus
                        }
                        className={
                          "mx-auto block size-5 rounded-[2px] transition-opacity hover:opacity-70 " +
                          /* A pairing with no fit recorded still occupies its
                             cell — it exists — at the faintest weight. */
                          (record.fit ? FIT_FILL[record.fit] : FIT_FILL.Unknown)
                        }
                      />
                    ) : (
                      <span
                        aria-label={
                          product.name + " has not been taken to " + retailers[i].name
                        }
                        className="mx-auto block size-5 rounded-[2px] border border-rule"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule-soft pt-4 text-[13px] text-ink-muted">
        {LEGEND.map((entry) => (
          <span key={entry.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={"size-3 shrink-0 rounded-[2px] " + entry.className}
            />
            {entry.label}
          </span>
        ))}
      </p>
    </div>
  );
}
