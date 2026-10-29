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

      {/* Image Generation Model */}
      <div className="border-neo border-neo-ink p-4 bg-neo-surface-alt">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-lg font-black uppercase">Image Generation Model</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-sm font-bold uppercase">Model</label>
            <select 
              className="border-neo border-neo-ink p-3 font-mono text-sm bg-white"
              value={campaignBrief.imageModel || 'google/gemini-2.0-flash-exp:free'}
              onChange={e => updateCampaignBrief({ imageModel: e.target.value })}
            >
              <optgroup label="🔗 OpenRouter — Gemini (Recommended)">
                <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp — Free (OpenRouter Key)</option>
                <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash Image (OpenRouter Key)</option>
                <option value="google/gemini-flash-1.5-image">Gemini Flash 1.5 Image (OpenRouter Key)</option>
              </optgroup>
              <optgroup label="🔗 OpenRouter — Qwen">
                <option value="qwen/qwen-image">Qwen Image (OpenRouter Key)</option>
              </optgroup>
              <optgroup label="🔗 OpenRouter — Meta">
                <option value="meta/muse-image-1.0-eval-20260824">Meta Muse Image 1.0 (OpenRouter Key)</option>
              </optgroup>
              <optgroup label="🔗 OpenRouter — FLUX">
                <option value="black-forest-labs/flux-schnell">FLUX Schnell (OpenRouter Key)</option>
                <option value="black-forest-labs/flux-1.1-pro">FLUX 1.1 Pro (OpenRouter Key)</option>
              </optgroup>
              <optgroup label="💰 OpenAI — Direct Key">
                <option value="dall-e-3">DALL-E 3 (~$0.040/image)</option>
                <option value="dall-e-2">DALL-E 2 (~$0.018/image)</option>
              </optgroup>
              <optgroup label="🤗 HuggingFace — hf_ Token">
                <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell via HuggingFace</option>
              </optgroup>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-mono text-sm font-bold uppercase">Image API Key</label>
            <input 
              type="password"
              className="border-neo border-neo-ink p-3 font-mono text-sm bg-white"
              value={campaignBrief.imageApiKey || ''}
              placeholder="Paste your OpenRouter / API key..."
              onChange={e => updateCampaignBrief({ imageApiKey: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
    );
}
