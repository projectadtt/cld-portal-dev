import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface SectionLinkProps {
  href: string;
  children: ReactNode;
  /**
   * Filled treatment, for the hand-off at the end of a summary section.
   *
   * Opt-in rather than the default: a dashboard panel showing a slice of a
   * longer list needs its "see the rest" to look like something you press,
   * but the same filled button on every section heading in the portal would
   * be a row of green blocks competing with the content. Quiet stays the
   * default, and the Overview's four hand-offs ask for this.
   */
  cta?: boolean;
}

/**
 * The "keep going" link that closes a summary section and hands the user off
 * to the full screen.
 */
export function SectionLink({ href, children, cta = false }: SectionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center whitespace-nowrap transition-colors",
        cta
          ? /* Square, like the portal's other primary buttons, and compact
               enough to sit on a section heading without becoming the loudest
               thing in the panel.

               No arrow inside the box: the filled shape already says "press
               me", so the glyph only crowded the words and left the padding
               looking lopsided. leading-none is what makes the label sit
               evenly — without it the inherited body line-height pads the top
               and bottom unequally against the text's own cap height. */
            "bg-forest px-3.5 py-2 text-[12px] leading-none tracking-[0.02em] text-paper transition-opacity hover:opacity-90"
          : "gap-1.5 text-[13px] text-ink-muted hover:text-forest",
      )}
    >
      {children}
      {/* The quiet link keeps its arrow: with nothing but colour to carry it,
          that is the only mark saying the text leads somewhere. */}
      {cta ? null : (
        <ArrowRight
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}
