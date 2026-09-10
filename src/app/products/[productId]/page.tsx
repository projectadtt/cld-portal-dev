import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductConversations } from "@/components/products/ProductConversations";
import { ProductHeader } from "@/components/products/ProductHeader";
import { EmptyState } from "@/components/primitives/EmptyState";
import { MetaPair } from "@/components/primitives/MetaPair";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { ActionList } from "@/components/shared/ActionList";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { cn } from "@/lib/cn";
import { loadWorkspace } from "@/lib/db/workspace";
import { getProductDetail } from "@/lib/selectors";
import { itemStatusTone } from "@/lib/status";
import { Lightbulb } from "lucide-react";

export async function generateMetadata({
  params,
}: PageProps<"/products/[productId]">) {
  await loadWorkspace();
  const detail = getProductDetail((await params).productId);
  return { title: detail ? detail.product.name + " — Products" : "Product" };
}

/**
 * Product workspace.
 *
 * Reads the chain the portal is built on — product to retailer to broker to
 * sample to feedback to action — from the product end. Every section is the
 * same tracker the workstream screen uses, filtered to this item.
 */
/** One shared way of saying a figure has not been recorded yet. */
const notSet = <span className="text-ink-faint">Not recorded</span>;

export default async function ProductDetailPage({
  params,
}: PageProps<"/products/[productId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const detail = getProductDetail((await params).productId);
  if (!detail) notFound();

  const { product, summary, conversations, openActions, signals, activities } =
    detail;

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: "Retailers",
      value:
        summary.retailerCount === 0
          ? "None yet"
          : summary.retailerCount === 1
            ? "1 retailer"
            : summary.retailerCount + " retailers",
    },
    {
      label: "Samples with buyers",
      value: summary.samplesOut === 0 ? "None out" : String(summary.samplesOut),
    },
    {
      label: "Buyer feedback",
      value:
        summary.feedbackCount === 0
          ? "None yet"
          : summary.feedbackCount === 1
            ? "1 response"
            : summary.feedbackCount + " responses",
    },
    {
      label: "Furthest status",
      value: summary.furthestStatus ? (
        <StatusBadge
          label={summary.furthestStatus}
          tone={itemStatusTone[summary.furthestStatus]}
        />
      ) : (
        <StatusBadge label="Not pitched" tone="dormant" />
      ),
    },
  ];

  return (
    <>
      <ProductHeader product={product} />

      <div className="grid grid-cols-2 border-y border-rule sm:grid-cols-4">
        {facts.map((fact, i) => (
          <div
            key={fact.label}
            className={cn(
              "py-6",
              i % 2 === 1 && "border-l border-rule pl-5",
              "sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0",
            )}
          >
            <MetaPair label={fact.label}>{fact.value}</MetaPair>
          </div>
        ))}
      </div>

      <div className="mt-14 space-y-14 lg:mt-16 lg:space-y-16">
        <section>
          <SectionHeader
            title="Retail conversations"
            description="Every account this product is in front of, and where each one stands."
            lead
          />
          <ProductConversations conversations={conversations} />
        </section>

        <div className="grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
          <section>
            <SectionHeader
              title="Signals"
              description="Patterns read across more than one account."
            />
            {signals.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                message="No cross-account signal reads on this product yet."
              />
            ) : (
              <ul className="space-y-6">
                {signals.map((signal) => (
                  <li
                    key={signal.id}
                    className="border-t border-rule-soft pt-5 first:border-t-0 first:pt-0"
                  >
                    <p className="type-label">
                      {signal.type + " · " + signal.confidence + " confidence"}
                    </p>
                    <h3 className="mt-1.5 font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink">
                      {signal.title}
                    </h3>
                    <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-ink-muted">
                      {signal.signal}
                    </p>
                    <p className="mt-3 max-w-[58ch] border-l-2 border-forest pl-4 text-sm leading-relaxed text-ink">
                      {signal.recommendedAction}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader
              title="Next move"
              description="Open work tied to this product."
            />
            <ActionList
              actions={openActions}
              emptyMessage="No open actions on this product."
            />

            {/* Commercial terms are often unknown when an item first enters a
                conversation, so each one renders as absent rather than as a
                zero. A missing margin is not a margin of nought. */}
            <div className="mt-8 border-t border-rule-soft pt-5">
              <p className="type-label">Commercial terms</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Assumption label="Suggested retail">
                  {product.suggestedRetail === undefined
                    ? notSet
                    : "$" + product.suggestedRetail.toFixed(2)}
                </Assumption>
                <Assumption label="Retailer margin">
                  {product.retailerMargin === undefined
                    ? notSet
                    : Math.round(product.retailerMargin * 100) + "%"}
                </Assumption>
                <Assumption label="MOQ">
                  {product.moq === undefined
                    ? notSet
                    : product.moq.toLocaleString("en-US") + " units"}
                </Assumption>
                <Assumption label="Lead time">
                  {product.leadTimeDays === undefined
                    ? notSet
                    : product.leadTimeDays + " days"}
                </Assumption>
              </dl>
            </div>
          </section>
        </div>

        <section>
          <SectionHeader
            title="Activity"
            description="Everything logged against this product, most recent first."
          />
          <div className="max-w-[70ch]">
            <ActivityTimeline
              activities={activities}
              emptyMessage="No activity recorded against this product yet."
            />
          </div>
        </section>

        <p>
          <SectionLink href="/products?view=white-space">
            See where the portfolio may have room to move next
          </SectionLink>
        </p>
      </div>
    </>
  );
}

function Assumption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
