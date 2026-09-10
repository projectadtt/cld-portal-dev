import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemCreateForm } from "@/components/workstream/ItemCreateForm";
import { loadWorkspace } from "@/lib/db/workspace";
import {
  getAllProducts,
  getRetailer,
  getRetailerItems,
  pageTitle,
} from "@/lib/selectors";

/** Always fresh: the picker has to know what this account already carries. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/retailers/[retailerId]/items/new">) {
  await loadWorkspace();
  const retailer = getRetailer((await params).retailerId);
  return {
    title: pageTitle(retailer ? "Add an item to " + retailer.name : "Add an item"),
  };
}

/**
 * Working one product into one account.
 *
 * The pairing is the only thing recorded here. Where it stands, how it fits,
 * what the buyer says and what happens next are all entered afterwards, in the
 * item workspace this page hands over to.
 */
export default async function NewWorkstreamItemPage({
  params,
}: PageProps<"/retailers/[retailerId]/items/new">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { retailerId } = await params;

  const retailer = getRetailer(retailerId);
  if (!retailer) notFound();

  /* Resolved here so the form stays a plain client component, and narrowed to
     what can actually be added: the unique constraint would refuse a pairing
     that already exists, so offering it would be offering a dead end. */
  const taken = new Set(
    getRetailerItems(retailer.id).map((item) => item.record.productId),
  );
  const products = getAllProducts()
    .filter((product) => !taken.has(product.id))
    .map((product) => ({
      id: product.id,
      itemId: product.itemId,
      name: product.name,
    }));

  return (
    <>
      <header className="mb-2">
        <Link
          href={"/retailers/" + retailer.id}
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          {retailer.name}
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Work an item into this account.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Only which item. It starts where a new relationship genuinely starts
          — not pitched, no sample, nothing said yet — and the next screen is
          where you record what has actually happened.
        </p>
      </header>

      <ItemCreateForm
        retailerId={retailer.id}
        products={products}
        cancelHref={"/retailers/" + retailer.id}
      />
    </>
  );
}
