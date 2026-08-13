import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BrandProfile, CampaignBrief } from './brand-profile-api';

interface WizardState {
  step: number;
  brandProfile: Partial<BrandProfile>;
  campaignBrief: Partial<CampaignBrief>;
  
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  updateBrandProfile: (data: Partial<BrandProfile>) => void;
  updateCampaignBrief: (data: Partial<CampaignBrief>) => void;
  
  reset: () => void;
}

const defaultBrandProfile: Partial<BrandProfile> = {
  voiceAdjectives: [],
  voiceDos: [],
  voiceDonts: [],
  brandColors: [],
  personas: [{ name: '', demographics: '', painPoints: '', goals: '' }],
  competitors: [],
  complianceRegion: 'none',
};

const defaultCampaignBrief: Partial<CampaignBrief> = {
  channels: [],
  goal: 'awareness',
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      step: 0,
      brandProfile: { ...defaultBrandProfile },
      campaignBrief: { ...defaultCampaignBrief },
      
      setStep: (step) => set({ step }),
      nextStep: () => set((state) => ({ step: state.step + 1 })),
      prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
      
      updateBrandProfile: (data) => 
        set((state) => ({ 
          brandProfile: { ...state.brandProfile, ...data } 
        })),
        
      updateCampaignBrief: (data) => 
        set((state) => ({ 
          campaignBrief: { ...state.campaignBrief, ...data } 
        })),
        
      reset: () => set({ 
        step: 0, 
        brandProfile: { ...defaultBrandProfile }, 
        campaignBrief: { ...defaultCampaignBrief } 
      }),
    }),
    {
      name: 'marketos-campaign-wizard',
    }
  )
);
