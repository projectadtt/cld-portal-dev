import { Package } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { ProductCard } from "@/components/products/ProductCard";
import type { ProductSummary } from "@/lib/selectors";

/**
 * The portfolio grid. Three across on desktop so each product keeps a
 * generous plate and the row never turns into a shelf of thumbnails.
 */
export function ProductGrid({ summaries }: { summaries: ProductSummary[] }) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={Package}
        message="No products yet. Add the first item and it will appear here."
      />
    );
  }

  return (
    <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((summary) => (
        <ProductCard key={summary.product.id} summary={summary} />
      ))}
    </ul>
  );
}
