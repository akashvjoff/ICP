import React, { useState } from 'react';
import { OfferingProfile } from '../../types/offering';
import { SectionHeading } from '../ui/SectionHeading';
import { BrutalistCard } from '../ui/BrutalistCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { FormField, BrutalistInput, BrutalistTextarea } from '../ui/FormField';
import { StickerBadge } from '../ui/StickerBadge';
import { Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRight, Save } from 'lucide-react';

interface OfferingWizardProps {
  offering: OfferingProfile;
  onSaveOffering: (updated: OfferingProfile) => void;
  onNextStep: () => void;
}

export const OfferingWizard: React.FC<OfferingWizardProps> = ({
  offering,
  onSaveOffering,
  onNextStep,
}) => {
  const [formData, setFormData] = useState<OfferingProfile>(offering);
  const [isSaved, setIsSaved] = useState(false);

  const handleInputChange = (field: keyof OfferingProfile, val: unknown) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setIsSaved(false);
  };

  const handleHypothesisChange = (field: string, val: unknown) => {
    setFormData(prev => ({
      ...prev,
      icpHypothesis: {
        ...prev.icpHypothesis,
        [field]: val,
      },
    }));
    setIsSaved(false);
  };

  const handleAddCapability = () => {
    setFormData(prev => ({
      ...prev,
      keyCapabilities: [...prev.keyCapabilities, ''],
    }));
    setIsSaved(false);
  };

  const handleCapabilityChange = (index: number, val: string) => {
    const updated = [...formData.keyCapabilities];
    updated[index] = val;
    setFormData(prev => ({ ...prev, keyCapabilities: updated }));
    setIsSaved(false);
  };

  const handleRemoveCapability = (index: number) => {
    const updated = formData.keyCapabilities.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, keyCapabilities: updated }));
    setIsSaved(false);
  };

  const handleSave = () => {
    onSaveOffering(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
        <SectionHeading
          eyebrow="STEP 01 OF 05 // CALIBRATION"
          eyebrowColor="bg-[#FFE3B3]"
          title="Own Company & Offering Profile"
          description="Anchor customer problem gravity, capabilities, and pricing to establish the baseline evaluation vector."
          className="mb-0"
        />

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <BrutalistButton
            variant="white"
            size="sm"
            onClick={handleSave}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            {isSaved ? 'SAVED' : 'SAVE DRAFT'}
          </BrutalistButton>

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={() => {
              handleSave();
              onNextStep();
            }}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            CONTINUE TO LEADS
          </BrutalistButton>
        </div>
      </div>

      {isSaved && (
        <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] text-[#0A0A0A] px-4 py-3 rounded-xl shadow-[3px_3px_0px_#0A0A0A] font-mono text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>Offering profile updated successfully. Saved to session state.</span>
        </div>
      )}

      {/* Section 1: Firmographics */}
      <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-3">
          <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
            1. Core Firmographics & Product Identity
          </h3>
          <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
            BASE PROFILE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Company Name">
            <BrutalistInput
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
            />
          </FormField>

          <FormField label="Website URL">
            <BrutalistInput
              type="text"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
            />
          </FormField>

          <FormField label="Product Name">
            <BrutalistInput
              type="text"
              value={formData.productName}
              onChange={(e) => handleInputChange('productName', e.target.value)}
            />
          </FormField>

          <FormField label="Typical Contract Value (ACV)">
            <BrutalistInput
              type="text"
              value={formData.typicalACV}
              onChange={(e) => handleInputChange('typicalACV', e.target.value)}
              placeholder="e.g. $36,000 / yr"
            />
          </FormField>
        </div>

        <div className="space-y-5 pt-2">
          <FormField label="Primary Problem Solved (Acute Customer Friction)">
            <BrutalistTextarea
              rows={2}
              value={formData.primaryProblemSolved}
              onChange={(e) => handleInputChange('primaryProblemSolved', e.target.value)}
            />
          </FormField>

          <FormField label="Quantifiable Value Proposition">
            <BrutalistTextarea
              rows={2}
              value={formData.valueProposition}
              onChange={(e) => handleInputChange('valueProposition', e.target.value)}
            />
          </FormField>
        </div>
      </BrutalistCard>

      {/* Section 2: Key Capabilities */}
      <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-3">
          <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
            2. Verified Key Capabilities
          </h3>
          <button
            onClick={handleAddCapability}
            className="font-mono text-xs font-bold text-[#0A0A0A] bg-[#A1F000] border-[2px] border-[#0A0A0A] px-2.5 py-1 rounded-lg shadow-[2px_2px_0px_#0A0A0A] flex items-center gap-1 cursor-pointer hover:bg-[#92dc00]"
          >
            <Plus className="w-3.5 h-3.5" /> ADD CAPABILITY
          </button>
        </div>

        <div className="space-y-3">
          {formData.keyCapabilities.map((cap, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <BrutalistInput
                type="text"
                value={cap}
                onChange={(e) => handleCapabilityChange(idx, e.target.value)}
                placeholder="Specific feature or workflow automation"
              />
              <button
                onClick={() => handleRemoveCapability(idx)}
                className="p-2.5 border-[2px] border-[#0A0A0A] rounded-xl bg-white shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFB6C2] transition-colors cursor-pointer text-[#0A0A0A]"
                aria-label="Remove capability"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </BrutalistCard>

      {/* Section 3: Initial ICP Hypothesis */}
      <BrutalistCard bg="peach" shadowSize="md" className="p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
          <div>
            <h3 className="text-lg font-black text-[#0A0A0A] tracking-tight">
              3. Initial ICP Hypothesis Parameters
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 font-medium mt-0.5">
              Theoretical assumptions to be tested against lead cohort.
            </p>
          </div>
          <StickerBadge color="purple" rotate="-2">
            HYPOTHESIS ONLY
          </StickerBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Target Headcount Range">
            <BrutalistInput
              type="text"
              value={formData.icpHypothesis.targetHeadcount}
              onChange={(e) => handleHypothesisChange('targetHeadcount', e.target.value)}
              placeholder="e.g. 150–1,500 FTE"
            />
          </FormField>

          <FormField label="Target Industry Verticals">
            <BrutalistInput
              type="text"
              value={formData.icpHypothesis.targetIndustries.join(', ')}
              onChange={(e) => handleHypothesisChange('targetIndustries', e.target.value.split(',').map(s => s.trim()))}
              placeholder="e.g. FinTech, HealthTech, B2B SaaS"
            />
          </FormField>
        </div>

        <FormField label="Hypothesis Strategic Rationale">
          <BrutalistTextarea
            rows={2}
            value={formData.icpHypothesis.hypothesisRationale}
            onChange={(e) => handleHypothesisChange('hypothesisRationale', e.target.value)}
          />
        </FormField>

        <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 shadow-[2px_2px_0px_#0A0A0A] flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
            <strong>Keep in mind:</strong> These assumptions guide the rule-based score. Until you add actual deal outcomes, cohort scores remain an <em>ICP hypothesis</em>.
          </p>
        </div>
      </BrutalistCard>
    </div>
  );
};
