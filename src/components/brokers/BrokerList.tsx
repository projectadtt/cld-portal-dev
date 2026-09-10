import { Users } from "lucide-react";

import { BrokerPortfolioCard } from "@/components/brokers/BrokerPortfolioCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { getBrokerPortfolios } from "@/lib/selectors";

/**
 * The coordination layer: every resource CLD has on this client, and the book
 * each one is carrying. Ordered by how much of the work they hold.
 */
export function BrokerList() {
  const portfolios = getBrokerPortfolios();

  if (portfolios.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message="No brokers assigned yet. Add the people carrying this client's retail work and their books will appear here."
      />
    );
  }

  return (
    <ul>
      {portfolios.map((portfolio) => (
        <BrokerPortfolioCard key={portfolio.broker.id} portfolio={portfolio} />
      ))}
    </ul>
  );
}
