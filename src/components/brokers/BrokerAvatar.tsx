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
 * Decorative either way — the name always sits beside it, so it stays out of
 * the accessibility tree.
 */
export function BrokerAvatar({
  broker,
  className,
}: {
  broker: Broker;
  className?: string;
}) {
  const shape = cn("size-7 shrink-0 rounded-full", className);
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
        "flex items-center justify-center bg-forest text-[11px] font-medium tracking-[0.04em] text-paper",
      )}
    >
      {broker.initials}
    </span>
  );
}
