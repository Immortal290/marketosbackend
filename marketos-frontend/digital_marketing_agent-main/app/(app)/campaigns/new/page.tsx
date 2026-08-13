'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { WizardShell } from '@/components/campaign-wizard/WizardShell';
import { Step0BrandProfile } from '@/components/campaign-wizard/Step0BrandProfile';
import { Step1Goal } from '@/components/campaign-wizard/Step1Goal';
import { Step2Message } from '@/components/campaign-wizard/Step2Message';
import { Step3Context } from '@/components/campaign-wizard/Step3Context';
import { Step4Review } from '@/components/campaign-wizard/Step4Review';
import { useWizardStore } from '@/lib/campaign-wizard-store';
import { campaignBriefApi } from '@/lib/brand-profile-api';

export default function NewCampaignPage() {
  const router = useRouter();
  const { step, brandProfile, campaignBrief, reset } = useWizardStore();
  const [isLaunching, setIsLaunching] = useState(false);

  // Note: in a real app, we'd fetch the existing brand profile for the workspace here
  // and skip Step 0 if it exists. For this demo, we assume we might need to fill it out.

  const handleComplete = async () => {
    setIsLaunching(true);
    try {
      // Create the brief and launch the pipeline
      // We assume brandProfile is either already created and we have the ID,
      // or the backend creates it if missing (simplified here for brevity).
      // For this phase, we mock the workspaceId and brandProfileId.
      await campaignBriefApi.createAndLaunch({
        workspaceId: brandProfile.workspaceId || 'workspace-1',
        brandProfileId: brandProfile.id || 'brand-1',
        goal: campaignBrief.goal as any,
        channels: campaignBrief.channels || ['email'],
        budget: campaignBrief.budget,
        timelineStart: campaignBrief.timelineStart,
        timelineEnd: campaignBrief.timelineEnd,
        keyMessage: campaignBrief.keyMessage,
        offerDetails: campaignBrief.offerDetails,
        kpiTarget: campaignBrief.kpiTarget,
        freeTextContext: campaignBrief.freeTextContext,
      });

      toast.success('Campaign launched successfully!');
      reset();
      router.push('/campaigns');
    } catch (err: any) {
      toast.error('Failed to launch campaign: ' + err.message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          New Campaign
        </h1>
        <p className="font-mono text-sm opacity-70 mt-1">
          MarketOS Strategic Planning Wizard
        </p>
      </div>

      <WizardShell onComplete={handleComplete} isLoading={isLaunching}>
        {step === 0 && <Step0BrandProfile />}
        {step === 1 && <Step1Goal />}
        {step === 2 && <Step2Message />}
        {step === 3 && <Step3Context />}
        {step === 4 && <Step4Review />}
      </WizardShell>
    </div>
  );
}
