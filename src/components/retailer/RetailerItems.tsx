import { Package } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn, meta } from "@/lib/cn";
import {
  formatDueDate,
  getOwnerName,
  type RetailerItemRow,
} from "@/lib/selectors";
import { itemStatusTone, sampleStatusTone } from "@/lib/status";

/** Nothing invented to fill a cell: an empty field reads as empty. */
function Blank() {
  return <span className="text-ink-faint">—</span>;
}

const COLUMNS = [
  { label: "Product", className: "w-52 pr-6" },
  { label: "Item status", className: "w-40 pr-6" },
  { label: "Sample", className: "w-36 pr-6" },
  { label: "Buyer signal", className: "w-36 pr-6" },
  { label: "Next action", className: "w-60" },
  { label: "", className: "w-12" },
];

/**
 * The account's Item x Retailer records — the CLD-specific chain in one
 * compact table: product, where the item stands, where its sample is, the
 * signal the buyer gave it, and what moves it forward.
 *
 * Deliberately denser and quieter than the account overview above it. The
 * buyer's actual words live in the feedback section, so this carries the
 * theme instead; the same sentence is never printed twice on one page.
 */
export function RetailerItems({
  rows,
  /** Where to go to work an item in. Absent hides the invitation. */
  newHref,
}: {
  rows: RetailerItemRow[];
  newHref?: string;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <EmptyState
          icon={Package}
          message="No items have been worked into this account yet."
        />
        {/* The empty state is where an account with nothing in it actually
            gets started, so the way forward belongs here and not only in the
            section heading above. */}
        {newHref ? (
          <Link
            href={newHref}
            className="text-sm text-forest transition-opacity hover:opacity-70"
          >
            Add the first item
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    /*
     * Scrolls inside its own container so the page body never does.
     *
     * `contain: paint` is what actually holds that promise. Without it the
     * table’s min-width propagated out to the document: at 390px the page
     * itself scrolled 481px sideways even though this box was already a
     * scroller and clipping correctly. Neither overflow:hidden here nor
     * overflow-x:clip on the body stopped it — only cutting the paint
     * containment does, because the propagation is a layout-overflow one.
     */
    <div className="-mx-6 overflow-x-auto [contain:paint] px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[52rem] border-collapse text-left">
        <caption className="sr-only">
          Every item worked into this account, with its status, sample, buyer
          signal and next action
        </caption>

        <thead>
          <tr className="border-b border-rule">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn("type-label pb-2.5 font-normal", column.className)}
              >
                {column.label || <span className="sr-only">Edit</span>}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(({ record, product, action, overdue }) => (
            <tr key={record.id} className="border-b border-rule-soft align-top">
              <th scope="row" className="py-4 pr-6 text-left font-normal">
                <Link
                  href={"/products/" + product.id}
                  className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                >
                  {product.name}
                </Link>
                {product.packSize ? (
                  <span className="type-label mt-1 block">{product.packSize}</span>
                ) : null}
              </th>

              <td className="py-4 pr-6">
                <StatusBadge
                  label={record.itemStatus}
                  tone={itemStatusTone[record.itemStatus]}
                />
              </td>

              <td className="py-4 pr-6">
                <StatusBadge
                  label={record.sampleStatus}
                  tone={sampleStatusTone[record.sampleStatus]}
                />
              </td>

              <td className="py-4 pr-6 text-[13px] leading-5">
                {record.feedbackTheme ? (
                  <span className="text-ink">{record.feedbackTheme}</span>
                ) : (
                  <span className="text-ink-faint">Nothing heard back yet</span>
                )}
              </td>

              <td className="py-4 text-[13px] leading-5">
                {action ? (
                  <>
                    <Link
                      href="/actions"
                      className="block text-ink transition-colors hover:text-forest"
                    >
                      {action.label}
                    </Link>
                    <span
                      className={cn(
                        "mt-1 block",
                        overdue ? "font-medium text-red" : "text-ink-faint",
                      )}
                    >
                      {getOwnerName(action.ownerId) +
                        " · due " +
                        formatDueDate(action.due) +
                        " · " +
                        (overdue ? "overdue" : action.status)}
                    </span>
                  </>
                ) : (
                  <>
                    {/* A pairing just entered has no dated step yet; the
                        cell says so rather than formatting a missing date. */}
                    <span className="block text-ink">
                      {record.nextAction ?? <Blank />}
                    </span>
                    <span className="mt-1 block text-ink-faint">
                      {meta(
                        getOwnerName(record.ownerId),
                        record.nextActionDate
                          ? "due " + formatDueDate(record.nextActionDate)
                          : undefined,
                      )}
                    </span>
                  </>
                )}
              </td>

              {/* The way into the item workspace, where this row is edited.
                  Kept to one quiet word: the table is read far more often
                  than it is changed. */}
              <td className="py-4 text-right">
                <Link
                  href={"/retailers/" + record.retailerId + "/items/" + record.id}
                  className="text-[13px] text-ink-faint transition-colors hover:text-forest"
                >
                  Edit
                  <span className="sr-only">{" " + product.name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
