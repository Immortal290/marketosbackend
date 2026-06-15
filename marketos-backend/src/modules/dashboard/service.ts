import { prisma } from '../../lib/prisma';

export class DashboardService {
  async getKpis(workspaceId: string) {
    // Example aggregations
    const totalCampaigns = await prisma.campaign.count({
      where: { workspaceId },
    });

    const activeCampaigns = await prisma.campaign.count({
      where: { workspaceId, status: 'ACTIVE' },
    });

    return {
      totalCampaigns,
      activeCampaigns,
      // more KPIs can be added here
    };
  }

  async getActivityFeed(workspaceId: string) {
    // Return recent campaigns as a mock activity feed
    const recentCampaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return recentCampaigns.map(c => ({
      type: 'CAMPAIGN_CREATED',
      title: `Campaign "${c.name}" was created`,
      timestamp: c.createdAt,
    }));
  }
}
