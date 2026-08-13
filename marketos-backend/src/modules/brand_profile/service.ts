import { prisma } from '../../lib/prisma';
import { CreateBrandProfileDto, UpdateBrandProfileDto } from './dto/brand_profile.dto';

export class BrandProfileService {
  async create(data: CreateBrandProfileDto) {
    return prisma.brandProfile.create({
      data: {
        workspaceId: data.workspaceId,
        businessName: data.businessName,
        industry: data.industry,
        websiteUrl: data.websiteUrl,
        mission: data.mission,
        usp: data.usp,
        positioning: data.positioning,
        voiceAdjectives: data.voiceAdjectives,
        voiceDos: data.voiceDos,
        voiceDonts: data.voiceDonts,
        logoUrl: data.logoUrl,
        brandColors: data.brandColors,
        styleGuideUrl: data.styleGuideUrl,
        personas: data.personas as any,
        competitors: data.competitors as any,
        complianceRegion: data.complianceRegion,
        complianceNotes: data.complianceNotes,
        pastCampaignRefs: data.pastCampaignRefs as any,
      },
    });
  }

  async findByWorkspace(workspaceId: string) {
    return prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const profile = await prisma.brandProfile.findUnique({ where: { id } });
    if (!profile) throw new Error('BrandProfile not found');
    return profile;
  }

  async update(id: string, data: UpdateBrandProfileDto) {
    await this.findById(id); // ensure exists
    return prisma.brandProfile.update({
      where: { id },
      data: {
        ...data,
        personas: data.personas as any,
        competitors: data.competitors as any,
        pastCampaignRefs: data.pastCampaignRefs as any,
      },
    });
  }

  /**
   * Calls the Python agent service's brand scraper and returns
   * suggested autofill values WITHOUT persisting them.
   * The frontend shows the result for user confirmation/edit.
   */
  async autofill(websiteUrl: string): Promise<Record<string, unknown>> {
    const agentServiceUrl =
      process.env.AGENT_SERVICE_URL || 'http://localhost:8000';
    const resp = await fetch(`${agentServiceUrl}/v1/tools/scrape-brand-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      throw new Error(`Agent service scraper returned ${resp.status}`);
    }
    return resp.json();
  }
}
