import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface SectionLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * The quiet "keep going" link that closes a summary section and hands the
 * user off to the full screen.
 */
export function SectionLink({ href, children }: SectionLinkProps) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-muted transition-colors hover:text-forest"
    >
      {children}
      <ArrowRight
        size={13}
        strokeWidth={1.75}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
