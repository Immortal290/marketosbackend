import React from 'react';
import { useWizardStore } from '@/lib/campaign-wizard-store';

export function Step2Message() {
  const { campaignBrief, updateCampaignBrief } = useWizardStore();

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-black uppercase">Message & Offer</h2>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">Key Message (What are we saying?)</label>
        <textarea 
          className="border-neo border-neo-ink p-3 font-mono text-sm min-h-[120px]"
          placeholder="e.g. We are launching our new summer collection featuring sustainable materials..."
          value={campaignBrief.keyMessage || ''}
          onChange={e => updateCampaignBrief({ keyMessage: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">Offer Details (Optional)</label>
        <textarea 
          className="border-neo border-neo-ink p-3 font-mono text-sm min-h-[80px]"
          placeholder="e.g. 20% off all summer items using code SUMMER20"
          value={campaignBrief.offerDetails || ''}
          onChange={e => updateCampaignBrief({ offerDetails: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">KPI Target (Optional)</label>
        <input 
          type="text" 
          className="border-neo border-neo-ink p-3 font-mono text-sm"
          placeholder="e.g. 3% CTR, 500 signups"
          value={campaignBrief.kpiTarget || ''}
          onChange={e => updateCampaignBrief({ kpiTarget: e.target.value })}
        />
      </div>
    </div>
  );
}
