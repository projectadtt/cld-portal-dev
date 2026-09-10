import { ArrowDown } from "lucide-react";
import Link from "next/link";

import { getReportLibrary } from "@/lib/selectors";

/**
 * The contents page of a consulting report.
 *
 * Each row names what the report answers and what is inside it, then drops
 * to that section. The live workspace link belongs to the section itself, so
 * the index does one job: deciding what to read.
 */
export function ReportLibrary() {
  return (
    <ol className="border-t border-rule-soft">
      {getReportLibrary().map((entry, i) => (
        <li key={entry.id} className="border-b border-rule-soft">
          <Link
            href={"#" + entry.id}
            className="group flex items-start gap-5 py-4 transition-colors"
          >
            <span
              aria-hidden="true"
              className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full border border-rule font-display text-[13px] text-forest"
            >
              {i + 1}
            </span>

            <div className="grid min-w-0 flex-1 gap-x-10 gap-y-1 lg:grid-cols-[1.4fr_1fr]">
              <div className="min-w-0">
                <h3 className="font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink transition-colors group-hover:text-forest">
                  {entry.title}
                </h3>
                <p className="mt-1 max-w-[52ch] text-[13px] leading-5 text-ink-muted">
                  {entry.description}
                </p>
              </div>

              <p className="type-label lg:pt-1">{entry.contains}</p>
            </div>

            <ArrowDown
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="mt-1.5 shrink-0 text-ink-faint transition-colors group-hover:text-forest"
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
