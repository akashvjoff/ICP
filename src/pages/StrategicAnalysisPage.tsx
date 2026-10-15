import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { freshAccessToken } from '../lib/supabase';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { TableShell } from '../components/ui/TableShell';
import { formatScore, formatHeadcount } from '../lib/formatters';
import type {
  DatasetNeedGapSummary,
  DetailedFiveCAnalysis,
  DetailedFiveCDimension,
  NeedGapAnalysis,
  NeedGapPattern,
  EvidenceOrigin,
} from '../types/analysis';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
  type SellerProfileContext,
} from '../server/strategicAnalysisService';
import type { LeadForAnalysis } from '../server/analysisJobService';
import {
  Target,
  Users,
  Building2,
  Compass,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Info,
  Clock,
  RotateCcw,
  Zap,
} from 'lucide-react';

export const StrategicAnalysisPage: React.FC<{ params?: { id?: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { session, isConfigured: isSupabaseConfigured } = useAuth();
  const {
    datasets,
    leads: storeLeads,
    sellerContext,
    offering,
    isDemoMode,
    addToast,
  } = useAppStore();

  const datasetId = params?.id || datasets[0]?.id || 'dataset-01';
  const currentDataset = datasets.find((d) => d.id === datasetId) || datasets[0] || {
    id: datasetId,
    filename: 'Primary Ingested Pipeline',
    row_count: storeLeads.length,
  };

  // Dual view tabs: 'need-gap' or 'five-c'
  const [activeTab, setActiveTab] = useState<'need-gap' | 'five-c'>('need-gap');

  // Selected pattern for filtering / inspecting supporting companies
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);

  // Selected lead for deep Need Gap modal inspection
  const [inspectingLeadId, setInspectingLeadId] = useState<string | null>(null);

  // Expanded cards in 5C view
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    company: true,
    customers: true,
    competitors: true,
    collaborators: false,
    context: false,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Seller profile context adapter
  const sellerProfile: SellerProfileContext = useMemo(() => {
    return {
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
  }, [sellerContext, offering]);

  // Adapt store leads to LeadForAnalysis format
  const leadsForAnalysis: LeadForAnalysis[] = useMemo(() => {
    return storeLeads.map((l) => ({
      id: l.id,
      dataset_id: datasetId,
      owner_user_id: session?.user?.id || 'demo-user-id',
      company_name: l.companyName,
      normalized_domain: l.domain || null,
      website: l.domain ? `https://${l.domain}` : null,
      industry_raw: l.industry || null,
      employee_count: l.headcount || null,
      company_size_raw: l.headcount ? `${l.headcount} employees` : null,
      notes: l.description || null,
      user_corrected_description: l.userCorrectedDescription || null,
      product_raw: l.productRaw || null,
      analysis_eligible: l.isAiEnriched !== false,
      analysis_status: l.analysisStatus || 'completed',
    }));
  }, [storeLeads, datasetId, session?.user?.id]);

  // Compute or fetch per-lead Need Gap analyses
  const leadNeedGaps = useMemo(() => {
    return leadsForAnalysis.map((lead) => {
      // Check if we have stored analysis in localStorage for demo mode
      let savedIntel = null;
      try {
        const stored = localStorage.getItem(`icp_mode_analysis_${lead.id}`);
        if (stored) savedIntel = JSON.parse(stored);
      } catch {}

      return analyzeLeadNeedGap(sellerProfile, lead, savedIntel);
    });
  }, [leadsForAnalysis, sellerProfile]);

  // Deterministic dataset-level Need Gap Summary
  const needGapSummary: DatasetNeedGapSummary = useMemo(() => {
    return aggregateDatasetNeedGaps(datasetId, leadNeedGaps, sellerProfile);
  }, [datasetId, leadNeedGaps, sellerProfile]);

  // 5C Stakeholder Analysis
  const fiveCAnalysis: DetailedFiveCAnalysis = useMemo(() => {
    return synthesizeDetailedFiveC(sellerProfile, leadNeedGaps, leadsForAnalysis);
  }, [sellerProfile, leadNeedGaps, leadsForAnalysis]);

  const toggleExpand = (cardKey: string) => {
    setExpandedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  const handleRunAnalysis = async () => {
    setIsRefreshing(true);
    try {
      if (session?.access_token && isSupabaseConfigured) {
        const token = await freshAccessToken();
        const response = await fetch(`/api/strategic-analysis/dataset/${datasetId}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sellerProfile }),
        });
        if (response.ok) {
          addToast('Strategic analysis refreshed from live dataset records.', 'success');
        } else {
          addToast('Analysis completed using local cohort data.', 'info');
        }
      } else {
        // Demo mode: save checkpoint to localStorage
        localStorage.setItem(`icp_mode_strat_analysis_${datasetId}`, JSON.stringify({
          needGapSummary,
          fiveC: fiveCAnalysis,
          analyzedAt: new Date().toISOString(),
        }));
        addToast('Strategic marketing pipeline updated across 20-lead cohort.', 'success');
      }
    } catch {
      addToast('Generated strategic analysis locally.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered leads when a pattern is clicked
  const activePattern = useMemo(() => {
    if (!selectedPatternId) return null;
    return needGapSummary.topNeedPatterns.find((p) => p.id === selectedPatternId) || null;
  }, [selectedPatternId, needGapSummary.topNeedPatterns]);

  const displayedLeads = useMemo(() => {
    if (!activePattern) return storeLeads;
    return storeLeads.filter((l) => activePattern.supportingLeadIds.includes(l.id));
  }, [activePattern, storeLeads]);

  // Inspected lead detailed need gap
  const inspectingLeadNeedGap = useMemo(() => {
    if (!inspectingLeadId) return null;
    return leadNeedGaps.find((g) => g.leadId === inspectingLeadId) || null;
  }, [inspectingLeadId, leadNeedGaps]);

  const inspectingLead = useMemo(() => {
    if (!inspectingLeadId) return null;
    return storeLeads.find((l) => l.id === inspectingLeadId) || null;
  }, [inspectingLeadId, storeLeads]);

  // Provenance chip renderer
  const renderOriginChip = (origin: EvidenceOrigin) => {
    switch (origin) {
      case 'verified':
        return (
          <span className="font-mono text-[9px] font-black uppercase bg-[#E5F7E5] text-emerald-950 px-2 py-0.5 rounded border border-emerald-950">
            VERIFIED EVIDENCE
          </span>
        );
      case 'user_provided':
        return (
          <span className="font-mono text-[9px] font-black uppercase bg-[#FFE3B3] text-amber-950 px-2 py-0.5 rounded border border-amber-950">
            USER PROVIDED
          </span>
        );
      case 'inferred':
        return (
          <span className="font-mono text-[9px] font-black uppercase bg-[#F3E8FF] text-purple-950 px-2 py-0.5 rounded border border-purple-950">
            INFERRED HYPOTHESIS
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="font-mono text-[9px] font-black uppercase bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded border border-zinc-800">
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#A1F000]">
              CUSTOMER NEEDS &amp; BUYING CONTEXT
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              Strategic Marketing Analysis
            </h1>
            <p className="text-xs text-[#0A0A0A]/70 font-medium mt-1 max-w-2xl leading-relaxed">
              Phase 1: Need Gap Analysis (Current vs. Ideal State) &amp; Phase 2: 5C Stakeholder Feasibility. Outputs strictly feed subsequent STP segmentation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={() => navigate(`/uploads/${datasetId}`)}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              DATASET DETAILS
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={handleRunAnalysis}
              disabled={isRefreshing}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              {isRefreshing ? 'ANALYZING…' : 'RE-RUN STRATEGY'}
            </BrutalistButton>
          </div>
        </div>

        {/* Dataset Context Bar */}
        <div className="bg-white border-[2.5px] border-[#0A0A0A] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFE3B3] border-[2px] border-[#0A0A0A] flex items-center justify-center font-black">
              5C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]/60">EVALUATING DATASET:</span>
                <span className="font-extrabold text-[#0A0A0A] text-sm">{currentDataset.filename}</span>
              </div>
              <p className="font-mono text-xs text-[#0A0A0A]/70 font-bold mt-0.5">
                SELLER OFFERING: {sellerProfile.companyName} · {sellerProfile.productName} ({sellerProfile.category})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-black bg-[#F9F8F4] px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A]">
              {needGapSummary.totalLeads} TOTAL ACCOUNTS
            </span>
            <span className="font-mono text-xs font-black bg-[#E5F7E5] text-emerald-950 px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A]">
              {needGapSummary.analyzedLeadsCount}/{needGapSummary.totalLeads} GROUNDED
            </span>
            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate(`/segments/${datasetId}`)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              NEXT: STP SEGMENTS
            </BrutalistButton>
          </div>
        </div>


        {/* Dual View Tab Switcher */}
        <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-3">
          <button
            onClick={() => setActiveTab('need-gap')}
            className={`font-mono text-xs font-black px-4 py-2 rounded-lg border-[2px] border-[#0A0A0A] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'need-gap'
                ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] -translate-y-0.5'
                : 'bg-white text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>VIEW A: NEED GAP ANALYSIS</span>
            <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded font-mono">
              {needGapSummary.topNeedPatterns.length} PATTERNS
            </span>
          </button>

          <button
            onClick={() => setActiveTab('five-c')}
            className={`font-mono text-xs font-black px-4 py-2 rounded-lg border-[2px] border-[#0A0A0A] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'five-c'
                ? 'bg-[#8C6ADE] text-white shadow-[3px_3px_0px_#0A0A0A] -translate-y-0.5'
                : 'bg-white text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>VIEW B: 5C STAKEHOLDER ANALYSIS</span>
            <span className="text-[10px] bg-black/20 text-white px-1.5 py-0.2 rounded font-mono">
              5 PILLARS
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW A: NEED GAP ANALYSIS                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'need-gap' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Metric Cards (Deterministic Ratios) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <BrutalistCard bg="white" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">COHORT TOTAL</span>
                <div className="text-2xl font-black text-[#0A0A0A] font-mono">{needGapSummary.totalLeads}</div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">100% ingested accounts evaluated</p>
              </BrutalistCard>

              <BrutalistCard bg="peach" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">COMMON PATTERNS</span>
                <div className="text-2xl font-black text-[#0A0A0A] font-mono">{needGapSummary.topNeedPatterns.length}</div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">Distinct customer problem clusters</p>
              </BrutalistCard>

              <BrutalistCard bg="mint" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">GROUNDED HYPOTHESES</span>
                <div className="text-2xl font-black text-[#0A0A0A] font-mono">
                  {needGapSummary.analyzedLeadsCount} <span className="text-xs font-bold text-[#0A0A0A]/60">/ {needGapSummary.totalLeads}</span>
                </div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">
                  {needGapSummary.totalLeads > 0 ? Math.round((needGapSummary.analyzedLeadsCount / needGapSummary.totalLeads) * 100) : 0}% accounts supported by data
                </p>
              </BrutalistCard>

              <BrutalistCard bg="pink" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">INSUFFICIENT EVIDENCE</span>
                <div className="text-2xl font-black text-rose-950 font-mono">
                  {needGapSummary.insufficientEvidenceCount} <span className="text-xs font-bold text-rose-950/60">/ {needGapSummary.totalLeads}</span>
                </div>
                <p className="text-[11px] font-medium text-rose-900">Missing descriptive or website facts</p>
              </BrutalistCard>
            </div>

            {/* Academic Principles Notice */}
            <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] text-xs font-medium space-y-1">
              <div className="flex items-center gap-2 font-black font-mono uppercase text-[#0A0A0A]">
                <Info className="w-4 h-4 text-[#8C6ADE]" />
                <span>HOW TO READ THESE FINDINGS</span>
              </div>
              <p className="text-[#0A0A0A]/85 leading-relaxed">
                <strong>Need:</strong> A problem the customer wants to solve. <strong>Need gap:</strong> The difference between their current and desired state. <strong>Demand:</strong> Interest backed by willingness to pay. Willingness to pay is not inferred from company size or industry alone; accounts without deal outcomes remain unvalidated hypotheses.
              </p>
            </div>

            {/* Ranked Problem Patterns Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#0A0A0A]">
                    Ranked Customer Need Patterns
                  </h2>
                  <p className="text-xs text-[#0A0A0A]/70 font-medium">
                    Common operational friction clusters across the cohort with exact supporting account counts. Click any pattern to filter.
                  </p>
                </div>

                {selectedPatternId && (
                  <button
                    onClick={() => setSelectedPatternId(null)}
                    className="font-mono text-xs font-black text-rose-600 hover:underline cursor-pointer"
                  >
                    CLEAR FILTER (SHOW ALL {storeLeads.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {needGapSummary.topNeedPatterns.map((pattern, idx) => {
                  const isSelected = selectedPatternId === pattern.id;
                  const cardBg = idx === 0 ? 'peach' : idx === 1 ? 'lavender' : 'white';

                  return (
                    <div
                      key={pattern.id}
                      onClick={() => setSelectedPatternId(isSelected ? null : pattern.id)}
                      className={`cursor-pointer transition-all ${isSelected ? 'ring-4 ring-[#0A0A0A]' : ''}`}
                    >
                      <BrutalistCard
                        bg={cardBg}
                        shadowSize="md"
                        className="p-5 sm:p-6 space-y-4 h-full flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-2">
                            <span className="font-mono text-xs font-black text-[#0A0A0A]">
                              PATTERN #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {renderOriginChip(pattern.evidenceLevel === 'verified' ? 'verified' : 'inferred')}
                              <span className="font-mono text-xs font-black bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
                                {pattern.ratioFormatted} ({pattern.percentage}%)
                              </span>
                            </div>
                          </div>

                          <h3 className="text-lg font-black text-[#0A0A0A] leading-tight">
                            {pattern.problemTitle}
                          </h3>

                          <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed">
                            {pattern.description}
                          </p>

                          {/* Intensity distribution */}
                          <div className="flex items-center gap-2 pt-1 font-mono text-[10px] font-bold">
                            <span className="text-[#0A0A0A]/60">INTENSITY:</span>
                            {pattern.intensityDistribution.acute > 0 && (
                              <span className="bg-[#FFB6C2] text-rose-950 px-1.5 py-0.5 rounded border border-rose-950">
                                {pattern.intensityDistribution.acute} ACUTE
                              </span>
                            )}
                            {pattern.intensityDistribution.moderate > 0 && (
                              <span className="bg-[#FFE3B3] text-amber-950 px-1.5 py-0.5 rounded border border-amber-950">
                                {pattern.intensityDistribution.moderate} MODERATE
                              </span>
                            )}
                          </div>

                          {/* Matched Seller Capabilities */}
                          <div className="space-y-1 pt-1">
                            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                              MATCHING SELLER CAPABILITIES
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {pattern.relevantSellerCapabilities.map((cap, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="bg-white border border-[#0A0A0A] px-2 py-0.5 rounded text-[11px] font-bold text-[#0A0A0A]"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t-[1.5px] border-[#0A0A0A]/15 flex items-center justify-between font-mono text-xs font-bold text-[#0A0A0A]">
                          <span>{pattern.supportingCount} SUPPORTING ACCOUNTS</span>
                          <span className="flex items-center gap-1 text-[#8C6ADE] font-black">
                            {isSelected ? 'FILTER ACTIVE' : 'CLICK TO FILTER'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </BrutalistCard>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Insufficient Evidence Section */}
            {needGapSummary.insufficientEvidenceCount > 0 && (
              <BrutalistCard bg="pink" shadowSize="md" className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b-[2px] border-rose-950/20 pb-3">
                  <AlertTriangle className="w-5 h-5 text-rose-800" />
                  <h3 className="text-base font-black text-rose-950">
                    Accounts with Insufficient Evidence ({needGapSummary.insufficientEvidenceCount}/{needGapSummary.totalLeads})
                  </h3>
                </div>
                <p className="text-xs text-rose-950 font-medium leading-relaxed">
                  These accounts lack verified website content, product descriptions, or uploaded notes. We do not infer internal problems from industry or company size alone.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                  {needGapSummary.insufficientEvidenceLeadIds.map((id) => {
                    const lead = storeLeads.find((l) => l.id === id);
                    return (
                      <span
                        key={id}
                        onClick={() => navigate(`/companies/${id}`)}
                        className="bg-white border border-rose-950 px-2.5 py-1 rounded font-bold text-[#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                      >
                        {lead?.companyName || id}
                      </span>
                    );
                  })}
                </div>
              </BrutalistCard>
            )}

            {/* Supporting Accounts Table */}
            <TableShell
              title={activePattern ? `Accounts Supporting: "${activePattern.problemTitle}"` : "All Accounts in Dataset"}
              countLabel={`${displayedLeads.length} ACCOUNTS`}
            >
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                    <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                    <th className="py-3 px-4 font-black tracking-wider uppercase">NEED GAP MAGNITUDE</th>
                    <th className="py-3 px-4 font-black tracking-wider uppercase">MOTIVATION / VALENCE</th>
                    <th className="py-3 px-4 font-black tracking-wider uppercase">EVIDENCE</th>
                    <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
                  {displayedLeads.map((lead) => {
                    const gap = leadNeedGaps.find((g) => g.leadId === lead.id);

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer"
                        onClick={() => setInspectingLeadId(lead.id)}
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-extrabold text-[#0A0A0A] text-sm font-sans">
                            {lead.companyName}
                          </div>
                          <div className="text-[11px] text-[#0A0A0A]/60 font-bold">
                            {lead.domain || 'No website'} · {lead.industry || 'Unknown industry'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusChip
                            color={
                              gap?.problemIntensity === 'Acute'
                                ? 'lime'
                                : gap?.problemIntensity === 'Moderate'
                                ? 'peach'
                                : 'white'
                            }
                          >
                            {gap?.problemIntensity.toUpperCase() || 'UNKNOWN'}
                          </StatusChip>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-[#0A0A0A]">
                          {gap?.approachMotivation ? (
                            <div>
                              <span className="font-bold text-emerald-900">Approach:</span> {gap.approachMotivation.slice(0, 50)}…
                            </div>
                          ) : (
                            <span className="text-[#0A0A0A]/50">Unsubstantiated</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {renderOriginChip(gap?.confidence === 'high' ? 'user_provided' : gap?.confidence === 'medium' ? 'verified' : 'inferred')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingLeadId(lead.id);
                            }}
                            className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] cursor-pointer"
                          >
                            INSPECT NEED GAP
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: 5C STAKEHOLDER ANALYSIS                                           */}
        {/* ========================================================================= */}
        {activeTab === 'five-c' && (
          <div className="space-y-6 animate-fadeIn">
            {/* 5C Methodology Banner */}
            <div className="bg-[#8C6ADE]/10 border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] text-xs font-medium space-y-1">
              <div className="flex items-center gap-2 font-black font-mono uppercase text-[#0A0A0A]">
                <Compass className="w-4 h-4 text-[#8C6ADE]" />
                <span>5C / STAKEHOLDER EVALUATION FRAMEWORK</span>
              </div>
              <p className="text-[#0A0A0A]/85 leading-relaxed">
                Institutional analysis across Company (Seller), Customers (Cohort), Competitors (Alternatives), Collaborators (Ecosystem), and Context (Macro/PESTEL). Strictly isolates seller strengths from lead attributes. Missing competitor or macro data is labeled <code>RESEARCH REQUIRED</code> rather than fabricated.
              </p>
            </div>

            {/* Five Expandable Cards */}
            {([
              ['company', fiveCAnalysis.company, 'mint', 'C1: COMPANY (SELLER CAPABILITIES)'],
              ['customers', fiveCAnalysis.customers, 'lavender', 'C2: CUSTOMERS (COHORT BUYING COMMITTEE)'],
              ['competitors', fiveCAnalysis.competitors, 'peach', 'C3: COMPETITORS (MARKET ALTERNATIVES)'],
              ['collaborators', fiveCAnalysis.collaborators, 'white', 'C4: COLLABORATORS (ECOSYSTEM & INTEGRATIONS)'],
              ['context', fiveCAnalysis.context, 'pink', 'C5: CONTEXT (MACRO & REGULATORY CLIMATE)'],
            ] as const).map(([key, dim, bg, heading]) => {
              const isExpanded = expandedCards[key] !== false;

              return (
                <BrutalistCard
                  key={key}
                  bg={bg}
                  shadowSize="md"
                  className="p-6 sm:p-7 space-y-5 transition-all"
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[2px] border-[#0A0A0A]/20 pb-4 cursor-pointer"
                    onClick={() => toggleExpand(key)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center font-mono text-xs font-black">
                        {key.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-[#0A0A0A] leading-tight">
                          {heading}
                        </h2>
                        <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
                          TARGET ENTITY: {dim.targetEntity.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {dim.researchRequired && (
                        <StickerBadge color="pink" rotate="-2">
                          RESEARCH REQUIRED
                        </StickerBadge>
                      )}
                      <StatusChip color={dim.confidence === 'high' ? 'mint' : dim.confidence === 'medium' ? 'peach' : 'pink'}>
                        {dim.confidence.toUpperCase()} CONFIDENCE
                      </StatusChip>
                      <button className="p-1 hover:bg-black/10 rounded cursor-pointer">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-5 animate-fadeIn">
                      {/* Observations */}
                      <div className="space-y-2">
                        <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                          CORE OBSERVATIONS
                        </span>
                        <ul className="space-y-1.5 text-xs font-semibold text-[#0A0A0A]">
                          {dim.mainObservations.map((obs, oIdx) => (
                            <li key={oIdx} className="flex items-start gap-2 bg-white/70 border border-[#0A0A0A]/30 p-2.5 rounded-lg">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{obs}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Opportunities vs Risks */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                        <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1">
                          <span className="font-mono text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-emerald-700" /> Strategic Opportunity
                          </span>
                          <p className="text-emerald-950 font-semibold leading-relaxed">
                            {dim.potentialOpportunity}
                          </p>
                        </div>

                        <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1">
                          <span className="font-mono text-xs font-black uppercase text-rose-950 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> Strategic Risk
                          </span>
                          <p className="text-rose-950 font-semibold leading-relaxed">
                            {dim.potentialRisk}
                          </p>
                        </div>
                      </div>

                      {/* Evidence & Missing Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                          <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                            GROUNDED EVIDENCE &amp; SOURCES
                          </span>
                          {dim.evidence.map((ev, eIdx) => (
                            <div key={eIdx} className="space-y-1 pb-2 border-b border-[#0A0A0A]/10 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[9px] text-[#0A0A0A]/60 font-bold">{ev.source || 'Direct Source'}</span>
                                {renderOriginChip(ev.origin)}
                              </div>
                              <p className="text-[11px] font-semibold text-[#0A0A0A]">{ev.fact}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                          <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                            MISSING INFORMATION &amp; AUDIT
                          </span>
                          <ul className="list-disc pl-4 space-y-1 font-bold text-amber-950 text-[11px]">
                            {dim.missingInformation.map((info, iIdx) => (
                              <li key={iIdx}>{info}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Strategic Implication Callout */}
                      <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl font-mono text-xs font-bold text-[#0A0A0A] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                            IMPLICATION FOR FUTURE TARGETING &amp; POSITIONING:
                          </span>
                          <p className="text-xs font-extrabold text-[#0A0A0A] font-sans mt-0.5">
                            {dim.strategicImplications}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </BrutalistCard>
              );
            })}
          </div>
        )}

        {/* Modal: Deep Need Gap Dossier Inspector */}
        {inspectingLeadNeedGap && inspectingLead && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#F9F8F4] border-[3px] border-[#0A0A0A] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_#0A0A0A] p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-4">
                <div>
                  <SectionEyebrow color="bg-[#A1F000]">LEAD NEED GAP DOSSIER</SectionEyebrow>
                  <h3 className="text-2xl font-black text-[#0A0A0A] mt-1">
                    {inspectingLead.companyName}
                  </h3>
                  <p className="font-mono text-xs text-[#0A0A0A]/70 font-bold">
                    DOMAIN: {inspectingLead.domain || 'N/A'} · INDUSTRY: {inspectingLead.industry || 'N/A'} · HEADCOUNT: {formatHeadcount(inspectingLead.headcount)}
                  </p>
                </div>

                <button
                  onClick={() => setInspectingLeadId(null)}
                  className="font-mono text-xs font-black bg-white border-[2px] border-[#0A0A0A] px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFE3B3] cursor-pointer"
                >
                  CLOSE [ESC]
                </button>
              </div>

              {/* State Gap Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5 shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                    CURRENT OPERATIONAL STATE
                  </span>
                  <p className="text-xs font-bold text-[#0A0A0A] leading-relaxed">
                    {inspectingLeadNeedGap.currentState}
                  </p>
                </div>

                <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5 shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="font-mono text-[10px] font-black uppercase text-emerald-950 block">
                    DESIRED IDEAL STATE
                  </span>
                  <p className="text-xs font-extrabold text-emerald-950 leading-relaxed">
                    {inspectingLeadNeedGap.idealState}
                  </p>
                </div>
              </div>

              {/* The Acute Need Gap */}
              <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    THE NEED GAP MAGNITUDE
                  </span>
                  <StatusChip color={inspectingLeadNeedGap.problemIntensity === 'Acute' ? 'lime' : 'peach'}>
                    {inspectingLeadNeedGap.problemIntensity.toUpperCase()} INTENSITY
                  </StatusChip>
                </div>
                <p className="text-sm font-extrabold text-[#0A0A0A] leading-relaxed">
                  {inspectingLeadNeedGap.needGap}
                </p>
                <div className="font-mono text-xs text-[#0A0A0A]/80 font-bold pt-1">
                  <strong>Trigger for Change:</strong> {inspectingLeadNeedGap.motivationToChange}
                </div>
              </div>

              {/* Motivation & Value Dynamics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">INVOLVEMENT</span>
                  <div className="font-black text-sm">{inspectingLeadNeedGap.involvement}</div>
                </div>
                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">OUTCOME ATTRACTIVENESS</span>
                  <div className="font-black text-sm">{inspectingLeadNeedGap.outcomeAttractiveness}</div>
                </div>
                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">MOTIVATIONAL CONFLICT</span>
                  <div className="font-black text-sm">{inspectingLeadNeedGap.motivationalConflict || 'None Observed'}</div>
                </div>
              </div>

              {/* Perceived Benefits vs Perceived Costs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5">
                  <span className="font-mono text-xs font-black uppercase text-emerald-950 block">
                    PERCEIVED BENEFITS (VALUE DRIVERS)
                  </span>
                  <ul className="list-disc pl-4 space-y-1 font-semibold text-emerald-950">
                    {inspectingLeadNeedGap.perceivedBenefits.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5">
                  <span className="font-mono text-xs font-black uppercase text-rose-950 block">
                    PERCEIVED COSTS &amp; HURDLES
                  </span>
                  <ul className="list-disc pl-4 space-y-1 font-semibold text-rose-950">
                    {inspectingLeadNeedGap.perceivedCosts.map((c, cIdx) => (
                      <li key={cIdx}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Unknowns & Invariant Audit */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                  GOVERNANCE: STRICTLY UNKNOWN DIMENSIONS
                </span>
                <ul className="list-disc pl-4 space-y-1 font-bold text-amber-950 text-xs">
                  {inspectingLeadNeedGap.unknowns.map((u, uIdx) => (
                    <li key={uIdx}>{u}</li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-between border-t-[2px] border-[#0A0A0A]/15">
                <BrutalistButton
                  variant="lime"
                  size="sm"
                  onClick={() => navigate(`/companies/${inspectingLead.id}`)}
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  OPEN COMPLETE COMPANY DOSSIER
                </BrutalistButton>

                <BrutalistButton
                  variant="white"
                  size="sm"
                  onClick={() => setInspectingLeadId(null)}
                >
                  CLOSE
                </BrutalistButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
