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
         column and must not clip anything.

         No scrollbar here, deliberately. The rail is short enough to hold all
         ten items outright, and a list that fits is worth more than one that
         scrolls — so the room comes out of the spacing instead. */
      className="flex overflow-x-auto [contain:paint] lg:mt-4 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:px-4 lg:[contain:none]"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            /* Two shapes for two axes. While the nav is a horizontal strip the
               active item is marked by a rule along its bottom edge, which is
               the only edge a strip can carry. Once it is a column it becomes
               an inset rounded item, and the mark moves inside it: a short
               pill against its left edge, because a border on a rounded box
               bends around the corners and stops reading as an indicator.

               Inactive items keep the bottom border in transparent so nothing
               shifts as you navigate the strip; in the column they need no
               reservation, since the pill is positioned rather than laid out. */
            className={cn(
              "group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-6 py-3.5 text-sm transition-colors",
              "lg:rounded-lg lg:border-b-0 lg:px-3.5 lg:py-2",
              active
                ? "border-forest-tint bg-forest-tint/15 font-semibold text-paper"
                : "border-transparent text-paper/65 hover:bg-paper/10 hover:text-paper",
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-0 hidden h-5 w-[3px] -translate-y-1/2 rounded-full bg-forest-tint lg:block"
              />
            ) : null}

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
