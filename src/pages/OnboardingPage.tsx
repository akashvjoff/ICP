import React, { useState, useEffect } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { dbService } from '../lib/supabase';
import {
  SellerProductContext,
  BuyerRole,
  DEFAULT_SELLER_CONTEXT,
  calculateContextCompletion,
} from '../types/offering';
import { SectionHeading } from '../components/ui/SectionHeading';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { FormField, BrutalistInput, BrutalistTextarea } from '../components/ui/FormField';
import { ProgressStepper, StepItem } from '../components/ui/ProgressStepper';
import { StickerBadge } from '../components/ui/StickerBadge';
import { StatusChip } from '../components/ui/StatusChip';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Building2,
  Package,
  Users,
  AlertCircle,
  HelpCircle,
  Save,
  CheckCircle2,
  Eye,
  RefreshCw,
  ExternalLink,
  Info,
  X,
} from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { sellerContext, updateSellerContext, addToast } = useAppStore();
  const { user, isConfigured } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<SellerProductContext>(sellerContext || DEFAULT_SELLER_CONTEXT);
  const [resumedDraft, setResumedDraft] = useState<boolean>(false);
  const [savingProgress, setSavingProgress] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // AI Assistance Modal State
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, unknown> | null>(null);

  const steps: StepItem[] = [
    { id: '1', num: '01', label: 'YOUR COMPANY', pastelBg: 'peach' },
    { id: '2', num: '02', label: 'WHAT YOU SELL', pastelBg: 'lavender' },
    { id: '3', num: '03', label: 'WHO YOU HELP', pastelBg: 'mint' },
    { id: '4', num: '04', label: 'CUSTOMER PROBLEM', pastelBg: 'pink' },
    { id: '5', num: '05', label: 'SUMMARY REVIEW' },
  ];

  // 1. Resume Incomplete Onboarding / Load Existing State on Mount
  useEffect(() => {
    let loaded = false;

    // Check local storage draft first
    try {
      const savedDraft = localStorage.getItem('icp_mode_onboarding_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
        setResumedDraft(true);
        loaded = true;
      }
    } catch {}

    // If logged in with Supabase, attempt to fetch user's saved context
    if (user?.id && isConfigured) {
      dbService.loadSellerProductContext(user.id).then((serverCtx) => {
        if (serverCtx && Object.keys(serverCtx).length > 3) {
          setFormData((prev) => ({ ...prev, ...(serverCtx as Partial<SellerProductContext>) }));
          setResumedDraft(true);
        }
      }).catch((err) => {
        console.warn('Could not load remote seller context:', err);
      });
    }
  }, [user?.id, isConfigured]);

  // Completion calculation
  const completion = calculateContextCompletion(formData);

  // Incremental Local Auto-Save
  const saveDraftLocally = (updated: SellerProductContext) => {
    try {
      localStorage.setItem('icp_mode_onboarding_draft', JSON.stringify(updated));
    } catch {}
  };

  const handleInputChange = (field: keyof SellerProductContext, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      saveDraftLocally(next);
      return next;
    });

    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleNestedUserChange = (key: keyof SellerProductContext['usersVsDecisionMakers'], value: string) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        usersVsDecisionMakers: {
          ...prev.usersVsDecisionMakers,
          [key]: value,
        },
      };
      saveDraftLocally(next);
      return next;
    });
  };

  // Add / Remove Core Features
  const handleAddFeature = () => {
    const updated = [...formData.coreFeatures, ''];
    handleInputChange('coreFeatures', updated);
  };

  const handleUpdateFeature = (index: number, val: string) => {
    const updated = [...formData.coreFeatures];
    updated[index] = val;
    handleInputChange('coreFeatures', updated);
  };

  const handleRemoveFeature = (index: number) => {
    const updated = formData.coreFeatures.filter((_, idx) => idx !== index);
    handleInputChange('coreFeatures', updated);
  };

  // Add / Remove Buyer Roles
  const handleAddBuyerRole = () => {
    const newRole: BuyerRole = {
      id: `br-${Date.now()}`,
      role: 'Director of Growth / Marketing Ops',
      seniority: 'Director',
      motivation: 'Reliable pipeline velocity and measurable lead conversion.',
      isDecisionMaker: false,
    };
    handleInputChange('buyerRoles', [...formData.buyerRoles, newRole]);
  };

  const handleUpdateBuyerRole = (index: number, key: keyof BuyerRole, val: unknown) => {
    const updated = [...formData.buyerRoles];
    updated[index] = { ...updated[index], [key]: val };
    handleInputChange('buyerRoles', updated);
  };

  const handleRemoveBuyerRole = (id: string) => {
    handleInputChange('buyerRoles', formData.buyerRoles.filter((b) => b.id !== id));
  };

  // Step Validation
  const validateCurrentStep = (): boolean => {
    const errs: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.companyName.trim()) errs.companyName = 'Company name is required.';
      if (!formData.industry.trim()) errs.industry = 'Please select or enter your industry.';
    } else if (currentStep === 2) {
      if (!formData.productName.trim()) errs.productName = 'Product name is required.';
      if (!formData.productDescription.trim()) errs.productDescription = 'Please provide a product description.';
      if (!formData.mainBenefit.trim()) errs.mainBenefit = 'Main benefit is required to anchor the Need Gap.';
    } else if (currentStep === 3) {
      if (formData.buyerRoles.length === 0) {
        errs.buyerRoles = 'Please specify at least one target buyer role.';
      }
    } else if (currentStep === 4) {
      if (!formData.currentCustomerProblem.trim()) {
        errs.currentCustomerProblem = 'Please describe the customer frustration/problem.';
      }
      if (!formData.idealCustomerOutcome.trim()) {
        errs.idealCustomerOutcome = 'Please describe the ideal customer outcome.';
      }
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step Navigation with Incremental Remote Save
  const handleNext = async () => {
    if (!validateCurrentStep()) {
      addToast('Please complete the highlighted fields before proceeding.', 'warning');
      return;
    }

    setSavingProgress(true);

    // Persist incrementally to Supabase if connected
    if (user?.id && isConfigured) {
      try {
        await dbService.saveSellerProductContext(user.id, formData);
      } catch (err) {
        console.warn('Incremental Supabase save warning:', err);
      }
    }

    setSavingProgress(false);

    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo(0, 0);
    } else {
      handleFinalSave();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  // Final Save & Engine Calibration
  const handleFinalSave = async () => {
    setSavingProgress(true);

    const finalized: SellerProductContext = {
      ...formData,
      isComplete: completion.isComplete,
      completionScore: completion.score,
      lastSavedAt: new Date().toISOString(),
    };

    // Update global store
    updateSellerContext(finalized);

    // Save to Supabase if configured
    if (user?.id && isConfigured) {
      try {
        await dbService.saveSellerProductContext(user.id, finalized);
      } catch (err) {
        console.error('Error finalizing seller profile in Supabase:', err);
      }
    }

    // Clear temporary local draft
    try {
      localStorage.removeItem('icp_mode_onboarding_draft');
    } catch {}

    setSavingProgress(false);
    addToast('Seller Product Context calibrated! ICP Engine is ready for lead analysis.', 'success');
    navigate('/dashboard');
  };

  // Trigger AI Suggestion Flow
  const handleRequestAiAssistance = async () => {
    setAiLoading(true);
    setAiModalOpen(true);

    try {
      const response = await fetch('/api/ai/suggest-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          website: formData.website,
          productName: formData.productName,
          industry: formData.industry,
          productDescription: formData.productDescription,
          currentCustomerProblem: formData.currentCustomerProblem,
        }),
      });

      const data = await response.json();
      if (data.success && data.suggestions) {
        setAiSuggestions(data.suggestions);
      } else {
        addToast('AI suggestion service returned no data. Using standard suggestions.', 'info');
      }
    } catch (err) {
      console.error('AI Assistance error:', err);
      addToast('Could not reach AI suggestions endpoint. Please verify server connection.', 'warning');
    } finally {
      setAiLoading(false);
    }
  };

  // Apply Single Field from AI
  const handleApplySingleField = (field: keyof SellerProductContext, val: unknown) => {
    handleInputChange(field, val);
    addToast(`Applied suggestion for ${String(field)}.`, 'success');
  };

  // Apply All Suggestions (Explicit user confirmation required)
  const handleApplyAllSuggestions = () => {
    if (!aiSuggestions) return;

    setFormData((prev) => {
      const updated: SellerProductContext = {
        ...prev,
        productDescription: String(aiSuggestions.productDescription || prev.productDescription),
        coreFeatures: Array.isArray(aiSuggestions.coreFeatures)
          ? (aiSuggestions.coreFeatures as string[])
          : prev.coreFeatures,
        mainBenefit: String(aiSuggestions.mainBenefit || prev.mainBenefit),
        currentCustomerProblem: String(aiSuggestions.currentCustomerProblem || prev.currentCustomerProblem),
        idealCustomerOutcome: String(aiSuggestions.idealCustomerOutcome || prev.idealCustomerOutcome),
        motivationToChange: String(aiSuggestions.motivationToChange || prev.motivationToChange),
        whyCustomersChoose: String(aiSuggestions.whyCustomersChoose || prev.whyCustomersChoose),
        mainAlternatives: String(aiSuggestions.mainAlternatives || prev.mainAlternatives),
        pointOfParity: String(aiSuggestions.pointOfParity || prev.pointOfParity),
        pointOfDifference: String(aiSuggestions.pointOfDifference || prev.pointOfDifference),
      };
      saveDraftLocally(updated);
      return updated;
    });

    setAiModalOpen(false);
    addToast('All AI suggestions applied to your onboarding draft!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] p-6 sm:p-10 font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-5">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer focus:outline-hidden"
          >
            <span className="w-3.5 h-3.5 bg-[#A1F000] border-[2px] border-[#0A0A0A] shadow-[1.5px_1.5px_0px_#0A0A0A]" />
            <span className="text-2xl font-black tracking-tighter text-[#0A0A0A]">
              icp<span className="text-[#A1F000]">.</span>mode
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] font-bold bg-white border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded shadow-[1.5px_1.5px_0px_#0A0A0A]">
              <span>COMPLETION:</span>
              <span className={`font-black ${completion.score >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {completion.score}%
              </span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline cursor-pointer"
            >
              SKIP TO DASHBOARD →
            </button>
          </div>
        </div>

        {/* Resumed Draft Notice Banner */}
        {resumedDraft && (
          <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-3 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#8C6ADE]" />
              <span><strong>Resumed Incomplete Onboarding:</strong> Your progress was automatically saved and restored.</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('icp_mode_onboarding_draft');
                setFormData(DEFAULT_SELLER_CONTEXT);
                setResumedDraft(false);
                addToast('Draft reset to baseline default.', 'info');
              }}
              className="text-rose-600 font-bold hover:underline cursor-pointer text-[11px]"
            >
              RESET TO DEFAULT
            </button>
          </div>
        )}

        {/* Stepper Header */}
        <div>
          <ProgressStepper
            steps={steps}
            currentStepId={String(currentStep)}
            onSelectStep={(id) => {
              setCurrentStep(parseInt(id, 10));
              window.scrollTo(0, 0);
            }}
            className="mb-6"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <SectionHeading
              eyebrow={
                currentStep <= 4
                  ? `STEP 0${currentStep} OF 04 // SELLER PRODUCT CALIBRATION`
                  : 'STEP 05 OF 05 // FINAL EXECUTIVE REVIEW'
              }
              eyebrowColor={
                currentStep === 1 ? 'bg-[#FFE3B3]' :
                currentStep === 2 ? 'bg-[#E4E6FB]' :
                currentStep === 3 ? 'bg-[#E5F7E5]' :
                currentStep === 4 ? 'bg-[#FFB6C2]' :
                'bg-[#A1F000]'
              }
              title={
                currentStep === 1 ? 'Your Company & Identity' :
                currentStep === 2 ? 'What You Sell & Pricing Model' :
                currentStep === 3 ? 'Who You Help & Buyer Personas' :
                currentStep === 4 ? 'The Customer Problem & Need Gap' :
                'Review & Calibrate Seller Context'
              }
              description={
                currentStep === 1 ? 'Your company basics establish firmographic vectors and geographical boundaries.' :
                currentStep === 2 ? 'Detail your product capabilities, pricing envelope, and value delivery mechanism.' :
                currentStep === 3 ? 'Clarify who experiences friction vs who signs purchase orders in the buying committee.' :
                currentStep === 4 ? 'Anchor the Need Gap: Map the frustrating current state to the breakthrough ideal state.' :
                'Verify your offering parameters. This profile will power company classification and ICP scoring.'
              }
            />

            {/* AI Assistance Trigger Button */}
            {currentStep <= 4 && (
              <BrutalistButton
                type="button"
                variant="white"
                size="sm"
                onClick={handleRequestAiAssistance}
                icon={<Sparkles className="w-3.5 h-3.5 text-[#8C6ADE]" />}
                className="shrink-0 text-xs font-bold self-start sm:self-auto"
              >
                AI ASSIST: SUGGEST COPY
              </BrutalistButton>
            )}
          </div>
        </div>

        {/* STEP 1: YOUR COMPANY */}
        {currentStep === 1 && (
          <BrutalistCard bg="white" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="COMPANY NAME" error={validationErrors.companyName}>
                <BrutalistInput
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="e.g. Synthetix Data Cloud"
                  required
                />
              </FormField>

              <FormField label="COMPANY WEBSITE URL">
                <BrutalistInput
                  type="text"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://synthetix.io"
                />
              </FormField>

              <FormField label="PRIMARY INDUSTRY / SECTOR" error={validationErrors.industry}>
                <BrutalistInput
                  type="text"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  placeholder="e.g. Enterprise B2B Software, FinTech Infrastructure"
                  required
                />
              </FormField>

              <FormField label="COMPANY GEOGRAPHY / HEADQUARTERS">
                <BrutalistInput
                  type="text"
                  value={formData.geography}
                  onChange={(e) => handleInputChange('geography', e.target.value)}
                  placeholder="e.g. North America, San Francisco & Remote"
                />
              </FormField>
            </div>

            <div className="bg-[#FFE3B3]/40 border-[2px] border-[#0A0A0A] rounded-xl p-4 text-xs font-mono">
              <span className="font-bold text-[#0A0A0A] block mb-1">PRO-TIP:</span>
              <p className="text-[#0A0A0A]/80 leading-relaxed font-sans text-xs">
                Your company identity establishes baseline credibility and geographic alignment filters during prospect company scoring.
              </p>
            </div>
          </BrutalistCard>
        )}

        {/* STEP 2: WHAT YOU SELL */}
        {currentStep === 2 && (
          <BrutalistCard bg="lavender" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="PRODUCT OR SERVICE NAME" error={validationErrors.productName}>
                <BrutalistInput
                  type="text"
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  placeholder="e.g. DataReliability Engine"
                  required
                />
              </FormField>

              <FormField label="BUSINESS MODEL">
                <select
                  value={formData.businessModel}
                  onChange={(e) => handleInputChange('businessModel', e.target.value as SellerProductContext['businessModel'])}
                  className="w-full bg-white border-[2.5px] border-[#0A0A0A] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] focus:outline-hidden"
                >
                  <option value="B2B SaaS">B2B SaaS</option>
                  <option value="Enterprise Software">Enterprise Software</option>
                  <option value="Tech-Enabled Services">Tech-Enabled Services</option>
                  <option value="API/DevTool">API/DevTool</option>
                  <option value="Marketplace">Marketplace</option>
                  <option value="Professional Services">Professional Services</option>
                </select>
              </FormField>
            </div>

            <FormField label="DETAILED PRODUCT DESCRIPTION" error={validationErrors.productDescription}>
              <BrutalistTextarea
                rows={3}
                value={formData.productDescription}
                onChange={(e) => handleInputChange('productDescription', e.target.value)}
                placeholder="Explain what your product does in concrete terms without buzzwords. What systems does it connect to?"
                required
              />
            </FormField>

            <FormField label="MAIN BUSINESS BENEFIT (QUANTIFIABLE OUTCOME)" error={validationErrors.mainBenefit}>
              <BrutalistTextarea
                rows={2}
                value={formData.mainBenefit}
                onChange={(e) => handleInputChange('mainBenefit', e.target.value)}
                placeholder="e.g. Cuts pipeline downtime by 85% and eliminates silent data errors in board dashboards."
                required
              />
            </FormField>

            <FormField label="INDICATIVE PRICING / ANNUAL CONTRACT VALUE (ACV)">
              <BrutalistInput
                type="text"
                value={formData.indicativePricing}
                onChange={(e) => handleInputChange('indicativePricing', e.target.value)}
                placeholder="e.g. $36,000 / year (Typical range: $20k - $60k)"
              />
            </FormField>

            {/* Core Features Dynamic List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  CORE TECHNICAL FEATURES & CAPABILITIES ({formData.coreFeatures.length})
                </span>
                <BrutalistButton
                  type="button"
                  variant="white"
                  size="sm"
                  onClick={handleAddFeature}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  ADD FEATURE
                </BrutalistButton>
              </div>

              {formData.coreFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-[#0A0A0A] w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <BrutalistInput
                    type="text"
                    value={feat}
                    onChange={(e) => handleUpdateFeature(idx, e.target.value)}
                    placeholder="e.g. Real-time schema change detection before warehouse commits"
                  />
                  {formData.coreFeatures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="p-2.5 border-[2px] border-[#0A0A0A] rounded-xl bg-white shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFB6C2] cursor-pointer"
                      title="Remove Feature"
                    >
                      <Trash2 className="w-4 h-4 text-[#0A0A0A]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </BrutalistCard>
        )}

        {/* STEP 3: WHO YOU HELP */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <BrutalistCard bg="mint" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="TYPICAL COMPANY SIZE (HEADCOUNT)">
                  <BrutalistInput
                    type="text"
                    value={formData.typicalCompanySize}
                    onChange={(e) => handleInputChange('typicalCompanySize', e.target.value)}
                    placeholder="e.g. 150–1,500 FTE"
                  />
                </FormField>

                <FormField label="EXISTING OR REFERENCE TARGET CUSTOMERS">
                  <BrutalistInput
                    type="text"
                    value={formData.existingCustomers}
                    onChange={(e) => handleInputChange('existingCustomers', e.target.value)}
                    placeholder="e.g. FinTech scaleups, healthcare data teams, enterprise SaaS"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="TARGET BUSINESS TYPES (COMMA-SEPARATED)">
                  <BrutalistInput
                    type="text"
                    value={formData.targetBusinessTypes.join(', ')}
                    onChange={(e) =>
                      handleInputChange(
                        'targetBusinessTypes',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="FinTech, HealthTech, High-Growth SaaS"
                  />
                </FormField>

                <FormField label="TARGET GEOGRAPHIES (COMMA-SEPARATED)">
                  <BrutalistInput
                    type="text"
                    value={formData.targetGeography.join(', ')}
                    onChange={(e) =>
                      handleInputChange(
                        'targetGeography',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="United States, Canada, United Kingdom, EU"
                  />
                </FormField>
              </div>

              {/* Users vs Decision Makers Section */}
              <div className="bg-white border-[2.5px] border-[#0A0A0A] rounded-xl p-5 shadow-[3px_3px_0px_#0A0A0A] space-y-4">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
                  USERS VS. DECISION MAKERS (THE BUYING UNIT DYNAMICS):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="DAILY HANDS-ON USERS">
                    <BrutalistInput
                      type="text"
                      value={formData.usersVsDecisionMakers.dailyUsers}
                      onChange={(e) => handleNestedUserChange('dailyUsers', e.target.value)}
                      placeholder="e.g. Analytics Engineers"
                    />
                  </FormField>

                  <FormField label="DECISION MAKERS / SPONSORS">
                    <BrutalistInput
                      type="text"
                      value={formData.usersVsDecisionMakers.decisionMakers}
                      onChange={(e) => handleNestedUserChange('decisionMakers', e.target.value)}
                      placeholder="e.g. VP of Data / Head of BI"
                    />
                  </FormField>

                  <FormField label="BUDGET HOLDERS (SIGN OFF)">
                    <BrutalistInput
                      type="text"
                      value={formData.usersVsDecisionMakers.budgetHolders}
                      onChange={(e) => handleNestedUserChange('budgetHolders', e.target.value)}
                      placeholder="e.g. CTO / CFO"
                    />
                  </FormField>
                </div>
              </div>
            </BrutalistCard>

            {/* Buyer Roles Cards List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    TARGET BUYER ROLES & COMMITTEE MEMBERS ({formData.buyerRoles.length})
                  </h3>
                  {validationErrors.buyerRoles && (
                    <p className="text-xs text-rose-600 font-bold mt-1">
                      {validationErrors.buyerRoles}
                    </p>
                  )}
                </div>

                <BrutalistButton
                  type="button"
                  variant="lime"
                  size="sm"
                  onClick={handleAddBuyerRole}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  ADD BUYER ROLE
                </BrutalistButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {formData.buyerRoles.map((role, idx) => (
                  <BrutalistCard key={role.id} bg="white" shadowSize="md" className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-2">
                      <span className="font-mono text-[10px] font-black uppercase bg-[#E5F7E5] px-2 py-0.5 rounded border border-[#0A0A0A]">
                        ROLE 0{idx + 1} // {role.isDecisionMaker ? 'ECONOMIC BUYER' : 'USER CHAMPION'}
                      </span>
                      {formData.buyerRoles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBuyerRole(role.id)}
                          className="p-1 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <FormField label="JOB TITLE">
                      <BrutalistInput
                        type="text"
                        value={role.role}
                        onChange={(e) => handleUpdateBuyerRole(idx, 'role', e.target.value)}
                        placeholder="e.g. VP of Data & Analytics"
                      />
                    </FormField>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="SENIORITY">
                        <select
                          value={role.seniority}
                          onChange={(e) => handleUpdateBuyerRole(idx, 'seniority', e.target.value as BuyerRole['seniority'])}
                          className="w-full bg-white border-[2.5px] border-[#0A0A0A] rounded-xl px-3 py-2 text-xs font-bold text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
                        >
                          <option value="C-Level">C-Level</option>
                          <option value="VP">VP</option>
                          <option value="Director">Director</option>
                          <option value="Manager">Manager</option>
                          <option value="Practitioner">Practitioner</option>
                        </select>
                      </FormField>

                      <FormField label="DECISION AUTHORITY">
                        <button
                          type="button"
                          onClick={() => handleUpdateBuyerRole(idx, 'isDecisionMaker', !role.isDecisionMaker)}
                          className={`w-full py-2 px-3 rounded-xl border-[2.5px] border-[#0A0A0A] font-mono text-[11px] font-black uppercase transition-all cursor-pointer ${
                            role.isDecisionMaker
                              ? 'bg-[#A1F000] shadow-[2px_2px_0px_#0A0A0A]'
                              : 'bg-white shadow-[2px_2px_0px_#0A0A0A]'
                          }`}
                        >
                          {role.isDecisionMaker ? 'HOLDS BUDGET' : 'INFLUENCER'}
                        </button>
                      </FormField>
                    </div>

                    <FormField label="CORE MOTIVATION / DESIRED OUTCOME">
                      <BrutalistInput
                        type="text"
                        value={role.motivation}
                        onChange={(e) => handleUpdateBuyerRole(idx, 'motivation', e.target.value)}
                        placeholder="What drives this person to advocate for purchase?"
                      />
                    </FormField>
                  </BrutalistCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: THE CUSTOMER PROBLEM (NEED GAP FRAMEWORK) */}
        {currentStep === 4 && (
          <BrutalistCard bg="pink" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
            <div className="bg-white border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#8C6ADE] border border-[#0A0A0A]" />
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  THE NEED GAP FRAMEWORK: CURRENT STATE → IDEAL STATE → THE GAP
                </span>
              </div>
              <StickerBadge color="purple" rotate="-2">CORE GTM ENGINE</StickerBadge>
            </div>

            {/* Current State vs Ideal State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="WHAT FRUSTRATING SITUATION MAKES PROSPECTS LOOK FOR A SOLUTION?"
                error={validationErrors.currentCustomerProblem}
              >
                <BrutalistTextarea
                  rows={4}
                  value={formData.currentCustomerProblem}
                  onChange={(e) => handleInputChange('currentCustomerProblem', e.target.value)}
                  placeholder="Describe the friction in practical terms. (e.g. Silent schema changes break executive reporting models, triggering emergency weekend firefights)."
                  required
                />
              </FormField>

              <FormField
                label="WHAT IS THE BREAKTHROUGH IDEAL OUTCOME THEY WANT TO REACH?"
                error={validationErrors.idealCustomerOutcome}
              >
                <BrutalistTextarea
                  rows={4}
                  value={formData.idealCustomerOutcome}
                  onChange={(e) => handleInputChange('idealCustomerOutcome', e.target.value)}
                  placeholder="Describe the desired outcome. (e.g. Continuous data contract testing where no broken code ever lands in production warehouses)."
                  required
                />
              </FormField>
            </div>

            {/* Need Gap Attributes: Intensity, Motivation, Purchase Involvement */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField label="PROBLEM INTENSITY">
                <select
                  value={formData.problemIntensity}
                  onChange={(e) => handleInputChange('problemIntensity', e.target.value as SellerProductContext['problemIntensity'])}
                  className="w-full bg-white border-[2.5px] border-[#0A0A0A] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
                >
                  <option value="Critical / Mission-Critical">Critical / Mission-Critical</option>
                  <option value="Significant / High-Priority">Significant / High-Priority</option>
                  <option value="Moderate / Nice-to-Have">Moderate / Nice-to-Have</option>
                </select>
              </FormField>

              <FormField label="WHAT MOTIVATES THEM TO CHANGE RIGHT NOW?">
                <BrutalistInput
                  type="text"
                  value={formData.motivationToChange}
                  onChange={(e) => handleInputChange('motivationToChange', e.target.value)}
                  placeholder="e.g. A board-level incident or audit warning"
                />
              </FormField>

              <FormField label="PURCHASE EFFORT & SWITCHING RISK">
                <BrutalistInput
                  type="text"
                  value={formData.purchaseInvolvement}
                  onChange={(e) => handleInputChange('purchaseInvolvement', e.target.value)}
                  placeholder="e.g. 20-min CLI install, low migration risk"
                />
              </FormField>
            </div>

            {/* Why choose, Alternatives, Parity, Difference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <FormField label="WHY DO CUSTOMERS CHOOSE YOU OVER INACTION?">
                <BrutalistTextarea
                  rows={2}
                  value={formData.whyCustomersChoose}
                  onChange={(e) => handleInputChange('whyCustomersChoose', e.target.value)}
                  placeholder="Why do they pick your approach? (e.g. Works inside existing git CI/CD workflows)."
                />
              </FormField>

              <FormField label="MAIN ALTERNATIVES & SUBSTITUTES">
                <BrutalistTextarea
                  rows={2}
                  value={formData.mainAlternatives}
                  onChange={(e) => handleInputChange('mainAlternatives', e.target.value)}
                  placeholder="What do they currently use? (e.g. In-house Python scripts, Monte Carlo, manual checks)."
                />
              </FormField>

              <FormField label="POINT OF PARITY (TABLE-STAKES CAPABILITIES MATCHED)">
                <BrutalistInput
                  type="text"
                  value={formData.pointOfParity}
                  onChange={(e) => handleInputChange('pointOfParity', e.target.value)}
                  placeholder="e.g. Standard Slack alerts, Snowflake compatibility, SOC2 compliance"
                />
              </FormField>

              <FormField label="POINT OF DIFFERENCE (UNFAIR EDGE / PROPRIETARY ADVANTAGE)">
                <BrutalistInput
                  type="text"
                  value={formData.pointOfDifference}
                  onChange={(e) => handleInputChange('pointOfDifference', e.target.value)}
                  placeholder="e.g. Zero-copy simulation catches errors before write transactions commit"
                />
              </FormField>
            </div>
          </BrutalistCard>
        )}

        {/* STEP 5: SUMMARY REVIEW PAGE */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <BrutalistCard bg="white" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-5">
                <div>
                  <h3 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                    Seller Product Context Review
                  </h3>
                  <p className="text-xs text-[#0A0A0A]/70 font-medium">
                    This calibrated context will anchor Need Gap scoring and 5C analysis across your prospect leads.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <StatusChip color={completion.isComplete ? 'lime' : 'peach'}>
                    {completion.isComplete ? '100% CALIBRATED' : `${completion.score}% PARTIALLY CALIBRATED`}
                  </StatusChip>
                </div>
              </div>

              {/* Step 1 Review */}
              <div className="bg-[#FFE3B3]/40 border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    01 // COMPANY IDENTITY
                  </span>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="font-mono text-[11px] font-bold text-[#0A0A0A] underline cursor-pointer hover:text-[#8C6ADE]"
                  >
                    EDIT STEP 1
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-1">
                  <div>
                    <span className="text-[#0A0A0A]/60 block text-[10px]">COMPANY:</span>
                    <strong className="text-[#0A0A0A]">{formData.companyName}</strong>
                  </div>
                  <div>
                    <span className="text-[#0A0A0A]/60 block text-[10px]">WEBSITE:</span>
                    <span className="text-[#0A0A0A] truncate block">{formData.website || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#0A0A0A]/60 block text-[10px]">INDUSTRY:</span>
                    <span className="text-[#0A0A0A]">{formData.industry}</span>
                  </div>
                  <div>
                    <span className="text-[#0A0A0A]/60 block text-[10px]">GEOGRAPHY:</span>
                    <span className="text-[#0A0A0A]">{formData.geography || 'Global'}</span>
                  </div>
                </div>
              </div>

              {/* Step 2 Review */}
              <div className="bg-[#E4E6FB]/40 border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    02 // WHAT YOU SELL & PRICING
                  </span>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="font-mono text-[11px] font-bold text-[#0A0A0A] underline cursor-pointer hover:text-[#8C6ADE]"
                  >
                    EDIT STEP 2
                  </button>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center gap-4">
                    <span><strong>PRODUCT:</strong> {formData.productName} ({formData.businessModel})</span>
                    <span><strong>ACV:</strong> {formData.indicativePricing}</span>
                  </div>
                  <p className="font-sans text-xs text-[#0A0A0A]/80">
                    <strong>DESCRIPTION:</strong> {formData.productDescription}
                  </p>
                  <p className="font-sans text-xs text-[#0A0A0A]/80">
                    <strong>MAIN BENEFIT:</strong> {formData.mainBenefit}
                  </p>
                  <div className="pt-1">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
                      KEY CAPABILITIES:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[#0A0A0A]/80">
                      {formData.coreFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 3 Review */}
              <div className="bg-[#E5F7E5]/40 border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    03 // TARGET BUYING UNIT
                  </span>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="font-mono text-[11px] font-bold text-[#0A0A0A] underline cursor-pointer hover:text-[#8C6ADE]"
                  >
                    EDIT STEP 3
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[#0A0A0A]/60 text-[10px] block">TARGET VERTICALS:</span>
                    <span>{formData.targetBusinessTypes.join(', ') || 'General B2B'}</span>
                  </div>
                  <div>
                    <span className="text-[#0A0A0A]/60 text-[10px] block">TYPICAL SIZE:</span>
                    <span>{formData.typicalCompanySize}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
                    BUYER COMMITTEE:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {formData.buyerRoles.map((br) => (
                      <span key={br.id} className="bg-white border border-[#0A0A0A] px-2 py-1 rounded text-xs font-mono">
                        <strong>{br.role}</strong> ({br.seniority}) — {br.isDecisionMaker ? '★ Decision Maker' : 'Champion'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 4 Review */}
              <div className="bg-[#FFB6C2]/30 border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    04 // THE NEED GAP & POSITIONING
                  </span>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="font-mono text-[11px] font-bold text-[#0A0A0A] underline cursor-pointer hover:text-[#8C6ADE]"
                  >
                    EDIT STEP 4
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                      CURRENT ACUTE PROBLEM:
                    </span>
                    <p className="font-sans font-medium text-[#0A0A0A]">
                      {formData.currentCustomerProblem}
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                      BREAKTHROUGH IDEAL OUTCOME:
                    </span>
                    <p className="font-sans font-medium text-[#0A0A0A]">
                      {formData.idealCustomerOutcome}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-[11px]">
                    <div>
                      <strong className="block text-[#0A0A0A]/60">POINT OF PARITY:</strong>
                      <span>{formData.pointOfParity || 'Standard compliance'}</span>
                    </div>
                    <div>
                      <strong className="block text-[#0A0A0A]/60">POINT OF DIFFERENCE:</strong>
                      <span className="text-emerald-800 font-bold">{formData.pointOfDifference || 'Proprietary approach'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </BrutalistCard>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between border-t-[2.5px] border-[#0A0A0A] pt-6">
          <BrutalistButton
            variant="white"
            size="md"
            onClick={handlePrev}
            disabled={currentStep === 1}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            PREVIOUS STEP
          </BrutalistButton>

          <div className="flex items-center gap-3">
            <BrutalistButton
              variant="lime"
              size="md"
              onClick={handleNext}
              disabled={savingProgress}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {savingProgress
                ? 'SAVING CONTEXT...'
                : currentStep === 5
                ? 'CALIBRATE & LAUNCH DASHBOARD'
                : 'CONTINUE TO NEXT STEP'}
            </BrutalistButton>
          </div>
        </div>
      </div>

      {/* AI Assistance Suggestion Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-2xl w-full max-h-[90vh] flex flex-col bg-white border-[3px] border-[#0A0A0A] rounded-2xl shadow-[6px_7px_0px_#0A0A0A] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b-[2px] border-[#0A0A0A] bg-[#FFE3B3] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8C6ADE]" />
                <h3 className="font-mono text-sm font-black uppercase text-[#0A0A0A]">
                  AI-ASSISTED NEED GAP SUGGESTIONS
                </h3>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 rounded hover:bg-white border border-transparent hover:border-[#0A0A0A] cursor-pointer"
              >
                <X className="w-5 h-5 text-[#0A0A0A]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 font-sans">
              {aiLoading ? (
                <div className="py-12 text-center space-y-3 font-mono">
                  <div className="w-6 h-6 border-2 border-[#0A0A0A] border-t-[#A1F000] rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[#0A0A0A]">
                    Synthesizing Need Gap and product capabilities from your inputs...
                  </p>
                </div>
              ) : aiSuggestions ? (
                <>
                  <div className="bg-[#E4E6FB]/40 border-[2px] border-[#0A0A0A] p-3.5 rounded-xl text-xs font-mono">
                    <p className="text-[#0A0A0A]/90">
                      <strong>Guardrail Notice:</strong> Suggestions will only be applied to your form after you explicitly confirm. Nothing is overwritten without your approval.
                    </p>
                  </div>

                  {/* Suggestion Item: Product Description */}
                  {Boolean(aiSuggestions.productDescription) && (
                    <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                          SUGGESTED PRODUCT DESCRIPTION
                        </span>
                        <button
                          onClick={() => handleApplySingleField('productDescription', aiSuggestions.productDescription)}
                          className="font-mono text-[10px] font-bold bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                        >
                          APPLY THIS FIELD
                        </button>
                      </div>
                      <p className="text-xs text-[#0A0A0A] leading-relaxed font-medium">
                        {String(aiSuggestions.productDescription)}
                      </p>
                    </div>
                  )}

                  {/* Suggestion Item: Problem */}
                  {Boolean(aiSuggestions.currentCustomerProblem) && (
                    <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                          SUGGESTED CUSTOMER PROBLEM (CURRENT STATE)
                        </span>
                        <button
                          onClick={() => handleApplySingleField('currentCustomerProblem', aiSuggestions.currentCustomerProblem)}
                          className="font-mono text-[10px] font-bold bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                        >
                          APPLY THIS FIELD
                        </button>
                      </div>
                      <p className="text-xs text-[#0A0A0A] leading-relaxed font-medium">
                        {String(aiSuggestions.currentCustomerProblem)}
                      </p>
                    </div>
                  )}

                  {/* Suggestion Item: Ideal Outcome */}
                  {Boolean(aiSuggestions.idealCustomerOutcome) && (
                    <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                          SUGGESTED IDEAL OUTCOME (BREAKTHROUGH STATE)
                        </span>
                        <button
                          onClick={() => handleApplySingleField('idealCustomerOutcome', aiSuggestions.idealCustomerOutcome)}
                          className="font-mono text-[10px] font-bold bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                        >
                          APPLY THIS FIELD
                        </button>
                      </div>
                      <p className="text-xs text-[#0A0A0A] leading-relaxed font-medium">
                        {String(aiSuggestions.idealCustomerOutcome)}
                      </p>
                    </div>
                  )}

                  {/* Suggestion Item: Point of Difference */}
                  {Boolean(aiSuggestions.pointOfDifference) && (
                    <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                          SUGGESTED POINT OF DIFFERENCE (UNFAIR EDGE)
                        </span>
                        <button
                          onClick={() => handleApplySingleField('pointOfDifference', aiSuggestions.pointOfDifference)}
                          className="font-mono text-[10px] font-bold bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                        >
                          APPLY THIS FIELD
                        </button>
                      </div>
                      <p className="text-xs text-emerald-800 font-bold leading-relaxed">
                        {String(aiSuggestions.pointOfDifference)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-xs font-mono text-[#0A0A0A]/60">
                  No suggestions available.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-[2px] border-[#0A0A0A] bg-[#F9F8F4] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline cursor-pointer"
              >
                CANCEL & DISMISS
              </button>

              <BrutalistButton
                type="button"
                variant="lime"
                size="sm"
                onClick={handleApplyAllSuggestions}
                disabled={aiLoading || !aiSuggestions}
                className="text-xs font-black tracking-wider"
              >
                APPLY ALL SUGGESTIONS
              </BrutalistButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
