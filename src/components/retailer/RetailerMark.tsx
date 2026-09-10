import Image from "next/image";

import type { Retailer } from "@/data/types";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";

/**
 * A retailer's logo, or its initials.
 *
 * The initials come from the short name and are a deliberate treatment rather
 * than a gap: the portal will not go and fetch a real company's logo from
 * anywhere, so a mark only appears once CLD has actually been given one. Until
 * then a typographic disc is the honest thing to show, and it is quiet enough
 * to sit in a dense pipeline list without turning it into a wall of brands.
 *
 * A supplied logo is contained rather than cropped — a wordmark cut in half by
 * a circular frame is worse than no logo at all — and sits on the same disc, at
 * the same size, so rows stay level.
 *
 * Decorative — the name always sits beside it.
 */
function initials(retailer: Retailer): string {
  const words = retailer.shortName.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/);

  return (
    words.length > 1
      ? words.slice(0, 2).map((word) => word[0])
      : [...words[0].slice(0, 2)]
  )
    .join("")
    .toUpperCase();
}

const SIZES = {
  sm: "size-8 text-[11px]",
  lg: "size-14 text-[0.9375rem]",
};

export function RetailerMark({
  retailer,
  size = "lg",
  className,
}: {
  retailer: Retailer;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shape = cn(
    "shrink-0 rounded-full border border-rule bg-surface",
    SIZES[size],
    className,
  );
  const src = assetUrl(retailer.imagePath);

  if (src) {
    return (
      <span aria-hidden="true" className={cn(shape, "relative block overflow-hidden")}>
        <Image src={src} alt="" fill sizes="4rem" className="object-contain p-1" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        shape,
        "flex items-center justify-center font-display tracking-[0.02em] text-forest",
      )}
    >
      {initials(retailer)}
    </span>
  );
}
