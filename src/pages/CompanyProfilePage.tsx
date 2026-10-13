import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import type { CompanyAnalysisEnvelope, CompanyIntelligence } from '../types/companyIntelligence';
import { analyzeLeadNeedGap, type SellerProfileContext } from '../server/strategicAnalysisService';
import type { LeadForAnalysis } from '../server/analysisJobService';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { BrutalistTextarea } from '../components/ui/FormField';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { formatScore, formatHeadcount } from '../lib/formatters';
import { calculateDeterministicICPScore } from '../lib/scoring';
import {
  Building2,
  Globe,
  ExternalLink,
  ArrowLeft,
  Check,
  X,
  ShieldAlert,
  Zap,
  Target,
  Users,
  Layers,
  Edit3,
  Save,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Info,
  Clock,
  HelpCircle,
  Compass,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const CompanyProfilePage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { leads, scores, analysis, sellerContext, offering, updateLeadDescription, addToast } = useAppStore();
  const { session } = useAuth();

  const companyId = params.id;
  const lead = leads.find((l) => l.id === companyId);
  const rawScore = scores.find((s) => s.leadId === companyId);
  const needGap = analysis.needGaps.find((g) => g.leadId === (lead ? lead.id : companyId));

  const [showScoreAuditDetails, setShowScoreAuditDetails] = useState<boolean>(false);

  // Intelligence state
  const [companyIntelligence, setCompanyIntelligence] = useState<CompanyAnalysisEnvelope | null>(null);

  // Active Score: evaluate on-the-fly if needed using all available context
  const activeScore = useMemo(() => {
    if (rawScore) return rawScore;
    if (lead) {
      return calculateDeterministicICPScore(lead, offering, needGap, undefined, {
        companyIntelligence,
        sellerContext,
      });
    }
    return null;
  }, [rawScore, lead, offering, needGap, companyIntelligence, sellerContext]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzingCompany, setIsAnalyzingCompany] = useState<boolean>(false);

  // Description editor state
  const [isEditingDescription, setIsEditingDescription] = useState<boolean>(false);
  const [editedDescription, setEditedDescription] = useState<string>('');
  const [userCorrectedDescription, setUserCorrectedDescription] = useState<string>('');
  const [descriptionSaveError, setDescriptionSaveError] = useState<string | null>(null);
  const [isSavingDescription, setIsSavingDescription] = useState<boolean>(false);
  const [descriptionSuccessMessage, setDescriptionSuccessMessage] = useState<string | null>(null);

  // Compute rich Need Gap analysis based on institutional framework
  const richNeedGap = useMemo(() => {
    if (!lead) return null;
    const sellerProf: SellerProfileContext = {
      id: offering.id,
      companyName: sellerContext.companyName || offering.companyName || 'Seller Organization',
      website: sellerContext.website || offering.website || '',
      productName: sellerContext.productName || offering.productName || 'B2B Offering',
      productDescription: sellerContext.productDescription || offering.valueProposition || '',
      category: offering.category || sellerContext.businessModel || 'B2B Software',
      valueProposition: offering.valueProposition || sellerContext.mainBenefit || '',
      primaryProblemSolved: offering.primaryProblemSolved || sellerContext.currentCustomerProblem || 'Manual operational bottlenecks',
      keyCapabilities: offering.keyCapabilities?.length
        ? offering.keyCapabilities
        : (sellerContext.coreFeatures?.length ? sellerContext.coreFeatures : ['Automated workflow diagnostics', 'Real-time pipeline enrichment']),
      typicalACV: offering.typicalACV || sellerContext.indicativePricing || '',
      pricingModel: offering.pricingModel || '',
      mainAlternatives: sellerContext.mainAlternatives || '',
      pointOfParity: sellerContext.pointOfParity || '',
      pointOfDifference: sellerContext.pointOfDifference || '',
      targetMarket: sellerContext.targetBusinessTypes?.join(', ') || '',
      primaryBuyer: sellerContext.buyerRoles?.[0]?.role || offering.buyerPersonas?.[0]?.title || '',
      mainCustomerProblem: sellerContext.currentCustomerProblem || '',
    };

    const leadAdapter: LeadForAnalysis = {
      id: lead.id,
      dataset_id: 'default-dataset',
      owner_user_id: session?.user?.id || 'demo-user',
      company_name: lead.companyName,
      normalized_domain: lead.domain || null,
      website: lead.domain ? `https://${lead.domain}` : null,
      industry_raw: lead.industry || null,
      employee_count: lead.headcount || null,
      company_size_raw: lead.headcount ? `${lead.headcount} employees` : null,
      notes: userCorrectedDescription || lead.userCorrectedDescription || lead.description || null,
      user_corrected_description: userCorrectedDescription || lead.userCorrectedDescription || null,
      product_raw: lead.productRaw || null,
      analysis_eligible: true,
      analysis_status: 'completed',
    };

    return analyzeLeadNeedGap(sellerProf, leadAdapter, companyIntelligence);
  }, [lead, offering, sellerContext, userCorrectedDescription, companyIntelligence, session?.user?.id]);

  // 1. Fetch saved intelligence and human corrections on mount
  useEffect(() => {
    if (!lead) return;

    const initialDesc = lead.userCorrectedDescription || lead.description || lead.productRaw || '';
    setEditedDescription(initialDesc);
    setUserCorrectedDescription(lead.userCorrectedDescription || '');

    let isMounted = true;

    async function loadSavedIntelligence() {
      setIsLoadingSaved(true);
      try {
        if (session?.access_token) {
          const response = await fetch(`/api/ai/company-intelligence/${lead!.id}`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (response.ok && isMounted) {
            const data = await response.json();
            if (data.analysis) {
              setCompanyIntelligence({
                analysis: data.analysis,
                provider: data.provider || 'gemini',
                modelVersion: data.modelVersion || 'unknown',
                analyzedAt: data.analyzedAt || new Date().toISOString(),
                cached: true,
                sourceMode: data.sourceMode || 'uploaded_only',
                websiteEvidence: data.websiteEvidence || undefined,
                userCorrectedDescription: data.userCorrectedDescription || '',
              });
            }
            if (data.userCorrectedDescription) {
              setUserCorrectedDescription(data.userCorrectedDescription);
              setEditedDescription(data.userCorrectedDescription);
            }
          }
        } else {
          // Demo/offline sandbox fallback
          const localSaved = localStorage.getItem(`icp_mode_analysis_${lead!.id}`);
          if (localSaved && isMounted) {
            try {
              const parsed = JSON.parse(localSaved);
              setCompanyIntelligence(parsed);
            } catch {}
          }
          const localDesc = localStorage.getItem(`icp_mode_desc_${lead!.id}`);
          if (localDesc && isMounted) {
            setUserCorrectedDescription(localDesc);
            setEditedDescription(localDesc);
          }
        }
      } catch (err) {
        console.warn('Could not fetch saved company intelligence:', err);
      } finally {
        if (isMounted) setIsLoadingSaved(false);
      }
    }

    void loadSavedIntelligence();

    return () => {
      isMounted = false;
    };
  }, [lead?.id, session?.access_token]);

  // 2. Run Company Intelligence (Gemini or Mock fallback in demo mode)
  const runCompanyIntelligence = async () => {
    if (!lead) return;
    setIsAnalyzingCompany(true);
    setAnalysisError(null);

    const activeDescription = userCorrectedDescription || editedDescription || lead.description || lead.productRaw || '';

    try {
      if (session?.access_token) {
        const response = await fetch('/api/ai/company-intelligence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            leadId: lead.id,
            sellerProductContext: sellerContext,
            companyName: lead.companyName,
            companyDomain: lead.domain || '',
            companyProductDescription: activeDescription,
            companyAttributes: {
              industry: lead.industry || null,
              employee_count: lead.headcount,
              geography: lead.country || null,
              company_type: lead.companyType || null,
              business_model: lead.businessModel || null,
            },
            userCorrectedDescription: userCorrectedDescription || undefined,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Company analysis failed.');
        }

        const envelope = payload as CompanyAnalysisEnvelope;
        setCompanyIntelligence(envelope);
        addToast(`Company intelligence updated for ${lead.companyName}.`, 'success');
        try {
          localStorage.setItem(`icp_mode_analysis_${lead.id}`, JSON.stringify(envelope));
        } catch {}
      } else {
        // Zero-credential Demo Mode simulation using structured contract
        const payroll = /payroll|pay run|salary|wage/i.test(lead.companyName + ' ' + activeDescription);
        const demoAnalysis: CompanyIntelligence = {
          company_type: { value: payroll ? 'B2B SaaS Startup' : (lead.companyType || 'Enterprise Software'), origin: 'inferred', confidence: 'medium' },
          industry: { value: payroll ? 'HR Technology' : (lead.industry || 'Business Software'), origin: 'inferred', confidence: 'high' },
          sub_industry: { value: payroll ? 'Payroll & Compliance SaaS' : 'Operations Management Software', origin: 'inferred', confidence: 'medium' },
          business_model: { value: lead.businessModel || 'B2B Software Subscription', origin: 'inferred', confidence: 'medium' },
          product_summary: {
            value: activeDescription || 'Automated B2B cloud software platform designed for operational scaling.',
            origin: userCorrectedDescription ? 'uploaded' : (activeDescription ? 'uploaded' : 'unknown'),
            confidence: activeDescription ? 'high' : 'low',
            source_field: userCorrectedDescription ? 'user_corrected_description' : 'companyProductDescription',
          },
          products: {
            value: payroll ? ['Automated Pay Runs', 'Payroll Compliance Engine', 'Tax Reporting Portal'] : ['Core Software Platform', 'Integration Connectors', 'Reporting Dashboard'],
            origin: 'inferred',
            confidence: 'medium',
          },
          target_customers: {
            value: payroll ? ['HR Directors', 'Payroll Administrators', 'Finance Leaders'] : ['Operations Managers', 'IT Leadership', 'Business Leaders'],
            origin: 'inferred',
            confidence: 'medium',
          },
          value_proposition: {
            value: payroll ? 'Eliminates payroll reconciliation errors and enforces jurisdictional compliance.' : 'Streamlines complex internal workflows into unified dashboards.',
            origin: 'inferred',
            confidence: 'medium',
          },
          potential_business_needs: {
            value: [
              'Needs automated data validation to reduce repetitive manual entry.',
              'Requires seamless integration with legacy ERP and accounting software.',
              'Struggles with audit trail visibility across distributed teams.',
            ],
            origin: 'inferred',
            confidence: 'low',
          },
          potential_buying_roles: {
            value: payroll ? ['Chief Financial Officer', 'Head of People Operations', 'Payroll Director'] : ['VP of Engineering', 'Director of Operations', 'Chief Technology Officer'],
            origin: 'inferred',
            confidence: 'low',
          },
          company_size: {
            value: lead.headcount !== null ? String(lead.headcount) : 'unknown',
            origin: lead.headcount !== null ? 'uploaded' : 'unknown',
            confidence: lead.headcount !== null ? 'high' : 'low',
            source_field: lead.headcount !== null ? 'employee_count' : undefined,
          },
          geography: {
            value: lead.country || 'unknown',
            origin: lead.country ? 'uploaded' : 'unknown',
            confidence: lead.country ? 'high' : 'low',
            source_field: lead.country ? 'country' : undefined,
          },
          evidence: [
            {
              attribute: 'product_summary',
              summary: userCorrectedDescription ? 'Derived from verified user-corrected description.' : 'Derived from uploaded CSV product description.',
              origin: 'uploaded',
              source_field: userCorrectedDescription ? 'user_corrected_description' : 'companyProductDescription',
            },
            ...(lead.domain ? [{
              attribute: 'industry',
              summary: `Corroborated with public website domain: ${lead.domain}`,
              origin: 'public_webpage' as const,
              source_url: `https://${lead.domain}`,
            }] : []),
          ],
          data_quality: {
            completeness: 'high',
            confidence: 'high',
            missing_fields: [lead.headcount === null ? 'employee_count' : '', !lead.annualRevenue ? 'annual_revenue' : ''].filter(Boolean),
            limitations: [
              'Evaluated in local demo sandbox with deterministic company intelligence schema.',
              'Potential business needs and target buying roles are explicitly unvalidated hypotheses.',
            ],
          },
        };

        const demoEnvelope: CompanyAnalysisEnvelope = {
          analysis: demoAnalysis,
          provider: 'mock-local',
          modelVersion: 'company-intelligence-v1',
          analyzedAt: new Date().toISOString(),
          cached: false,
          sourceMode: lead.domain ? 'both' : 'uploaded_only',
          websiteEvidence: lead.domain ? {
            status: 'fetched',
            sourceUrl: `https://${lead.domain}`,
            fetchedAt: new Date().toISOString(),
            title: `${lead.companyName} | Official Homepage`,
            metaDescription: `${lead.companyName} provides high-performance B2B software solutions for modern teams.`,
            headings: ['Enterprise Solutions', 'Why Companies Choose Us', 'Schedule a Consultation'],
            mainContent: `${lead.companyName} is a leading provider in its sector, delivering specialized software and automation services.`,
            pagesFetched: [`https://${lead.domain}`, `https://${lead.domain}/about`],
          } : undefined,
          userCorrectedDescription: userCorrectedDescription || '',
        };

        setCompanyIntelligence(demoEnvelope);
        try {
          localStorage.setItem(`icp_mode_analysis_${lead.id}`, JSON.stringify(demoEnvelope));
        } catch {}
        addToast(`Demo intelligence generated for ${lead.companyName}.`, 'info');
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Company analysis failed.');
    } finally {
      setIsAnalyzingCompany(false);
    }
  };

  // 3. Save Description Correction handler
  const handleSaveDescription = async () => {
    if (!lead) return;
    const trimmed = editedDescription.trim();

    if (!trimmed) {
      setDescriptionSaveError('Description cannot be empty. Enter a valid company description.');
      return;
    }

    if (trimmed.length > 8000) {
      setDescriptionSaveError('Description must be 8,000 characters or fewer.');
      return;
    }

    setIsSavingDescription(true);
    setDescriptionSaveError(null);
    setDescriptionSuccessMessage(null);

    try {
      if (session?.access_token) {
        const response = await fetch(`/api/ai/company-intelligence/${lead.id}/description`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ description: trimmed }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to save description correction.');
        }
      }

      // Update local store and persistent state
      updateLeadDescription(lead.id, trimmed);
      setUserCorrectedDescription(trimmed);
      try {
        localStorage.setItem(`icp_mode_desc_${lead.id}`, trimmed);
      } catch {}

      setIsEditingDescription(false);
      setDescriptionSuccessMessage('Description correction saved. Human edit will take precedence in AI analysis.');
      addToast('Company description saved and locked.', 'success');
    } catch (err) {
      setDescriptionSaveError(err instanceof Error ? err.message : 'Unable to save description.');
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingDescription(false);
    setDescriptionSaveError(null);
    setEditedDescription(userCorrectedDescription || lead?.description || lead?.productRaw || '');
  };

  if (!lead) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-black">Company Not Found</h2>
          <BrutalistButton variant="lime" size="md" onClick={() => navigate('/companies')}>
            ← BACK TO COMPANIES
          </BrutalistButton>
        </div>
      </AppLayout>
    );
  }

  // Active description to display
  const activeDisplayDescription = userCorrectedDescription || lead.description || lead.productRaw || '[No product description provided]';

  // Helper for origin chips
  const renderOriginChip = (origin: string, confidence?: string) => {
    switch (origin) {
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-black uppercase text-emerald-900 bg-[#E5F7E5] border border-emerald-800 px-1.5 py-0.5 rounded">
            <Check className="w-2.5 h-2.5" /> VERIFIED UPLOAD
          </span>
        );
      case 'public_webpage':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-black uppercase text-[#0A0A0A] bg-[#E4E6FB] border border-[#0A0A0A] px-1.5 py-0.5 rounded">
            <Globe className="w-2.5 h-2.5" /> PUBLIC WEBSITE
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-black uppercase text-[#0A0A0A] bg-[#FFE3B3] border border-[#0A0A0A] px-1.5 py-0.5 rounded">
            <Sparkles className="w-2.5 h-2.5 text-amber-700" /> AI INFERENCE ({confidence || 'MED'})
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-black uppercase text-rose-900 bg-[#FFB6C2] border border-rose-800 px-1.5 py-0.5 rounded">
            <HelpCircle className="w-2.5 h-2.5" /> UNKNOWN / ABSENT
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-5">
          <button
            onClick={() => navigate('/companies')}
            className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO COMPANY DIRECTORY</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
              COHORT STATUS:
            </span>
            <StatusChip
              color={activeScore ? (activeScore.isDisqualified ? 'pink' : activeScore.totalScore >= 80 ? 'mint' : activeScore.totalScore >= 60 ? 'peach' : 'pink') : 'lavender'}
            >
              {activeScore ? activeScore.tier : 'ANALYSIS QUEUED'}
            </StatusChip>
          </div>
        </div>

        {/* Hard Disqualification Alert Banner (Prompt 12) */}
        {activeScore?.isDisqualified && (
          <div className="bg-[#FFB6C2] border-[3px] border-[#0A0A0A] rounded-2xl p-5 shadow-[4px_5px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-900" />
              <span className="font-mono text-xs font-black uppercase tracking-wider text-rose-950">
                DISQUALIFIED ACCOUNT // HARD EXCLUSION TRIGGERED
              </span>
            </div>
            <p className="text-sm font-black text-rose-950">
              {activeScore.disqualificationReason || 'Account excluded by seller targeting constraints.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1 text-rose-950">
              {activeScore.disqualificationEvidence && (
                <div>
                  <strong>Observed Evidence:</strong> {activeScore.disqualificationEvidence}
                </div>
              )}
              {activeScore.disqualificationConstraint && (
                <div>
                  <strong>Seller Constraint:</strong> {activeScore.disqualificationConstraint}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Company Heading & Core Metadata */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <SectionEyebrow color="bg-[#A1F000]">
              INDIVIDUAL COMPANY INTELLIGENCE
            </SectionEyebrow>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight">
                {lead.companyName}
              </h1>
              {lead.domain ? (
                <a
                  href={`https://${lead.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-bold text-[#8C6ADE] underline underline-offset-4 flex items-center gap-1"
                >
                  <span>{lead.domain}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="font-mono text-xs font-bold text-[#0A0A0A]/60 italic">
                  [No domain provided]
                </span>
              )}
            </div>

            <p className="font-mono text-xs text-[#0A0A0A]/70 font-semibold">
              RECORD ID: {lead.id} · ADDED: {new Date(lead.ingestedAt).toLocaleDateString()}
            </p>
          </div>

          {/* Large ICP Score Box or Queued Badge */}
          <div className="bg-white border-[3px] border-[#0A0A0A] rounded-2xl p-5 shadow-[5px_6px_0px_#0A0A0A] shrink-0 text-center min-w-[210px] space-y-2">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#0A0A0A]/60 block">
              DETERMINISTIC FIT
            </span>
            {activeScore ? (
              <>
                <div className="flex items-baseline justify-center gap-1.5 my-0.5 font-mono">
                  <span className="text-4xl font-black text-[#0A0A0A] tabular-nums">
                    {formatScore(activeScore.totalScore)}
                  </span>
                  <span className="text-sm font-bold text-[#0A0A0A]/40">/ 100</span>
                </div>

                <div className="flex flex-col items-center gap-1.5 pt-0.5">
                  <span className="font-mono text-[11px] font-black uppercase text-[#0A0A0A] bg-[#FFE3B3] px-2 py-0.5 rounded border border-[#0A0A0A] block">
                    {activeScore.recommendedAction}
                  </span>

                  {/* Evidence Coverage Pill (Prompt 12) */}
                  <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                    <span className="text-[#0A0A0A]/60">COVERAGE:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded border font-black ${
                        (activeScore.evidenceCoverage ?? 100) >= 70
                          ? 'bg-[#E5F7E5] border-emerald-800 text-emerald-950'
                          : 'bg-[#FFB6C2] border-rose-800 text-rose-950'
                      }`}
                    >
                      {activeScore.evidenceCoverage ?? 100}%
                    </span>
                  </div>

                  {/* Separate Buying Intent Pill (Prompt 12) */}
                  <span className="font-mono text-[9px] font-bold uppercase text-[#0A0A0A]/70 bg-[#F0EFEA] px-2 py-0.5 rounded border border-[#0A0A0A]/30 block">
                    {activeScore.intentLabel || 'BUYING INTENT: UNKNOWN'}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-2">
                <span className="font-mono text-xl font-black text-[#0A0A0A] block">
                  PENDING
                </span>
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/70 block mt-1">
                  Score queue ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Four Firmographic Specification Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">VERTICAL</span>
            <span className="font-black text-[#0A0A0A] text-sm block truncate">{lead.industry || '—'}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">HEADCOUNT</span>
            <span className="font-black text-[#0A0A0A] text-sm block tabular-nums">{formatHeadcount(lead.headcount)}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">REVENUE</span>
            <span className="font-black text-[#0A0A0A] text-sm block tabular-nums">{lead.annualRevenue || 'Undisclosed'}</span>
          </div>
          <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
            <span className="text-[#0A0A0A]/60 font-bold block mb-0.5">BUSINESS MODEL</span>
            <span className="font-black text-[#0A0A0A] text-sm block truncate">
              {lead.businessModel || lead.aiClassification?.businessModel || 'B2B SaaS'}
            </span>
          </div>
        </div>

        {/* Company Description & Human Correction Editor Card */}
        <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/15 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-lg font-black text-[#0A0A0A]">
                Company Description & Positioning
              </h2>
              {userCorrectedDescription ? (
                <StickerBadge color="purple" rotate="-2">
                  HUMAN VERIFIED
                </StickerBadge>
              ) : (
                <StatusChip color="lavender">
                  UPLOADED DATA
                </StatusChip>
              )}
            </div>

            {!isEditingDescription && (
              <BrutalistButton
                variant="white"
                size="sm"
                onClick={() => {
                  setIsEditingDescription(true);
                  setDescriptionSaveError(null);
                  setDescriptionSuccessMessage(null);
                }}
                icon={<Edit3 className="w-3.5 h-3.5" />}
              >
                EDIT DESCRIPTION
              </BrutalistButton>
            )}
          </div>

          {descriptionSuccessMessage && (
            <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl p-3 font-mono text-xs font-bold text-emerald-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                <span>{descriptionSuccessMessage}</span>
              </div>
              <button
                onClick={() => setDescriptionSuccessMessage(null)}
                className="text-xs hover:underline cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          )}

          {isEditingDescription ? (
            <div className="space-y-4 bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 sm:p-5 rounded-xl">
              <div className="space-y-1">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
                  EDIT HUMAN-CORRECTED DESCRIPTION
                </span>
                <p className="text-xs text-[#0A0A0A]/70 font-medium">
                  Modifying this description sets a verified human override. It will be preserved during all subsequent AI analyses and will never be overwritten silently.
                </p>
              </div>

              <BrutalistTextarea
                rows={4}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Enter accurate company description, primary products, and target audience..."
                disabled={isSavingDescription}
              />

              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#0A0A0A]/60 font-bold">
                  {editedDescription.length} / 8,000 characters
                </span>
                {descriptionSaveError && (
                  <span className="text-rose-600 font-black">
                    ⚠ {descriptionSaveError}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <BrutalistButton
                  variant="lime"
                  size="sm"
                  onClick={handleSaveDescription}
                  disabled={isSavingDescription}
                  icon={<Save className="w-3.5 h-3.5" />}
                >
                  {isSavingDescription ? 'SAVING CORRECTION…' : 'SAVE CORRECTION'}
                </BrutalistButton>

                <BrutalistButton
                  variant="white"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSavingDescription}
                >
                  CANCEL
                </BrutalistButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#0A0A0A] leading-relaxed bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A]/30 p-4 rounded-xl">
                {activeDisplayDescription}
              </p>
              {userCorrectedDescription && (
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#8C6ADE]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Human correction active. This text overrides raw CSV columns for all intelligence runs.</span>
                </div>
              )}
            </div>
          )}

          {/* Trigger Analysis Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-[#0A0A0A]/15">
            <div className="flex items-center gap-2">
              <BrutalistButton
                variant="lime"
                size="sm"
                onClick={runCompanyIntelligence}
                disabled={isAnalyzingCompany}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {isAnalyzingCompany ? 'ANALYZING COMPANY…' : companyIntelligence ? 'RE-RUN COMPANY INTELLIGENCE' : 'RUN COMPANY INTELLIGENCE'}
              </BrutalistButton>

              {companyIntelligence?.cached && (
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] bg-[#FFE3B3] px-2 py-1 rounded border border-[#0A0A0A]">
                  CACHED CONTENT MATCH
                </span>
              )}
            </div>

            {companyIntelligence && (
              <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/60">
                LAST ANALYZED: {new Date(companyIntelligence.analyzedAt).toLocaleString()}
              </span>
            )}
          </div>

          {analysisError && (
            <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] rounded-xl p-3 font-mono text-xs font-bold text-rose-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-800 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}
        </BrutalistCard>

        {/* Structured Company Intelligence Section */}
        {companyIntelligence ? (
          <div className="space-y-6">
            <BrutalistCard bg="lavender" shadowSize="lg" className="p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#8C6ADE]" />
                    <h2 className="text-xl font-black text-[#0A0A0A]">
                      Structured Company Intelligence
                    </h2>
                  </div>
                  <p className="font-mono text-xs text-[#0A0A0A]/70 font-bold mt-1">
                    PROVIDER: {companyIntelligence.provider.toUpperCase()} · MODEL: {companyIntelligence.modelVersion}
                  </p>
                </div>

                <StatusChip
                  color={companyIntelligence.analysis.data_quality.confidence === 'high' ? 'mint' : companyIntelligence.analysis.data_quality.confidence === 'medium' ? 'peach' : 'pink'}
                >
                  {companyIntelligence.analysis.data_quality.confidence.toUpperCase()} CONFIDENCE
                </StatusChip>
              </div>

              {/* Six Core Structural Claims with Provenance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {([
                  ['Company Type', companyIntelligence.analysis.company_type],
                  ['Industry', companyIntelligence.analysis.industry],
                  ['Sub-Industry', companyIntelligence.analysis.sub_industry],
                  ['Business Model', companyIntelligence.analysis.business_model],
                  ['Company Size', companyIntelligence.analysis.company_size],
                  ['Geography', companyIntelligence.analysis.geography],
                ] as const).map(([label, claim]) => (
                  <div
                    key={label}
                    className="bg-white border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                        {label}
                      </span>
                      {renderOriginChip(claim.origin, claim.confidence)}
                    </div>
                    <div className="font-black text-[#0A0A0A] text-sm">
                      {claim.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Products & Value Proposition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                      PRIMARY PRODUCTS & SERVICES
                    </span>
                    {renderOriginChip(companyIntelligence.analysis.products.origin)}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {companyIntelligence.analysis.products.value.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md font-bold text-[#0A0A0A]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                      TARGET CUSTOMERS & AUDIENCE
                    </span>
                    {renderOriginChip(companyIntelligence.analysis.target_customers.origin)}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {companyIntelligence.analysis.target_customers.value.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md font-bold text-[#0A0A0A]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Explicit Hypotheses: Needs & Buying Roles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-[#E5F7E5] border-[2.5px] border-[#0A0A0A] rounded-xl p-5 shadow-[3px_3px_0px_#0A0A0A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                      POTENTIAL BUSINESS NEEDS (HYPOTHESES)
                    </span>
                    <span className="font-mono text-[9px] font-black uppercase bg-white border border-[#0A0A0A] px-1.5 py-0.5 rounded">
                      UNVALIDATED
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs font-semibold text-[#0A0A0A] pt-1 list-disc pl-4">
                    {companyIntelligence.analysis.potential_business_needs.value.map((need, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {need}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] rounded-xl p-5 shadow-[3px_3px_0px_#0A0A0A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                      POTENTIAL BUYING ROLES (HYPOTHESES)
                    </span>
                    <span className="font-mono text-[9px] font-black uppercase bg-white border border-[#0A0A0A] px-1.5 py-0.5 rounded">
                      UNVALIDATED
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs font-semibold text-[#0A0A0A] pt-1 list-disc pl-4">
                    {companyIntelligence.analysis.potential_buying_roles.value.map((role, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {role}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </BrutalistCard>

            {/* Evidence & Provenance Section */}
            <BrutalistCard bg="mint" shadowSize="md" className="p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/20 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-900" />
                  <h3 className="text-lg font-black text-[#0A0A0A]">
                    Public Website Evidence & Provenance Audit
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#0A0A0A]/70">SOURCE MODE:</span>
                  <StatusChip color="lavender">
                    {companyIntelligence.sourceMode.toUpperCase()}
                  </StatusChip>
                </div>
              </div>

              {/* Website Enrichment Metadata */}
              {companyIntelligence.websiteEvidence ? (
                <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 shadow-[2px_2px_0px_#0A0A0A] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A0A0A]/15 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                        EXTRACTION STATUS:
                      </span>
                      <StatusChip
                        color={companyIntelligence.websiteEvidence.status === 'fetched' ? 'mint' : 'pink'}
                      >
                        {companyIntelligence.websiteEvidence.status.toUpperCase()}
                      </StatusChip>
                    </div>

                    {companyIntelligence.websiteEvidence.sourceUrl && (
                      <a
                        href={companyIntelligence.websiteEvidence.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs font-black text-[#8C6ADE] underline flex items-center gap-1"
                      >
                        <span>{companyIntelligence.websiteEvidence.sourceUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {companyIntelligence.websiteEvidence.status === 'fetched' ? (
                    <div className="space-y-2 text-xs">
                      {companyIntelligence.websiteEvidence.title && (
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block">PAGE TITLE</span>
                          <strong className="text-sm font-black">{companyIntelligence.websiteEvidence.title}</strong>
                        </div>
                      )}
                      {companyIntelligence.websiteEvidence.metaDescription && (
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block">META DESCRIPTION</span>
                          <p className="font-medium text-[#0A0A0A]/85">{companyIntelligence.websiteEvidence.metaDescription}</p>
                        </div>
                      )}
                      {companyIntelligence.websiteEvidence.headings.length > 0 && (
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block">OBSERVED HEADINGS</span>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {companyIntelligence.websiteEvidence.headings.slice(0, 6).map((heading, i) => (
                              <span key={i} className="bg-[#F9F8F4] border border-[#0A0A0A] px-2 py-0.5 rounded text-[11px] font-bold">
                                {heading}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#FFB6C2] border border-rose-800 p-3 rounded-lg text-xs font-bold text-rose-950">
                      Website extraction notice: {companyIntelligence.websiteEvidence.reason || 'Public website could not be safely reached or evaluated.'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 shadow-[2px_2px_0px_#0A0A0A] font-mono text-xs font-bold text-[#0A0A0A]/70 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#8C6ADE]" />
                  <span>No public domain supplied with lead record. Intelligence generated strictly from uploaded facts.</span>
                </div>
              )}

              {/* Data Quality & Missing Information Audit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                    MISSING RAW ATTRIBUTES
                  </span>
                  {companyIntelligence.analysis.data_quality.missing_fields.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5 font-bold text-amber-900">
                      {companyIntelligence.analysis.data_quality.missing_fields.map((field, idx) => (
                        <li key={idx}>{field}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="font-bold text-emerald-800">No critical firmographics missing.</span>
                  )}
                </div>

                <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                    GOVERNANCE LIMITATIONS
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 font-semibold text-[#0A0A0A]/80">
                    {companyIntelligence.analysis.data_quality.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </BrutalistCard>
          </div>
        ) : (
          <BrutalistCard bg="lavender" shadowSize="md" className="p-6 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-[#8C6ADE] mx-auto" />
            <h3 className="text-xl font-black text-[#0A0A0A]">
              Company Intelligence Ready to Generate
            </h3>
            <p className="text-xs text-[#0A0A0A]/75 font-medium max-w-md mx-auto">
              Run structured Gemini analysis on this company to infer business models, extract public website facts, and generate acute need hypotheses.
            </p>
            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={runCompanyIntelligence}
              disabled={isAnalyzingCompany}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              {isAnalyzingCompany ? 'ANALYZING COMPANY…' : 'RUN COMPANY INTELLIGENCE'}
            </BrutalistButton>
          </BrutalistCard>
        )}

        {/* Need Gap & Problem Explanation Card (Institutional Marketing Model) */}
        {richNeedGap ? (
          <BrutalistCard bg="peach" shadowSize="md" className="p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/20 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#0A0A0A]" />
                  <h3 className="text-xl font-black text-[#0A0A0A]">
                    Need Gap Analysis: {richNeedGap.relevantProblem}
                  </h3>
                </div>
                <p className="font-mono text-xs text-[#0A0A0A]/70 font-bold mt-1">
                  OFFERING: {offering.productName || offering.companyName} · PROBLEM-SOLUTION FIT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <StatusChip color={richNeedGap.problemIntensity === 'Acute' ? 'lime' : richNeedGap.problemIntensity === 'Moderate' ? 'peach' : 'white'}>
                  {richNeedGap.problemIntensity.toUpperCase()} NEED GAP
                </StatusChip>
                <StatusChip color={richNeedGap.confidence === 'high' ? 'mint' : richNeedGap.confidence === 'medium' ? 'peach' : 'pink'}>
                  {richNeedGap.confidence.toUpperCase()} CONFIDENCE
                </StatusChip>
              </div>
            </div>

            {/* Current State vs Desired Ideal State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5 shadow-[2px_2px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                  CURRENT OPERATIONAL STATE
                </span>
                <p className="text-xs font-bold text-[#0A0A0A] leading-relaxed">
                  {richNeedGap.currentState}
                </p>
              </div>

              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5 shadow-[2px_2px_0px_#0A0A0A]">
                <span className="font-mono text-[10px] font-black uppercase text-emerald-950 block">
                  DESIRED IDEAL STATE
                </span>
                <p className="text-xs font-extrabold text-emerald-950 leading-relaxed">
                  {richNeedGap.idealState}
                </p>
              </div>
            </div>

            {/* Acute Friction & Urgency Trigger */}
            <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                THE NEED GAP (FRICTION)
              </span>
              <p className="text-sm font-extrabold text-[#0A0A0A] leading-relaxed">
                {richNeedGap.needGap}
              </p>
              <div className="font-mono text-xs text-[#0A0A0A]/80 font-bold pt-1">
                <strong>Trigger for Change:</strong> {richNeedGap.motivationToChange}
              </div>
            </div>

            {/* Motivation Dynamics: Involvement, Outcome Attractiveness & Conflict */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">INVOLVEMENT</span>
                <div className="font-black text-sm">{richNeedGap.involvement}</div>
              </div>
              <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">OUTCOME ATTRACTIVENESS</span>
                <div className="font-black text-sm">{richNeedGap.outcomeAttractiveness}</div>
              </div>
              <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">MOTIVATIONAL CONFLICT</span>
                <div className="font-black text-sm">{richNeedGap.motivationalConflict || 'None Observed'}</div>
              </div>
            </div>

            {/* Value Tradeoff: Perceived Benefits vs Perceived Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5">
                <span className="font-mono text-xs font-black uppercase text-emerald-950 block">
                  PERCEIVED BENEFITS (VALUE EQUATION)
                </span>
                <ul className="list-disc pl-4 space-y-1 font-semibold text-emerald-950">
                  {richNeedGap.perceivedBenefits.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5">
                <span className="font-mono text-xs font-black uppercase text-rose-950 block">
                  PERCEIVED COSTS &amp; HURDLES
                </span>
                <ul className="list-disc pl-4 space-y-1 font-semibold text-rose-950">
                  {richNeedGap.perceivedCosts.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Valence: Approach vs Avoidance */}
            {(richNeedGap.approachMotivation || richNeedGap.avoidanceMotivation) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                {richNeedGap.approachMotivation && (
                  <div className="bg-white border-[2px] border-[#0A0A0A] p-3.5 rounded-xl space-y-1">
                    <span className="font-mono text-[10px] font-black uppercase text-emerald-900 block">
                      APPROACH MOTIVATION (TOWARD DESIRED OUTCOME)
                    </span>
                    <p className="font-semibold text-[#0A0A0A]">{richNeedGap.approachMotivation}</p>
                  </div>
                )}
                {richNeedGap.avoidanceMotivation && (
                  <div className="bg-white border-[2px] border-[#0A0A0A] p-3.5 rounded-xl space-y-1">
                    <span className="font-mono text-[10px] font-black uppercase text-rose-900 block">
                      AVOIDANCE MOTIVATION (AWAY FROM RISK)
                    </span>
                    <p className="font-semibold text-[#0A0A0A]">{richNeedGap.avoidanceMotivation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Unknowns & Governance Disclosures */}
            <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                GOVERNANCE: STRICTLY UNKNOWN ATTRIBUTES (NO INVENTED DATA)
              </span>
              <ul className="list-disc pl-4 space-y-1 font-bold text-amber-950 text-xs">
                {richNeedGap.unknowns.map((u, idx) => (
                  <li key={idx}>{u}</li>
                ))}
              </ul>
            </div>
          </BrutalistCard>
        ) : needGap && (
          <BrutalistCard bg="peach" shadowSize="md" className="p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#0A0A0A]" />
                <h3 className="text-lg font-black text-[#0A0A0A]">
                  Need Gap Analysis & Problem Gravity
                </h3>
              </div>
              <StatusChip color={needGap.gapMagnitude === 'Acute' ? 'lime' : 'peach'}>
                {needGap.gapMagnitude} Need Gap ({needGap.gapScore} pts)
              </StatusChip>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/70 block mb-1">
                  IDENTIFIED FRICTION
                </span>
                <p className="text-sm font-bold text-[#0A0A0A] leading-relaxed">
                  {needGap.identifiedNeed}
                </p>
                <div className="mt-2 text-[#0A0A0A]/85 font-medium">
                  <strong>Urgency Trigger:</strong> {needGap.urgencyDriver}
                </div>
              </div>

              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/70 block mb-1">
                  CONSEQUENCE OF INACTION
                </span>
                <p className="text-sm font-semibold text-[#0A0A0A]/90 leading-relaxed">
                  {needGap.consequenceOfInaction}
                </p>
                <div className="mt-2 text-[#0A0A0A]/85 font-medium">
                  <strong>Capability Match:</strong> {needGap.offeringCapabilityMatch}
                </div>
              </div>
            </div>
          </BrutalistCard>
        )}

        {/* STP Customer Segment Membership (Prompt 11) */}
        {richNeedGap && (
          <BrutalistCard bg="lavender" shadowSize="md" className="p-6 sm:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/20 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#8C6ADE]" />
                <h3 className="text-lg font-black text-[#0A0A0A]">
                  STP Customer Segment Membership
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip color="lime">
                  PRIMARY SEGMENT
                </StatusChip>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
                  ASSIGNED PRIMARY PROBLEM CLUSTER
                </span>
                <div className="text-base font-black text-[#0A0A0A]">
                  {richNeedGap.analysisStatus === 'insufficient_evidence'
                    ? 'Insufficient Evidence Quarantine'
                    : richNeedGap.relevantProblem.toLowerCase().includes('prospect') || richNeedGap.relevantProblem.toLowerCase().includes('outbound')
                    ? 'High-Velocity Outbound Prospecting Teams'
                    : richNeedGap.relevantProblem.toLowerCase().includes('crm') || richNeedGap.relevantProblem.toLowerCase().includes('decay')
                    ? 'CRM Data Decay & Account Enrichment Cohort'
                    : `${richNeedGap.relevantProblem} Cohort`}
                </div>
                <p className="text-xs text-[#0A0A0A]/75 font-medium mt-1">
                  Clustered on shared acute business friction rather than superficial industry classification alone.
                </p>
              </div>

              {/* Secondary Need Pattern Associations */}
              <div className="pt-2 border-t border-[#0A0A0A]/15">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1.5">
                  SECONDARY NEED PATTERN ASSOCIATIONS (TAGS)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {richNeedGap.relevantProductBenefits.length > 0 ? (
                    richNeedGap.relevantProductBenefits.map((b, idx) => (
                      <span
                        key={idx}
                        className="bg-white border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded text-xs font-mono font-bold text-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A]"
                      >
                        #{b.replace(/\s+/g, '-')}
                      </span>
                    ))
                  ) : (
                    <span className="font-mono text-xs text-[#0A0A0A]/60 font-bold">
                      No secondary tags assigned
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <BrutalistButton
                  variant="white"
                  size="sm"
                  onClick={() => navigate('/segments')}
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  VIEW COHORT SEGMENTATION &amp; TARGETING
                </BrutalistButton>
              </div>
            </div>
          </BrutalistCard>
        )}


        {/* Buying Unit & 5C Context (If Scored) */}
        {activeScore && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BrutalistCard bg="lavender" shadowSize="md" className="p-6 space-y-3">
              <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-2">
                <Users className="w-4 h-4 text-[#0A0A0A]" />
                <h3 className="text-base font-black text-[#0A0A0A]">
                  Target Buying Committee
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Economic Buyer</span>
                  <p className="font-extrabold text-[#0A0A0A] text-sm">{analysis.fiveC.customers.economicBuyer}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Internal Champion</span>
                  <p className="font-extrabold text-[#0A0A0A] text-sm">{analysis.fiveC.customers.championPersona}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">Primary Friction Obstacle</span>
                  <p className="text-[#0A0A0A] font-medium">{analysis.fiveC.customers.primaryObstacle}</p>
                </div>
              </div>
            </BrutalistCard>

            <BrutalistCard bg="mint" shadowSize="md" className="p-6 space-y-3">
              <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-2">
                <Layers className="w-4 h-4 text-[#0A0A0A]" />
                <h3 className="text-base font-black text-[#0A0A0A]">
                  Detected Architecture & Stack
                </h3>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <span className="text-[#0A0A0A]/60 font-bold block">DETECTED TECHNOLOGIES</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="bg-white border-[1.5px] border-[#0A0A0A] px-2 py-0.5 rounded-md font-bold text-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="font-sans text-[#0A0A0A]/80 font-medium text-xs pt-2">
                  Primary products: {lead.aiClassification?.primaryProducts?.join(', ') || 'Enterprise Platform'}
                </p>
              </div>
            </BrutalistCard>
          </div>
        )}

        {/* Itemized Score Ledger (If Scored) */}
        {activeScore && (
          <BrutalistCard bg="white" shadowSize="lg" className="p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/15 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#0A0A0A]">
                  Itemized Mathematical Point Ledger
                </h3>
                <p className="text-xs text-[#0A0A0A]/70 font-medium">
                  Transparent, explainable audit points contributing to {formatScore(activeScore.totalScore)} / 100.
                </p>
              </div>

              <BrutalistButton
                variant="white"
                size="sm"
                onClick={() => setShowScoreAuditDetails((prev) => !prev)}
                icon={showScoreAuditDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              >
                {showScoreAuditDetails ? 'COLLAPSE AUDIT' : 'EXPAND FULL AUDIT'}
              </BrutalistButton>
            </div>

            {/* Missing Information Notice (Prompt 12) */}
            {activeScore.missingFields && activeScore.missingFields.length > 0 && (
              <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] rounded-xl p-4 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="font-mono font-black uppercase text-[#0A0A0A]">
                    MISSING EVALUATION ATTRIBUTES ({activeScore.missingFields.length})
                  </span>
                </div>
                <p className="text-[#0A0A0A]/80 font-medium">
                  The following dimensions lacked verified account evidence: <strong>{activeScore.missingFields.join(', ')}</strong>.
                  Total evidence coverage is rated at <strong>{activeScore.evidenceCoverage ?? 100}%</strong>.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {activeScore.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-4 space-y-2 shadow-[2px_2px_0px_#0A0A0A]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-[#0A0A0A]">{item.criterion}</span>
                      <span className="text-[10px] font-bold bg-[#A1F000] border border-[#0A0A0A] px-1.5 py-0.2 rounded">
                        WEIGHT: {item.weightPct}%
                      </span>
                      {renderOriginChip(item.evidenceOrigin?.toLowerCase() || 'unknown', item.confidence)}
                    </div>

                    <span className="tabular-nums font-black text-base text-[#0A0A0A] shrink-0">
                      {item.awardedPoints} / {item.maxPoints} pts
                    </span>
                  </div>

                  <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
                    {item.auditRationale}
                  </p>

                  {showScoreAuditDetails && (
                    <div className="pt-2 border-t border-[#0A0A0A]/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-[#0A0A0A]/60 font-bold">DIMENSION RATING:</span>{' '}
                        <strong className="text-[#0A0A0A]">
                          {item.rating !== undefined ? (item.rating === 'UNKNOWN' ? 'UNKNOWN' : `${item.rating} / 100`) : `${item.awardedPoints} pts`}
                        </strong>
                      </div>
                      {item.missingInformation && (
                        <div className="text-amber-900 font-bold">
                          <span>MISSING DATA:</span> {item.missingInformation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Strengths & Disqualifiers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl p-4">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-700" /> Key Strengths
                </span>
                <ul className="space-y-1 text-xs font-medium text-[#0A0A0A]">
                  {activeScore.primaryStrengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] rounded-xl p-4">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> Disqualifiers &amp; Risk Flags
                </span>
                {activeScore.primaryDisqualifiers.length > 0 ? (
                  <ul className="space-y-1 text-xs font-bold text-rose-950">
                    {activeScore.primaryDisqualifiers.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-700 shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Zero disqualifiers observed.
                  </p>
                )}
              </div>
            </div>
          </BrutalistCard>
        )}
      </div>
    </AppLayout>
  );
};
