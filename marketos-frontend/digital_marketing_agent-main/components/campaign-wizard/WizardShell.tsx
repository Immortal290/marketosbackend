import React from 'react';
import { useWizardStore } from '@/lib/campaign-wizard-store';
import { NeoButton } from '@/components/ui/NeoButton';

interface WizardShellProps {
  children: React.ReactNode;
  onComplete: () => void;
  isLoading?: boolean;
}

const steps = [
  'Brand Profile',
  'Goal & Channels',
  'Message & Offer',
  'Additional Context',
  'Review & Launch'
];

export function WizardShell({ children, onComplete, isLoading }: WizardShellProps) {
  const { step, nextStep, prevStep } = useWizardStore();
  const isLastStep = step === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      nextStep();
    }
  };

  return (
    <div className="mx-auto max-w-4xl w-full flex flex-col gap-8 theme-pastel">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between border-neo border-neo-ink bg-white p-4">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-col items-center flex-1 relative">
            <div 
              className={`h-8 w-8 rounded-full border-neo border-neo-ink flex items-center justify-center font-bold text-sm z-10
                ${i === step ? 'bg-neo-accent-pink text-black' : 
                  i < step ? 'bg-neo-accent-cyan text-black' : 'bg-neo-surface-alt text-black/50'}`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] mt-2 font-mono uppercase tracking-tight hidden md:block
              ${i === step ? 'font-black' : 'font-medium opacity-50'}`}>
              {label}
            </span>
            {i !== steps.length - 1 && (
              <div className={`absolute top-4 left-1/2 w-full h-[2px] -z-10
                ${i < step ? 'bg-neo-ink' : 'bg-neo-ink/20'}`} 
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white border-neo border-neo-ink p-6 md:p-8 min-h-[400px]">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <NeoButton 
          variant="secondary" 
          onClick={prevStep} 
          disabled={step === 0 || isLoading}
        >
          Back
        </NeoButton>
        <NeoButton 
          variant="primary" 
          onClick={handleNext}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : (isLastStep ? 'Launch Campaign' : 'Next Step')}
        </NeoButton>
      </div>
    </div>
  );
}
