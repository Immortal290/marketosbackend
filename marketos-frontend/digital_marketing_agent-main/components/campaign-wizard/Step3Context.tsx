import React from 'react';
import { useWizardStore } from '@/lib/campaign-wizard-store';

export function Step3Context() {
  const { campaignBrief, updateCampaignBrief } = useWizardStore();

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-black uppercase">Additional Context</h2>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">Anything else the AI should know?</label>
        <p className="font-mono text-xs opacity-70 mb-2">
          Add any supplemental nuance, specific phrases to include, or background context for this campaign.
        </p>
        <textarea 
          className="border-neo border-neo-ink p-3 font-mono text-sm min-h-[200px]"
          placeholder="e.g. We previously ran a similar campaign in 2022 but it failed because it sounded too corporate. Keep this one super casual. Mention the 'Summer Vibez' playlist somewhere."
          value={campaignBrief.freeTextContext || ''}
          onChange={e => updateCampaignBrief({ freeTextContext: e.target.value })}
        />
      </div>
    </div>
  );
}
