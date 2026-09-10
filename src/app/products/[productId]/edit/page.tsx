import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImagePlate } from "@/components/media/ImagePlate";
import { ArchiveProduct } from "@/components/products/ArchiveProduct";
import { ProductForm } from "@/components/products/ProductForm";
import { loadWorkspace } from "@/lib/db/workspace";
import { assetUrl } from "@/lib/storage/assets";
import { getProduct, getProductDetail, pageTitle } from "@/lib/selectors";

/** Always fresh: a form is a picture of the record as it stands now. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/products/[productId]/edit">) {
  await loadWorkspace();
  const product = getProduct((await params).productId);
  return { title: pageTitle(product ? "Edit " + product.name : "Edit product") };
}

/** Numbers come back as strings, because that is what a form field holds. */
const asField = (value: number | undefined) =>
  value === undefined ? "" : String(value);

export default async function EditProductPage({
  params,
}: PageProps<"/products/[productId]/edit">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { productId } = await params;

  const product = getProduct(productId);
  if (!product) notFound();

  const detail = getProductDetail(productId);
  const inWorkstream = detail?.conversations.length ?? 0;

  return (
    <>
      <header className="mb-2">
        <Link
          href={"/products/" + product.id}
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          {product.name}
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Edit product.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Changes here are read by every screen that mentions this item.
        </p>
      </header>

      <ProductForm
        productId={product.id}
        values={{
          name: product.name,
          itemId: product.itemId,
          category: product.category,
          readiness: product.readiness,
          packSize: product.packSize ?? "",
          positioning: product.positioning ?? "",
          upc: product.upc ?? "",
          sourceNotes: product.sourceNotes ?? "",
          fobCost: asField(product.fobCost),
          landedCost: asField(product.landedCost),
          suggestedRetail: asField(product.suggestedRetail),
          moq: asField(product.moq),
          casePack: asField(product.casePack),
          leadTimeDays: asField(product.leadTimeDays),
        }}
        submitLabel="Save product"
        cancelHref={"/products/" + product.id}
        imageUrl={assetUrl(product.imagePath)}
        imagePlaceholder={
          <ImagePlate primary={product.category} secondary={product.itemId} />
        }
      />

      <ArchiveProduct productId={product.id} inWorkstream={inWorkstream} />
    </>
  );
}
