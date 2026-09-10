import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import type { Product } from "@/data/types";
import { meta } from "@/lib/cn";
import { retailReadinessTone } from "@/lib/status";

/**
 * The opening of a product workspace: what it is, and the plate that lets a
 * client recognise it across the table in a meeting.
 */
export function ProductHeader({ product }: { product: Product }) {
  return (
    <header className="mb-12 sm:mb-14">
      <Link
        href="/products"
        className="group mb-8 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-forest"
      >
        <ArrowLeft
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className="transition-transform group-hover:-translate-x-0.5"
        />
        All products
      </Link>

      {/* One quiet way into the record. A product is read far more often than
          it is changed, so this sits beside the crumb rather than shouting
          from a toolbar. */}
      <Link
        href={"/products/" + product.id + "/edit"}
        className="type-label float-right transition-colors hover:text-forest"
      >
        Edit
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <ProductImage
          product={product}
          sizes="12rem"
          className="w-40 shrink-0 sm:w-48"
        />

        <div className="min-w-0 sm:pt-1">
          <p className="type-label mb-3">{product.category}</p>

          <h1 className="font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-ink sm:text-[2.25rem]">
            {product.name}
          </h1>

          <p className="mt-3 text-sm text-ink-muted">
            {meta(product.packSize, product.itemId)}
          </p>

          {product.positioning ? (
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
              {product.positioning}
            </p>
          ) : null}

          {/* Readiness is only stated when it is not already retail ready. */}
          {product.readiness !== "Retail ready" ? (
            <StatusBadge
              label={product.readiness}
              tone={retailReadinessTone[product.readiness]}
              className="mt-4"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
