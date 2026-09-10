import Link from "next/link";

import { cn } from "@/lib/cn";
import { getChannelSignals } from "@/lib/selectors";

const NUMERIC = [
  { key: "items", label: "Items" },
  { key: "samplesOut", label: "Samples out" },
  { key: "withFeedback", label: "Heard back" },
  { key: "inPricing", label: "In pricing" },
] as const;

/** A zero is left faint rather than bold: nothing there is not a result. */
function Count({ value }: { value: number }) {
  return (
    <span className={cn("tabular-nums", value === 0 ? "text-ink-faint" : "text-ink")}>
      {value}
    </span>
  );
}

/**
 * The same tracker cut by channel instead of by account.
 *
 * The channel names are whatever the retailer records already say — no new
 * taxonomy is laid over them. Every figure counts records at the accounts in
 * that channel, so this shows where the conversation has actually reached
 * commercial ground and where it has not started.
 *
 * Ordered by how much has been heard back, because that is the column that
 * says which channel is really engaging.
 */
export function ChannelSignalTable() {
  const rows = getChannelSignals();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">
          Workstream records and buyer responses by retail channel
        </caption>

        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="type-label w-52 pb-2.5 pr-5 font-normal">
              Channel
            </th>
            {NUMERIC.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="type-label w-24 pb-2.5 pl-4 text-right font-normal"
              >
                {column.label}
              </th>
            ))}
            <th scope="col" className="type-label w-32 pb-2.5 pl-6 font-normal">
              Attention
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.channel} className="border-b border-rule-soft align-top">
              <th scope="row" className="py-2.5 pr-5 text-left font-normal">
                <span className="text-sm leading-snug text-ink">
                  {row.channel}
                </span>
                <span className="type-label mt-1 flex flex-wrap gap-x-1.5">
                  {row.retailers.map((retailer, i) => (
                    <Link
                      key={retailer.id}
                      href={"/retailers/" + retailer.id}
                      className="transition-colors hover:text-forest"
                    >
                      {retailer.shortName +
                        (i < row.retailers.length - 1 ? "," : "")}
                    </Link>
                  ))}
                </span>
              </th>

              {NUMERIC.map((column) => (
                <td
                  key={column.key}
                  className="py-2.5 pl-4 text-right text-sm leading-5"
                >
                  <Count value={row[column.key]} />
                </td>
              ))}

              <td className="py-2.5 pl-6 text-[13px] leading-5">
                {row.needsAttention === 0 && row.overdue === 0 ? (
                  <span className="text-ink-faint">Clear</span>
                ) : (
                  <span className="font-medium text-red">
                    {[
                      row.needsAttention > 0
                        ? row.needsAttention +
                          (row.needsAttention === 1
                            ? " account"
                            : " accounts")
                        : "",
                      row.overdue > 0 ? row.overdue + " overdue" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
