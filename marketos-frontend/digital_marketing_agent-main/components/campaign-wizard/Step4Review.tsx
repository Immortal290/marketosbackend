import React from 'react';
import { useWizardStore } from '@/lib/campaign-wizard-store';

export function Step4Review() {
  const { brandProfile, campaignBrief, setStep } = useWizardStore();

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-black uppercase">Review & Launch</h2>

      <div className="flex flex-col gap-6">
        
        {/* Brand Profile Summary */}
        <div className="border-neo border-neo-ink p-4 bg-neo-surface">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-mono text-lg font-bold uppercase">Brand Profile</h3>
            <button className="text-sm underline font-bold" onClick={() => setStep(0)}>Edit</button>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm font-mono">
            <span className="opacity-70">Business Name:</span>
            <span className="font-bold">{brandProfile.businessName || 'N/A'}</span>
            
            <span className="opacity-70">Industry:</span>
            <span className="font-bold">{brandProfile.industry || 'N/A'}</span>
            
            <span className="opacity-70">Voice:</span>
            <span className="font-bold">{brandProfile.voiceAdjectives?.join(', ') || 'N/A'}</span>
          </div>
        </div>

        {/* Campaign Goal Summary */}
        <div className="border-neo border-neo-ink p-4 bg-neo-surface">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-mono text-lg font-bold uppercase">Goal & Channels</h3>
            <button className="text-sm underline font-bold" onClick={() => setStep(1)}>Edit</button>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm font-mono">
            <span className="opacity-70">Goal:</span>
            <span className="font-bold uppercase">{campaignBrief.goal}</span>
            
            <span className="opacity-70">Channels:</span>
            <span className="font-bold">{campaignBrief.channels?.join(', ') || 'N/A'}</span>
            
            <span className="opacity-70">Budget:</span>
            <span className="font-bold">{campaignBrief.budget ? `$${campaignBrief.budget}` : 'N/A'}</span>
          </div>
        </div>

        {/* Message Summary */}
        <div className="border-neo border-neo-ink p-4 bg-neo-surface">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-mono text-lg font-bold uppercase">Message</h3>
            <button className="text-sm underline font-bold" onClick={() => setStep(2)}>Edit</button>
          </div>
          <div className="text-sm font-mono whitespace-pre-wrap">
            {campaignBrief.keyMessage || 'No key message provided.'}
          </div>
          {campaignBrief.offerDetails && (
            <div className="mt-4 pt-4 border-t-2 border-neo-ink border-dashed text-sm font-mono">
              <span className="font-bold opacity-70">Offer: </span>
              {campaignBrief.offerDetails}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
