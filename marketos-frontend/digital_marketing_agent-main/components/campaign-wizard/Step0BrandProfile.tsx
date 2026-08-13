import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWizardStore } from '@/lib/campaign-wizard-store';
import { NeoInput } from '@/components/ui/NeoInput';
import { NeoButton } from '@/components/ui/NeoButton';
import { brandProfileApi } from '@/lib/brand-profile-api';
import { toast } from 'sonner';

const schema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  industry: z.string().min(1, 'Industry is required'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  mission: z.string().optional(),
  usp: z.string().optional(),
  voiceAdjectives: z.string(),
  complianceRegion: z.enum(['none', 'EU-GDPR', 'US-HIPAA', 'US-FINRA', 'other']),
  personas: z.array(z.object({
    name: z.string().min(1, 'Name required'),
    demographics: z.string(),
    painPoints: z.string(),
    goals: z.string()
  })),
  competitors: z.array(z.object({
    name: z.string().min(1, 'Name required'),
    url: z.string().optional()
  }))
});

type FormValues = z.input<typeof schema>;

export function Step0BrandProfile() {
  const { brandProfile, updateBrandProfile } = useWizardStore();
  const [isScraping, setIsScraping] = React.useState(false);

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: brandProfile.businessName || '',
      industry: brandProfile.industry || '',
      websiteUrl: brandProfile.websiteUrl || '',
      mission: brandProfile.mission || '',
      usp: brandProfile.usp || '',
      voiceAdjectives: brandProfile.voiceAdjectives?.join(', ') || '',
      complianceRegion: (brandProfile.complianceRegion as any) || 'none',
      personas: brandProfile.personas?.length ? brandProfile.personas : [{ name: '', demographics: '', painPoints: '', goals: '' }],
      competitors: brandProfile.competitors?.length ? brandProfile.competitors : []
    }
  });

  const { fields: personaFields, append: appendPersona, remove: removePersona } = useFieldArray({ control, name: "personas" });
  const { fields: compFields, append: appendComp, remove: removeComp } = useFieldArray({ control, name: "competitors" });

  const websiteUrl = watch('websiteUrl');

  const handleAutofill = async () => {
    if (!websiteUrl) return;
    setIsScraping(true);
    try {
      const data = await brandProfileApi.autofill(websiteUrl);
      if (data.businessName) setValue('businessName', data.businessName);
      if (data.industry) setValue('industry', data.industry);
      if (data.mission) setValue('mission', data.mission);
      if (data.usp) setValue('usp', data.usp);
      if (data.voiceAdjectives) setValue('voiceAdjectives', data.voiceAdjectives.join(', '));
      toast.success('Autofill successful!');
    } catch (err: any) {
      toast.error('Autofill failed: ' + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // We save to store on every change via RHF, but since we have Next/Back outside the form,
  // we actually want to save when component unmounts or before next step. 
  // For simplicity here, we'll just bind the onBlur to update the store.
  const handleBlur = handleSubmit((data) => {
    const formattedData = {
      ...data,
      voiceAdjectives: data.voiceAdjectives.split(',').map((s: string) => s.trim()).filter(Boolean)
    };
    updateBrandProfile(formattedData as any);
  });

  return (
    <form className="flex flex-col gap-6" onBlur={handleBlur}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-black uppercase">Brand Profile</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <NeoInput label="Website URL" {...register('websiteUrl')} placeholder="https://example.com" />
          <NeoButton variant="secondary" type="button" onClick={handleAutofill} disabled={isScraping || !websiteUrl} className="w-fit text-xs py-1 px-2">
            {isScraping ? 'Scraping...' : '✨ Autofill from Website'}
          </NeoButton>
        </div>
        <NeoInput label="Business Name" {...register('businessName')} />
        <NeoInput label="Industry" {...register('industry')} />
        <NeoInput label="Compliance Region" {...register('complianceRegion')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-sm font-bold uppercase">Mission</label>
          <textarea className="border-neo border-neo-ink p-2 font-mono text-sm min-h-[80px]" {...register('mission')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-sm font-bold uppercase">Unique Selling Proposition</label>
          <textarea className="border-neo border-neo-ink p-2 font-mono text-sm min-h-[80px]" {...register('usp')} />
        </div>
      </div>

      <NeoInput label="Brand Voice (comma separated)" {...register('voiceAdjectives')} placeholder="bold, witty, professional" />

      {/* Personas */}
      <div className="border-neo border-neo-ink p-4 bg-neo-surface-alt">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-lg font-black uppercase">Personas</h3>
          <NeoButton variant="secondary" type="button" onClick={() => appendPersona({ name: '', demographics: '', painPoints: '', goals: '' })} className="py-1 text-xs">Add Persona</NeoButton>
        </div>
        <div className="flex flex-col gap-4">
          {personaFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-2 gap-2 p-2 border-2 border-neo-ink bg-white relative">
              <NeoInput label="Name" {...register(`personas.${index}.name` as const)} />
              <NeoInput label="Demographics" {...register(`personas.${index}.demographics` as const)} />
              <NeoInput label="Pain Points" {...register(`personas.${index}.painPoints` as const)} />
              <NeoInput label="Goals" {...register(`personas.${index}.goals` as const)} />
              <button type="button" onClick={() => removePersona(index)} className="absolute -top-2 -right-2 bg-neo-accent-pink border-neo border-neo-ink w-6 h-6 rounded-full font-bold">×</button>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
