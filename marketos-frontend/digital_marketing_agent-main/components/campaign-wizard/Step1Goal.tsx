import React from 'react';
import { useWizardStore } from '@/lib/campaign-wizard-store';

export function Step1Goal() {
  const { campaignBrief, updateCampaignBrief } = useWizardStore();

  const handleGoalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCampaignBrief({ goal: e.target.value as any });
  };

  const handleChannelToggle = (channel: string) => {
    const current = campaignBrief.channels || [];
    const next = current.includes(channel) 
      ? current.filter(c => c !== channel)
      : [...current, channel];
    updateCampaignBrief({ channels: next });
  };

  const channels = ['email', 'sms', 'voice', 'whatsapp', 'social'];

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-black uppercase">Goal & Channels</h2>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">Primary Goal</label>
        <select 
          className="border-neo border-neo-ink p-3 font-mono text-sm bg-white"
          value={campaignBrief.goal}
          onChange={handleGoalChange}
        >
          <option value="awareness">Awareness</option>
          <option value="leads">Lead Generation</option>
          <option value="sales">Sales / Conversion</option>
          <option value="retention">Retention / Loyalty</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-sm font-bold uppercase">Target Channels</label>
        <div className="flex flex-wrap gap-4">
          {channels.map(ch => (
            <label key={ch} className="flex items-center gap-2 cursor-pointer border-neo border-neo-ink p-2 px-4 hover:bg-neo-surface-alt">
              <input 
                type="checkbox" 
                checked={campaignBrief.channels?.includes(ch)} 
                onChange={() => handleChannelToggle(ch)} 
                className="w-4 h-4"
              />
              <span className="font-mono uppercase">{ch}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-sm font-bold uppercase">Budget ($)</label>
          <input 
            type="number" 
            className="border-neo border-neo-ink p-2 font-mono text-sm"
            value={campaignBrief.budget || ''}
            onChange={e => updateCampaignBrief({ budget: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-sm font-bold uppercase">Start Date</label>
          <input 
            type="date" 
            className="border-neo border-neo-ink p-2 font-mono text-sm"
            value={campaignBrief.timelineStart ? new Date(campaignBrief.timelineStart).toISOString().split('T')[0] : ''}
            onChange={e => updateCampaignBrief({ timelineStart: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-mono text-sm font-bold uppercase">End Date</label>
          <input 
            type="date" 
            className="border-neo border-neo-ink p-2 font-mono text-sm"
            value={campaignBrief.timelineEnd ? new Date(campaignBrief.timelineEnd).toISOString().split('T')[0] : ''}
            onChange={e => updateCampaignBrief({ timelineEnd: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
      </div>
    </div>
  );
}
