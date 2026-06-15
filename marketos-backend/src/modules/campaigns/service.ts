import { prisma } from '../../lib/prisma';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

export class CampaignsService {
  async getAll(workspaceId: string) {
    return prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, workspaceId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId },
    });
    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  }

  async create(data: CreateCampaignDto) {
    return prisma.campaign.create({
      data: {
        name: data.name,
        workspaceId: data.workspaceId,
      },
    });
  }

  async update(id: string, workspaceId: string, data: UpdateCampaignDto) {
    await this.getById(id, workspaceId); // Ensure it exists and belongs to workspace
    return prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, workspaceId: string) {
    await this.getById(id, workspaceId); // Ensure it exists and belongs to workspace
    return prisma.campaign.delete({
      where: { id },
    });
  }
}
