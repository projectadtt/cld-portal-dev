import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ImagePlate } from "@/components/media/ImagePlate";
import { BLANK_PRODUCT, ProductForm } from "@/components/products/ProductForm";
import { loadWorkspace } from "@/lib/db/workspace";
import { getClient, pageTitle } from "@/lib/selectors";

/** Always fresh: the form has to know what item numbers are already taken. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await loadWorkspace();
  return { title: pageTitle("New product") };
}

export default async function NewProductPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();

  /* A product belongs to a client. Without a workspace there is nothing to
     file it under, so the portal asks for that first. */
  if (!getClient()) redirect("/");

  return (
    <>
      <header className="mb-2">
        <Link
          href="/products"
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          Products
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Add a product.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Four things are needed to start: what it is called, its workbook item
          number, the set it sits in, and whether it can be taken to a buyer
          today. Everything else can follow later.
        </p>
      </header>

      <ProductForm
        values={BLANK_PRODUCT}
        submitLabel="Add product"
        cancelHref="/products"
        imageUrl={null}
        imagePlaceholder={<ImagePlate primary="No image yet" secondary="Optional" />}
      />
    </>
  );
}
