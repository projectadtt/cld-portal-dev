"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export interface FilterOption {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

/**
 * One filter menu, shared by every screen that filters a list.
 *
 * A client component for one reason: the panel has to close when a choice is
 * made. Built with <details> this stayed open across the navigation and sat
 * on top of the results the client had just asked for.
 *
 * Closing is handled three ways, because all three are how people actually
 * dismiss a menu: choosing an option, clicking away, and pressing Escape.
 * The options themselves stay real links, so filtering still lives in the URL
 * and the surrounding page stays server-rendered.
 *
 * They navigate without scrolling: a filter rewrites the list under the
 * controls, and jumping to the top of the page loses the reader's place.
 */
export function FilterMenu({
  label,
  options,
}: {
  /** Shown when nothing is selected, e.g. "All brokers". */
  label: string;
  options: FilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((option) => option.selected);
  const active = selected !== undefined && selected.key !== "all";

  return (
    <div ref={root} className="group relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm border px-3 py-1.5 text-[13px] leading-5 transition-colors",
          active
            ? "border-forest bg-forest-tint font-medium text-forest"
            : "border-rule text-ink-muted hover:border-ink-faint hover:text-ink",
        )}
      >
        {active ? selected.label : label}
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="absolute left-0 z-20 mt-1 min-w-full whitespace-nowrap border border-rule bg-paper py-1 shadow-[0_2px_10px_rgba(21,24,21,0.06)]">
          {options.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              aria-current={option.selected ? "true" : undefined}
              onClick={() => setOpen(false)}
              /* Filtering rewrites the list in place, so the page must not
                 jump to the top — the client is already looking at it. */
              scroll={false}
              className={cn(
                "block px-3 py-1.5 text-[13px] leading-5 transition-colors",
                option.selected
                  ? "font-medium text-forest"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
