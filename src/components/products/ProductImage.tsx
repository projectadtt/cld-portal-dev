import Image from "next/image";

import type { Product } from "@/data/types";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";

/**
 * The editorial anchor for a product.
 *
 * A product may have a photograph or it may not, and the second case is not a
 * failure. Rather than a grey box with a broken-image glyph, an item without a
 * picture gets a typographic plate: its category, set in the display face, over
 * its item number. It occupies exactly the same square, so a portfolio grid
 * stays level whether none, some or all of the range has been photographed.
 *
 * The src is built from the product's storage path at render time. No filename
 * is written here, and nothing is read from /public — the picture is business
 * data, and business data lives in the database and in Storage.
 */
export function ProductImage({
  product,
  className,
  sizes = "(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw",
}: {
  product: Product;
  className?: string;
  sizes?: string;
}) {
  const src = assetUrl(product.imagePath);

  if (src) {
    return (
      <div
        className={cn(
          "relative aspect-square overflow-hidden border border-rule bg-surface",
          className,
        )}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 border border-rule bg-surface px-6 text-center",
        className,
      )}
    >
      <p className="font-display text-[15px] leading-snug text-ink-muted">
        {product.category}
      </p>
      <p className="type-label">{product.itemId}</p>
    </div>
  );
}
