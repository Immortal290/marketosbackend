import { prisma } from '../../lib/prisma';
import { CreateCampaignBriefDto } from './dto/campaign_brief.dto';

export class CampaignBriefService {
  /**
   * Creates a CampaignBrief linked to a BrandProfile, then assembles the full
   * structured payload and forwards it to the agent service's streaming pipeline.
   * Returns { brief, campaign, agentResponse } so the caller can stream SSE.
   */
  async createAndLaunch(data: CreateCampaignBriefDto) {
    // 1. Fetch the brand profile to embed in the agent request
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: data.brandProfileId },
    });
    if (!brandProfile) throw new Error('BrandProfile not found');

    // 2. Persist the CampaignBrief
    const brief = await prisma.campaignBrief.create({
      data: {
        workspaceId: data.workspaceId,
        brandProfileId: data.brandProfileId,
        goal: data.goal,
        channels: data.channels,
        budget: data.budget,
        timelineStart: data.timelineStart ? new Date(data.timelineStart) : undefined,
        timelineEnd: data.timelineEnd ? new Date(data.timelineEnd) : undefined,
        keyMessage: data.keyMessage,
        offerDetails: data.offerDetails,
        kpiTarget: data.kpiTarget,
        freeTextContext: data.freeTextContext,
        rawPromptFallback: data.rawPromptFallback,
      },
    });

    // 3. Create a Campaign record linked to the brief
    const campaign = await prisma.campaign.create({
      data: {
        name: `${brandProfile.businessName} — ${data.goal} campaign`,
        workspaceId: data.workspaceId,
        status: 'ACTIVE',
        campaignBriefId: brief.id,
      },
    });

    // 4. Assemble the structured payload for the agent service
    const agentPayload = {
      brand_profile: {
        id: brandProfile.id,
        business_name: brandProfile.businessName,
        industry: brandProfile.industry,
        website_url: brandProfile.websiteUrl,
        mission: brandProfile.mission,
        usp: brandProfile.usp,
        positioning: brandProfile.positioning,
        voice_adjectives: brandProfile.voiceAdjectives,
        voice_dos: brandProfile.voiceDos,
        voice_donts: brandProfile.voiceDonts,
        logo_url: brandProfile.logoUrl,
        brand_colors: brandProfile.brandColors,
        personas: brandProfile.personas,
        competitors: brandProfile.competitors,
        compliance_region: brandProfile.complianceRegion,
        compliance_notes: brandProfile.complianceNotes,
        past_campaign_refs: brandProfile.pastCampaignRefs,
      },
      campaign_brief: {
        id: brief.id,
        goal: brief.goal,
        channels: brief.channels,
        budget: brief.budget,
        timeline_start: brief.timelineStart?.toISOString(),
        timeline_end: brief.timelineEnd?.toISOString(),
        key_message: brief.keyMessage,
        offer_details: brief.offerDetails,
        kpi_target: brief.kpiTarget,
        free_text_context: brief.freeTextContext,
      },
      // Raw prompt fallback for legacy path inside agent
      user_intent: brief.rawPromptFallback ?? brief.keyMessage ?? `${brief.goal} campaign for ${brandProfile.businessName}`,
      channels: brief.channels,
      workspace_id: data.workspaceId,
      recipient_email: data.recipientEmail,
      recipient_phone: data.recipientPhone,
      sender_name: data.senderName ?? brandProfile.businessName,
      company_name: data.companyName ?? brandProfile.businessName,
      company_address: data.companyAddress ?? '',
      unsubscribe_url: data.unsubscribeUrl ?? 'https://example.com/unsubscribe',
    };

    return { brief, campaign, agentPayload };
  }
}
