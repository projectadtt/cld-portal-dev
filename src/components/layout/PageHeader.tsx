import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Quiet context line above the title, e.g. the client name. */
  eyebrow?: string;
  title: string;
  /** One or two sentences of supporting context. Kept to a readable measure. */
  description?: string;
  /** Optional right-side controls (filters, actions). */
  children?: ReactNode;
}

/**
 * The editorial opening of every screen: Fraunces title, quiet supporting
 * copy, optional controls aligned to the right on desktop.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-12 flex flex-col gap-6 sm:mb-14 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        {eyebrow ? <p className="type-label mb-3">{eyebrow}</p> : null}

        <h1 className="font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>

      {children ? <div className="shrink-0 md:pb-1.5">{children}</div> : null}
    </header>
  );
}
