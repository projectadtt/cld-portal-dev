"use client";

import {
  Clock,
  Compass,
  Lightbulb,
  FileText,
  ListChecks,
  Network,
  NotebookPen,
  Package,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/**
 * The portal destinations (project_specs.md §6/§25), ordered the way the work
 * actually runs: what we sell, who carries it, where it is going and how it
 * is tracked; then the read drawn from it; then the work and the reporting
 * that come out of it; and last the record of what has already happened.
 * Nothing else — future modules stay out of the prototype.
 */
const NAV = [
  { href: "/", label: "Overview", icon: Compass },
  { href: "/products", label: "Products", icon: Package },
  { href: "/brokers", label: "Brokers", icon: Users },
  { href: "/retailers", label: "Retailers", icon: Store },
  { href: "/workstream", label: "Retail Workstream", icon: Network },
  { href: "/market-insights", label: "Market Insights", icon: Lightbulb },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/activity", label: "Activity", icon: Clock },
  { href: "/meetings", label: "Meetings & Notes", icon: NotebookPen },
] as const;

/**
 * The only client component in the shell: active state has to be derived from
 * the current route, which needs usePathname.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      /* Below lg the nav is a horizontal strip. Paint containment keeps its
         scrolled-out items from widening the document, the same propagation
         that made the account page scroll sideways; above lg it is an ordinary
         column and must not clip anything. */
      className="flex overflow-x-auto [contain:paint] lg:mt-8 lg:flex-col lg:overflow-x-visible lg:[contain:none]"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            /* The indicator changes edge with the axis: a bottom rule while the
               nav is a horizontal strip, a left rule once it is a column.
               Inactive items carry the same border in transparent, so the
               labels stay on one line and nothing shifts as you navigate.

               On the Forest rail the active treatment inverts rather than
               disappears: the pale-green ground becomes a pale-green wash over
               the brand colour, and the indicator and label go to Paper, which
               is the strongest mark available against it. */
            className={cn(
              "group flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-6 py-3.5 text-sm transition-colors",
              "lg:border-b-0 lg:border-l-[3px] lg:px-8 lg:py-2.5",
              active
                ? "border-forest-tint bg-forest-tint/15 font-semibold text-paper"
                : "border-transparent text-paper/65 hover:bg-paper/10 hover:text-paper",
            )}
          >
            <Icon
              size={16}
              strokeWidth={active ? 2 : 1.75}
              className={
                active
                  ? "text-forest-tint"
                  : "text-paper/45 transition-colors group-hover:text-paper/75"
              }
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
