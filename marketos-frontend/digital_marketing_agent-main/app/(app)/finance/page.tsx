import { FinanceView, FinanceTab } from "@/components/finance/FinanceView";

export default function FinancePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = (searchParams?.tab as FinanceTab) || "spend";
  return <FinanceView initialTab={tab} />;
}
