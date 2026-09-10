import Image from "next/image";

import type { Broker } from "@/data/types";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";

/**
 * A broker's face, or their initials as a quiet forest disc.
 *
 * The initials are the design, not a placeholder waiting to be replaced: one
 * brand colour for everyone rather than a colour per person, because the mark
 * is there to make a name findable in a list, not to become a palette. A
 * photograph, when there is one, sits in exactly the same circle at exactly the
 * same size, so a roster with three photographs and two sets of initials still
 * reads as one list.
 *
 * A photograph is cropped to fill the disc — a face survives it, and the
 * alternative leaves a portrait floating in a circle. This is the one place
 * this treatment differs from RetailerMark, where a wordmark must be contained
 * rather than cut.
 *
 * Decorative either way — the name always sits beside it, so it stays out of
 * the accessibility tree.
 */

/**
 * Initials are optional on the record, so they are derived when absent.
 *
 * Taken from the short name, exactly as RetailerMark takes a retailer's, which
 * keeps a broker entered without initials from rendering an empty disc. Not an
 * invented value: it is a typographic treatment of a name that is always
 * there, and the moment real initials are recorded they win.
 */
function initials(broker: Broker): string {
  if (broker.initials) return broker.initials;

  const words = broker.shortName.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/);

  return (
    words.length > 1
      ? words.slice(0, 2).map((word) => word[0])
      : [...words[0].slice(0, 2)]
  )
    .join("")
    .toUpperCase();
}

const SIZES = {
  sm: "size-7 text-[11px]",
  lg: "size-14 text-[0.9375rem]",
};

export function BrokerAvatar({
  broker,
  size = "sm",
  className,
}: {
  broker: Broker;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shape = cn("shrink-0 rounded-full", SIZES[size], className);
  const src = assetUrl(broker.imagePath);

  if (src) {
    return (
      <span aria-hidden="true" className={cn(shape, "relative block overflow-hidden bg-surface")}>
        <Image src={src} alt="" fill sizes="4rem" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        shape,
        "flex items-center justify-center bg-forest font-medium tracking-[0.04em] text-paper",
      )}
    >
      {initials(broker)}
    </span>
  );
}
