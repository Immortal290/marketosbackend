export interface SpendSummary {
  totalBudget: number;
  totalSpend: number;
  remainingBudget: number;
  projectedSpend: number;
  roas: number;
  roi: number;
  activeCampaignCount: number;
  currency: string;
}

export interface ChannelAttribution {
  channel: string;
  label: string;
  revenue: number;
  pct: number;
  spend: number;
  roas: number;
  conversions: number;
  cpc: number;
  cpm: number;
}

export interface RevenueData {
  totalRevenue: number;
  byChannel: ChannelAttribution[];
  byCampaign: Array<{
    campaignId: string;
    campaignName: string;
    revenue: number;
    spend: number;
    roas: number;
    status: string;
  }>;
}

export interface RoasAnalysisData {
  overallRoas: number;
  benchmark: number;
  breakdown: Array<{
    channel: string;
    label: string;
    roas: number;
    benchmark: number;
    trend: 'up' | 'down' | 'stable';
    efficiency: string;
  }>;
  trend: Array<{
    date: string;
    roas: number;
    spend: number;
    revenue: number;
  }>;
}

export interface BudgetControlItem {
  campaignId: string;
  campaignName: string;
  budget: number;
  spent: number;
  utilization: number;
  alertThreshold: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'OVERSPENT' | 'UNCONFIGURED';
  channel?: string;
  updatedAt?: string;
}

export interface MarketTrendPlatformSpec {
  platformId: string;
  platformName: string;
  sharePct: number;
  allocatedAmount: number;
  avgCpm: number;
  avgCpc: number;
  estimatedImpressions: number;
  estimatedClicks: number;
  estimatedConversions: number;
  projectedRoas: number;
  recommendedSizes: Array<{
    format: string;
    dimensions: string;
    aspectRatio: string;
    description: string;
  }>;
}

export interface MarketTrendBudgetPlan {
  totalBudget: number;
  industry: string;
  goal: string;
  normalMarketSpend: {
    min: number;
    max: number;
    average: number;
    currency: string;
    benchmarkSummary: string;
  };
  totalEstimatedImpressions: number;
  totalEstimatedClicks: number;
  projectedOverallRoas: number;
  exactAdCosts: {
    mediaSpend: number;
    estimatedCpcAvg: number;
    estimatedCpmAvg: number;
    projectedRevenue: number;
  };
  platforms: MarketTrendPlatformSpec[];
  aiRecommendation: string;
}
