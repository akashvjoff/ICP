import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { freshAccessToken } from '../lib/supabase';
import { deriveTierCounts, qualifiedSegmentAnalysis } from '../lib/tiers';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import type {
  CustomerSegment,
  DatasetSTPAnalysis,
  SegmentPositioning,
  SegmentTargetingAssessment,
} from '../types/analysis';
import type { LeadForAnalysis } from '../server/analysisJobService';
import type { SellerProfileContext } from '../server/strategicAnalysisService';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
} from '../server/strategicAnalysisService';
import { analyzeSegmentOutcomes, buildDatasetSTPAnalysis } from '../server/stpService';
import {
  Users,
  Target,
  Compass,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SegmentsPageProps {
  params?: {
    id: string;
  };
}

export const SegmentsPage: React.FC<SegmentsPageProps> = ({ params }) => {
  const { navigate } = useRouter();
  const { session } = useAuth();
  const {
    datasets,
    activeDatasetId,
    leads: storeLeads,
    offering,
    sellerContext,
    analysis,
    scores,
    addToast,
  } = useAppStore();

  const datasetId = params?.id || activeDatasetId || datasets[0]?.id || 'dataset-01';
  const currentDataset = datasets.find((d) => d.id === datasetId) || datasets[0] || {
    id: datasetId,
    filename: 'Primary Ingested Pipeline',
    row_count: storeLeads.length,
  };

  // 3 Core View Tabs
  const [activeTab, setActiveTab] = useState<'segmentation' | 'targeting' | 'positioning'>('segmentation');

  // Selected segment for deep inspection modal or positioning view
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [inspectingSegment, setInspectingSegment] = useState<CustomerSegment | null>(null);

  // Expandable targeting explanation
  const [showTargetingMath, setShowTargetingMath] = useState<boolean>(false);

  // Copy positioning statement state
  const [copiedStatement, setCopiedStatement] = useState<boolean>(false);

  // Loading & network state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Seller profile adapter
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

  // Lead adapters
  const leadsForAnalysis: LeadForAnalysis[] = useMemo(() => {
    return storeLeads.map((l) => ({
      id: l.id,
      dataset_id: datasetId,
      owner_user_id: session?.user?.id || 'demo-user',
      company_name: l.companyName,
      normalized_domain: l.domain || null,
      website: l.website || (l.domain ? `https://${l.domain}` : null),
      industry_raw: l.industry || null,
      employee_count: l.headcount || null,
      company_size_raw: l.headcount ? `${l.headcount} employees` : null,
      notes: l.userCorrectedDescription || l.description || null,
      user_corrected_description: l.userCorrectedDescription || null,
      product_raw: l.productRaw || null,
      analysis_eligible: l.isAiEnriched !== false,
      analysis_status: l.analysisStatus || 'completed',
      raw_row: (l.rawRow || {}) as Record<string, unknown>,
    }));
  }, [storeLeads, datasetId, session?.user?.id]);

  // Fallback local STP analysis generator
  const computeLocalSTP = useCallback((): DatasetSTPAnalysis => {
    const needGaps = leadsForAnalysis.map((lead) => {
      return analyzeLeadNeedGap(sellerProfile, lead);
    });

    const needGapSummary = aggregateDatasetNeedGaps(datasetId, needGaps, sellerProfile);
    const fiveC = synthesizeDetailedFiveC(sellerProfile, needGaps, leadsForAnalysis);
    const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

    return buildDatasetSTPAnalysis(
      sellerProfile,
      datasetId,
      needGapSummary,
      fiveC,
      leadsForAnalysis,
      gapsMap
    );
  }, [leadsForAnalysis, sellerProfile, datasetId]);

  // Active STP Analysis state
  const [storedStpAnalysis, setStpAnalysis] = useState<DatasetSTPAnalysis>(() => {
    try {
      const saved = localStorage.getItem(`icp_mode_stp_${datasetId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return computeLocalSTP();
  });
  const tierCounts = deriveTierCounts(scores, session ? storeLeads : undefined);
  const stpAnalysis = useMemo(() => {
    const qualified = qualifiedSegmentAnalysis(storedStpAnalysis, scores, session ? storeLeads : undefined);
    qualified.segments = qualified.segments.map(segment => ({
      ...segment,
      outcomes: analyzeSegmentOutcomes(leadsForAnalysis.filter(lead => segment.primaryCompanyIds.includes(lead.id))),
    }));
    return qualified;
  }, [storedStpAnalysis, scores, session, storeLeads, leadsForAnalysis]);

  // Load from backend on mount
  const fetchBackendSTP = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const res = await fetch(`/api/stp/dataset/${datasetId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.stpAnalysis) {
          setStpAnalysis(data.stpAnalysis);
          try {
            localStorage.setItem(`icp_mode_stp_${datasetId}`, JSON.stringify(data.stpAnalysis));
          } catch {}
          return;
        }
      }

      // If backend has no pre-existing STP analysis, run local computation
      const fallback = computeLocalSTP();
      setStpAnalysis(fallback);
      try {
        localStorage.setItem(`icp_mode_stp_${datasetId}`, JSON.stringify(fallback));
      } catch {}
    } catch {
      const fallback = computeLocalSTP();
      setStpAnalysis(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, session?.access_token, computeLocalSTP]);

  useEffect(() => {
    void fetchBackendSTP();
  }, [fetchBackendSTP]);

  // Re-run STP Analysis
  const handleRerunSTP = async () => {
    setIsRefreshing(true);
    try {
      const token = session?.access_token ? await freshAccessToken() : 'demo-token';
      const res = await fetch(`/api/stp/dataset/${datasetId}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sellerProfile }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.stpAnalysis) {
          setStpAnalysis(data.stpAnalysis);
          try {
            localStorage.setItem(`icp_mode_stp_${datasetId}`, JSON.stringify(data.stpAnalysis));
          } catch {}
          addToast('STP segment clusters, targeting, and positioning refreshed.', 'success');
          return;
        }
      }

      // Local computation fallback
      const recomputed = computeLocalSTP();
      setStpAnalysis(recomputed);
      try {
        localStorage.setItem(`icp_mode_stp_${datasetId}`, JSON.stringify(recomputed));
      } catch {}
      addToast('STP segments recomputed locally.', 'success');
    } catch {
      const recomputed = computeLocalSTP();
      setStpAnalysis(recomputed);
      addToast('STP segments recomputed locally.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Pastel card color selector
  const getPastelBg = (index: number): 'mint' | 'peach' | 'lavender' | 'pink' => {
    const bgs: Array<'mint' | 'peach' | 'lavender' | 'pink'> = ['mint', 'peach', 'lavender', 'pink'];
    return bgs[index % bgs.length];
  };

  // Currently selected segment for positioning tab
  const activePositioningSegment = useMemo(() => {
    if (selectedSegmentId) {
      const found = stpAnalysis.segments.find((s) => s.id === selectedSegmentId);
      if (found) return found;
    }
    // Default to recommended or first non-quarantine segment
    return (
      stpAnalysis.segments.find((s) => !s.isInsufficientEvidenceGroup) ||
      stpAnalysis.segments[0]
    );
  }, [selectedSegmentId, stpAnalysis.segments]);

  const activePositioning = useMemo(() => {
    if (!activePositioningSegment) return null;
    return stpAnalysis.positioningRecommendations[activePositioningSegment.id] || null;
  }, [activePositioningSegment, stpAnalysis.positioningRecommendations]);

  const activeTargeting = useMemo(() => {
    if (!activePositioningSegment) return null;
    return stpAnalysis.targetingAssessments[activePositioningSegment.id] || null;
  }, [activePositioningSegment, stpAnalysis.targetingAssessments]);

  // Copy positioning statement to clipboard
  const handleCopyPositioning = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatement(true);
    addToast('Positioning statement copied to clipboard.', 'success');
    setTimeout(() => setCopiedStatement(false), 3000);
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* ========================================================================= */}
        {/* PAGE HEADER (Exact Milestone Design & Monospace Eyebrow)                 */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#A1F000]">FIND YOUR PEOPLE</SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight mt-1">
              Not all customers are created equal.
            </h1>
            <p className="text-xs sm:text-sm text-[#0A0A0A]/75 font-medium mt-1.5 max-w-2xl leading-relaxed">
              Discover the groups that share the same problems — and identify which ones your product is best positioned to serve.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={() => navigate(`/strategy/${datasetId}`)}
              icon={<Compass className="w-3.5 h-3.5" />}
            >
              5C STRATEGY
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={handleRerunSTP}
              disabled={isRefreshing || isLoading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              {isRefreshing ? 'RECOMPUTING…' : 'RECOMPUTE STP'}
            </BrutalistButton>
          </div>
        </div>

        {/* Dataset Context Callout */}
        <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8C6ADE]" />
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                PROBLEM-FIRST CLUSTERING CONTEXT
              </span>
            </div>
            <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed max-w-2xl">
              Clustered from dataset <strong className="font-mono">{currentDataset.filename}</strong> against offering{' '}
              <strong>{sellerProfile.companyName} ({sellerProfile.productName})</strong>. Accounts share primary membership without double-counting.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs font-black bg-white px-3 py-1.5 rounded-lg border border-[#0A0A0A] text-center">
              {stpAnalysis.candidateSegmentsCount} CANDIDATE SEGMENTS
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW NAVIGATION TABS (VIEW A, VIEW B, VIEW C)                             */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-3 flex-wrap">
          <button
            onClick={() => setActiveTab('segmentation')}
            className={`font-mono text-xs font-black px-4 py-2.5 rounded-lg border-[2px] border-[#0A0A0A] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'segmentation'
                ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] -translate-y-0.5'
                : 'bg-white text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>VIEW A: SEGMENTATION</span>
            <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded font-mono">
              {stpAnalysis.segments.length} CLUSTERS
            </span>
          </button>

          <button
            onClick={() => setActiveTab('targeting')}
            className={`font-mono text-xs font-black px-4 py-2.5 rounded-lg border-[2px] border-[#0A0A0A] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'targeting'
                ? 'bg-[#8C6ADE] text-white shadow-[3px_3px_0px_#0A0A0A] -translate-y-0.5'
                : 'bg-white text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>VIEW B: TARGETING</span>
            <span className="text-[10px] bg-black/20 text-white px-1.5 py-0.2 rounded font-mono">
              ATTRACTIVENESS
            </span>
          </button>

          <button
            onClick={() => setActiveTab('positioning')}
            className={`font-mono text-xs font-black px-4 py-2.5 rounded-lg border-[2px] border-[#0A0A0A] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'positioning'
                ? 'bg-[#FFE3B3] text-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] -translate-y-0.5'
                : 'bg-white text-[#0A0A0A]/70 hover:bg-[#FFE3B3]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>VIEW C: POSITIONING</span>
            <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded font-mono">
              POP &amp; POD
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW A: SEGMENTATION                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'segmentation' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top 4 KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <BrutalistCard bg="white" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                  ANALYZED ACCOUNTS
                </span>
                <div className="text-2xl font-black text-[#0A0A0A] font-mono">
                  {tierCounts.analyzed}
                </div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">
                  {tierCounts.pending} pending
                </p>
              </BrutalistCard>

              <BrutalistCard bg="white" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                  CANDIDATE SEGMENTS
                </span>
                <div className="text-2xl font-black text-[#8C6ADE] font-mono">
                  {stpAnalysis.candidateSegmentsCount}
                </div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">
                  Shared problem clusters
                </p>
              </BrutalistCard>

              <BrutalistCard bg="white" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                  LOW-DATA SCORES
                </span>
                <div className="text-2xl font-black text-amber-700 font-mono">
                  {tierCounts.lowData}
                </div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">
                  {scores.length > 0
                    ? `${Math.round((tierCounts.lowData / scores.length) * 100)}% of scored accounts`
                    : 'No scores yet'}
                </p>
              </BrutalistCard>

              <BrutalistCard bg="white" shadowSize="sm" className="p-4 space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60">
                  EVIDENCE CONFIDENCE
                </span>
                <div className="text-2xl font-black text-emerald-800 font-mono">
                  {stpAnalysis.segments.some((s) => s.confidence === 'high') ? 'HIGH' : 'MODERATE'}
                </div>
                <p className="text-[11px] font-medium text-[#0A0A0A]/70">
                  Grounded hypotheses
                </p>
              </BrutalistCard>
            </div>

            {/* Candidate Segment Cards Grid */}
            {stpAnalysis.segments.length === 0 ? (
              <EmptyState
                title="No Candidate Segments Identified"
                description="Upload company records and run strategic analysis to formulate grounded problem clusters."
                actionText="UPLOAD COMPANY LEADS"
                onAction={() => navigate('/uploads/new')}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stpAnalysis.segments.map((segment, idx) => {
                  const bg = segment.isInsufficientEvidenceGroup ? 'white' : getPastelBg(idx);
                  const assessment = stpAnalysis.targetingAssessments[segment.id];
                  const matchedLeads = storeLeads.filter((l) =>
                    segment.primaryCompanyIds.includes(l.id)
                  );

                  return (
                    <BrutalistCard
                      key={segment.id}
                      bg={bg}
                      shadowSize="md"
                      className={`p-6 flex flex-col justify-between space-y-5 transition-transform hover:-translate-y-1 cursor-pointer border-[2.5px] border-[#0A0A0A] ${
                        segment.isInsufficientEvidenceGroup ? 'opacity-90 border-dashed' : ''
                      }`}
                      onClick={() => setInspectingSegment(segment)}
                    >
                      <div className="space-y-4">
                        {/* Top: Badges & Exclusive Share */}
                        <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
                          <StatusChip
                            color={
                              segment.isInsufficientEvidenceGroup
                                ? 'pink'
                                : assessment?.recommendationTier === 'Recommended Target'
                                ? 'lime'
                                : assessment?.recommendationTier === 'Provisional Shortlist'
                                ? 'peach'
                                : 'lavender'
                            }
                          >
                            {assessment?.recommendationTier?.toUpperCase() || 'PROVISIONAL'}
                          </StatusChip>

                          <span className="font-mono text-xs font-black text-[#0A0A0A]">
                            {segment.ratioFormatted} ({segment.datasetShare}%)
                          </span>
                        </div>

                        {/* Title & Shared Need */}
                        <div>
                          <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight leading-snug">
                            {segment.name}
                          </h3>
                          <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed mt-2">
                            {segment.description}
                          </p>
                        </div>

                        {/* Shared Problem Callout */}
                        <div className="bg-white/80 border-[1.5px] border-[#0A0A0A] p-3 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
                          <span className="font-mono text-[9px] font-black uppercase text-[#0A0A0A]/60 block">
                            SHARED OPERATIONAL FRICTION
                          </span>
                          <p className="text-xs font-black text-[#0A0A0A] leading-snug">
                            {segment.sharedProblem}
                          </p>
                        </div>

                        {/* Outcome Tag */}
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#0A0A0A]/70 pt-1">
                          <span>WIN RATE:</span>
                          <span className="text-[#0A0A0A] font-black">
                            {segment.outcomes.winRateFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Footer: Supporting accounts preview & click to inspect */}
                      <div className="border-t-[2px] border-[#0A0A0A]/20 pt-4 space-y-2">
                        <div className="flex items-center justify-between font-mono text-[10px] font-bold text-[#0A0A0A]/60">
                          <span>SUPPORTING ACCOUNTS:</span>
                          <span>{matchedLeads.length} ACCOUNTS</span>
                        </div>

                        {matchedLeads.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {matchedLeads.slice(0, 3).map((lead) => (
                              <span
                                key={lead.id}
                                className="bg-white border-[1px] border-[#0A0A0A] px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#0A0A0A]"
                              >
                                {lead.companyName}
                              </span>
                            ))}
                            {matchedLeads.length > 3 && (
                              <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 px-1 py-0.5">
                                +{matchedLeads.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="pt-2 flex justify-between items-center text-xs font-mono font-black text-[#0A0A0A]">
                          <span className="underline">INSPECT SEGMENT</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </BrutalistCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: TARGETING                                                         */}
        {/* ========================================================================= */}
        {activeTab === 'targeting' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Overall Recommendation Banner */}
            <div className="bg-[#A1F000] border-[2.5px] border-[#0A0A0A] p-5 rounded-2xl shadow-[4px_5px_0px_#0A0A0A] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-black/10 px-2 py-0.5 rounded">
                  {stpAnalysis.overallTargetingRecommendation.isProvisional
                    ? 'PROVISIONAL TARGETING SHORTLIST'
                    : 'VALIDATED TARGET RECOMMENDATION'}
                </span>
                <span className="font-mono text-xs font-bold text-[#0A0A0A]">
                  SOURCE: NEED GAP SEVERITY + COHORT PREVALENCE
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-[#0A0A0A] leading-snug">
                {stpAnalysis.overallTargetingRecommendation.summary}
              </p>
              <p className="text-xs text-[#0A0A0A]/80 font-medium">
                Revenue is not profit. Margin estimates remain unknown until cost data is available.
              </p>
            </div>

            {/* Strategic Attractiveness vs ICP Fit Explainer Banner (Prompt 11/12 Alignment) */}
            <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] tracking-wider block">
                  STRATEGIC DISTINCTION: SEGMENT ATTRACTIVENESS VS. INDIVIDUAL ICP FIT
                </span>
                <p className="text-[#0A0A0A]/85 font-medium leading-relaxed">
                  <strong>Segment Attractiveness (Macro):</strong> Evaluates cluster opportunity, market friction prevalence, and delivery feasibility.<br />
                  <strong>Company Fit Score (Micro):</strong> Evaluates a specific lead's acute pain, verified tech stack, and purchasing authority.
                </p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="font-mono text-[11px] font-black underline text-[#0A0A0A] shrink-0 hover:text-[#8C6ADE] cursor-pointer"
              >
                VIEW SCORED LEADS →
              </button>
            </div>

            {/* Targeting Comparison Table */}
            <div className="border-[2.5px] border-[#0A0A0A] rounded-2xl overflow-hidden shadow-[4px_5px_0px_#0A0A0A] bg-white">
              <div className="p-4 sm:p-5 border-b-[2px] border-[#0A0A0A] bg-[#F9F8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black text-[#0A0A0A]">
                    Segment Attractiveness &amp; Feasibility Ledger
                  </h3>
                  <p className="text-xs font-medium text-[#0A0A0A]/70">
                    Comparing Sales Potential, Profit Potential, and Unique Needs across candidate segments.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-[#F0EFEA] border-b-[2px] border-[#0A0A0A] text-[#0A0A0A]">
                      <th className="py-3 px-4 font-black">SEGMENT NAME</th>
                      <th className="py-3 px-4 font-black">SALES POTENTIAL</th>
                      <th className="py-3 px-4 font-black">PROFIT POTENTIAL</th>
                      <th className="py-3 px-4 font-black">UNIQUE NEEDS</th>
                      <th className="py-3 px-4 font-black">FEASIBILITY</th>
                      <th className="py-3 px-4 font-black text-right">ATTRACTIVENESS SCORE</th>
                      <th className="py-3 px-4 font-black">RECOMMENDATION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A0A0A]/15 font-sans font-medium">
                    {stpAnalysis.segments.map((segment) => {
                      const assessment = stpAnalysis.targetingAssessments[segment.id];
                      if (!assessment) return null;

                      const isRecommended = assessment.recommendationTier === 'Recommended Target';
                      const isShortlist = assessment.recommendationTier === 'Provisional Shortlist';

                      return (
                        <tr
                          key={segment.id}
                          className={`hover:bg-[#F9F8F4] transition-colors ${
                            isRecommended ? 'bg-[#E5F7E5]' : isShortlist ? 'bg-[#FFF9EE]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-[#0A0A0A]">
                            <div className="font-black text-sm">{segment.name}</div>
                            <span className="font-mono text-[10px] text-[#0A0A0A]/60">
                              {segment.companyCount} accounts ({segment.datasetShare}%)
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono">
                            <span className="font-black text-[#0A0A0A]">
                              {assessment.salesPotential.label}
                            </span>
                            <span className="block text-[10px] text-[#0A0A0A]/60">
                              {assessment.salesPotential.score}/100
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 text-[10px]">
                              {assessment.profitPotential.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono">
                            <span className="font-black text-[#0A0A0A]">
                              {assessment.uniqueCustomerNeeds.label}
                            </span>
                            <span className="block text-[10px] text-[#0A0A0A]/60">
                              {assessment.uniqueCustomerNeeds.score}/100
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono">
                            <span className="font-black text-[#0A0A0A]">
                              {assessment.feasibilityAndContextMatch.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-right font-black text-sm text-[#0A0A0A]">
                            {assessment.attractivenessScore}/100
                          </td>

                          <td className="py-3 px-4">
                            <StatusChip
                              color={
                                isRecommended
                                  ? 'lime'
                                  : isShortlist
                                  ? 'peach'
                                  : segment.isInsufficientEvidenceGroup
                                  ? 'pink'
                                  : 'lavender'
                              }
                            >
                              {assessment.recommendationTier.toUpperCase()}
                            </StatusChip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expandable Explanation Section */}
            <div className="bg-white border-[2.5px] border-[#0A0A0A] p-5 rounded-2xl shadow-[3px_4px_0px_#0A0A0A] space-y-3">
              <button
                onClick={() => setShowTargetingMath(!showTargetingMath)}
                className="w-full flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8C6ADE]" />
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    HOW THE TARGETING RECOMMENDATION WAS CALCULATED
                  </span>
                </div>
                {showTargetingMath ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTargetingMath && (
                <div className="pt-3 border-t-[1.5px] border-[#0A0A0A]/15 space-y-3 text-xs font-medium text-[#0A0A0A]/85 leading-relaxed">
                  <p>
                    <strong>1. Sales Potential (40% weight):</strong> Derived from primary member volume ({stpAnalysis.totalAnalyzed} total leads) and confirmed deal conversions where historical records exist. Sample proportions are never confused with total addressable market (TAM).
                  </p>
                  <p>
                    <strong>2. Profit Potential:</strong> Strictly marked as <code className="bg-[#FFE3B3] px-1 py-0.5 rounded font-mono">PROFIT POTENTIAL — INSUFFICIENT DATA</code> because customer acquisition cost (CAC), cost-to-serve, and gross margins cannot be verified from uploaded lead records alone.
                  </p>
                  <p>
                    <strong>3. Unique Customer Needs (40% weight):</strong> Evaluates whether the identified friction is acute and whether seller capabilities uniquely address it compared to status-quo inertia.
                  </p>
                  <p>
                    <strong>4. Feasibility &amp; Context (20% weight):</strong> Evaluated using the 5C Stakeholder analysis (technological readiness, regulatory compliance, and partner ecosystem support).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW C: POSITIONING                                                       */}
        {/* ========================================================================= */}
        {activeTab === 'positioning' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Segment Selector Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white border-[2.5px] border-[#0A0A0A] p-4 rounded-xl shadow-[3px_3px_0px_#0A0A0A]">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#8C6ADE]" />
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  SELECT TARGET SEGMENT FOR POSITIONING:
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {stpAnalysis.segments
                  .filter((s) => !s.isInsufficientEvidenceGroup)
                  .map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`font-mono text-xs font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] transition-all cursor-pointer ${
                        activePositioningSegment?.id === seg.id
                          ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] font-black'
                          : 'bg-white text-[#0A0A0A]/70 hover:bg-[#F9F8F4]'
                      }`}
                    >
                      {seg.name} ({seg.datasetShare}%)
                    </button>
                  ))}
              </div>
            </div>

            {activePositioning && activePositioningSegment ? (
              <div className="space-y-6">
                {/* Big Brutalist Quote Card: The Proposed Positioning Statement */}
                <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-6 sm:p-8 rounded-2xl shadow-[5px_6px_0px_#0A0A0A] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-white px-2.5 py-1 rounded border border-[#0A0A0A]">
                      PROPOSED POSITIONING STATEMENT (HYPOTHESIS)
                    </span>
                    <BrutalistButton
                      variant="white"
                      size="sm"
                      onClick={() => handleCopyPositioning(activePositioning.positioningStatement)}
                      icon={copiedStatement ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copiedStatement ? 'COPIED TO CLIPBOARD!' : 'COPY STATEMENT'}
                    </BrutalistButton>
                  </div>

                  <blockquote className="text-lg sm:text-xl font-black text-[#0A0A0A] leading-relaxed tracking-tight italic">
                    "{activePositioning.positioningStatement}"
                  </blockquote>

                  <p className="font-mono text-[11px] text-[#0A0A0A]/70 font-bold border-t border-[#0A0A0A]/20 pt-2">
                    Template: For [Target Customer], who struggles with [Need], [Seller Product] provides [Core Benefit] through [Relevant Capabilities], because [Evidence].
                  </p>
                </div>

                {/* Core Dimensions: Point of Parity & Point of Difference */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Point of Parity (PoP) */}
                  <BrutalistCard bg="white" shadowSize="md" className="p-6 space-y-3">
                    <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-3">
                      <Layers className="w-4 h-4 text-[#8C6ADE]" />
                      <h4 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                        POINTS OF PARITY (POP) — CATEGORY BASELINE
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block uppercase">
                          CATEGORY PREREQUISITES
                        </span>
                        <p className="font-semibold text-[#0A0A0A] leading-relaxed">
                          {activePositioning.categoryPointOfParity}
                        </p>
                      </div>

                      {activePositioning.competitivePointOfParity ? (
                        <div className="pt-2 border-t border-[#0A0A0A]/10">
                          <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block uppercase">
                            COMPETITIVE EQUIVALENCE
                          </span>
                          <p className="font-semibold text-[#0A0A0A] leading-relaxed">
                            {activePositioning.competitivePointOfParity}
                          </p>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-[#0A0A0A]/10 text-amber-900 font-mono text-[11px]">
                          <em>Competitive alternative comparison omitted: seller onboarding did not specify incumbent competitors.</em>
                        </div>
                      )}
                    </div>
                  </BrutalistCard>

                  {/* Point of Difference (PoD) */}
                  <BrutalistCard bg="mint" shadowSize="md" className="p-6 space-y-3">
                    <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-3">
                      <Sparkles className="w-4 h-4 text-emerald-800" />
                      <h4 className="font-mono text-xs font-black uppercase text-emerald-950">
                        POINTS OF DIFFERENCE (POD) — DIFFERENTIATION
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-emerald-900 block uppercase">
                          CREDIBLE SELLER ADVANTAGE
                        </span>
                        <p className="font-extrabold text-[#0A0A0A] text-sm leading-snug">
                          {activePositioning.pointOfDifference}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#0A0A0A]/15 space-y-1">
                        <span className="font-mono text-[10px] font-bold text-emerald-900 block uppercase">
                          REASONS TO BELIEVE (PROOF POINTS)
                        </span>
                        <ul className="list-disc pl-4 space-y-1 font-semibold text-[#0A0A0A]">
                          {activePositioning.reasonsToBelieve.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </BrutalistCard>
                </div>

                {/* Proposed Campaign Hooks */}
                <div className="bg-white border-[2.5px] border-[#0A0A0A] p-6 rounded-2xl shadow-[3px_4px_0px_#0A0A0A] space-y-4">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
                    RECOMMENDED OUTBOUND CAMPAIGN HOOKS (PROPOSED COPY)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activePositioning.proposedMarketingHooks.map((hook, i) => (
                      <div
                        key={i}
                        className="bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A] p-4 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]"
                      >
                        <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/60 block uppercase">
                          CAMPAIGN ANGLE #{i + 1}
                        </span>
                        <p className="text-xs font-bold text-[#0A0A0A] leading-relaxed">
                          "{hook}"
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#0A0A0A]/15 pt-3">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
                      GOVERNANCE: UNTESTED HYPOTHESES DISCLOSURE
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-amber-950 font-bold">
                      {activePositioning.missingEvidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* INTERACTIVE SEGMENT INSPECTION MODAL                                      */}
        {/* ========================================================================= */}
        {inspectingSegment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white border-[3px] border-[#0A0A0A] rounded-2xl shadow-[8px_10px_0px_#0A0A0A] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b-[2px] border-[#0A0A0A] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusChip color="lime">
                      {inspectingSegment.ratioFormatted} ACCOUNTS ({inspectingSegment.datasetShare}%)
                    </StatusChip>
                    <StatusChip color={inspectingSegment.confidence === 'high' ? 'mint' : 'peach'}>
                      {inspectingSegment.confidence.toUpperCase()} CONFIDENCE
                    </StatusChip>
                  </div>
                  <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight mt-2">
                    {inspectingSegment.name}
                  </h2>
                  <p className="text-xs font-medium text-[#0A0A0A]/70 mt-1">
                    {inspectingSegment.description}
                  </p>
                </div>

                <button
                  onClick={() => setInspectingSegment(null)}
                  className="font-mono text-sm font-black border-[2px] border-[#0A0A0A] px-2.5 py-1 rounded bg-[#F9F8F4] hover:bg-[#FFB6C2] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Shared Need & Ideal State */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1 shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                    SHARED BUSINESS NEED (FRICTION)
                  </span>
                  <p className="text-xs font-black text-[#0A0A0A] leading-snug">
                    {inspectingSegment.sharedProblem}
                  </p>
                </div>

                <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1 shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="font-mono text-[10px] font-black uppercase text-emerald-950">
                    DESIRED OUTCOME
                  </span>
                  <p className="text-xs font-black text-emerald-950 leading-snug">
                    {inspectingSegment.desiredOutcome}
                  </p>
                </div>
              </div>

              {/* Firmographic Characteristics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">COMMON INDUSTRIES</span>
                  <div className="font-black text-xs mt-1">
                    {inspectingSegment.commonIndustries.slice(0, 3).join(', ')}
                  </div>
                </div>

                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">COMPANY SIZES</span>
                  <div className="font-black text-xs mt-1">
                    {inspectingSegment.typicalCompanySizes.slice(0, 2).join(', ')}
                  </div>
                </div>

                <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-lg shadow-[2px_2px_0px_#0A0A0A]">
                  <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">BUYING ROLES</span>
                  <div className="font-black text-xs mt-1">
                    {inspectingSegment.buyingRoleHypotheses.slice(0, 2).join(', ')}
                  </div>
                </div>
              </div>

              {/* Outcome Data Ledger */}
              <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-black uppercase text-[#0A0A0A]">
                    OBSERVED DEAL CONVERSIONS
                  </span>
                  <span className="font-bold text-[#0A0A0A]/70">
                    {inspectingSegment.outcomes.dataClassification}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-1">
                  <div className="bg-white border p-2 rounded">
                    <span className="text-[10px] text-[#0A0A0A]/60 block">RESOLVED DEALS</span>
                    <span className="font-black text-sm">{inspectingSegment.outcomes.leadsWithKnownOutcomes}</span>
                  </div>
                  <div className="bg-white border p-2 rounded">
                    <span className="text-[10px] text-[#0A0A0A]/60 block">WIN RATE</span>
                    <span className="font-black text-sm">{inspectingSegment.outcomes.winRateFormatted}</span>
                  </div>
                  <div className="bg-white border p-2 rounded">
                    <span className="text-[10px] text-[#0A0A0A]/60 block">TOTAL VALUE</span>
                    <span className="font-black text-sm">
                      {inspectingSegment.outcomes.totalWonDealValue ? `$${inspectingSegment.outcomes.totalWonDealValue.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white border p-2 rounded">
                    <span className="text-[10px] text-[#0A0A0A]/60 block">AVG RETENTION</span>
                    <span className="font-black text-sm">
                      {inspectingSegment.outcomes.averageRetentionMonths ? `${inspectingSegment.outcomes.averageRetentionMonths} mo` : 'N/A'}
                    </span>
                  </div>
                </div>

                {inspectingSegment.outcomes.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-950 font-bold font-mono pt-1">
                    ⚠ {w}
                  </p>
                ))}
              </div>

              {/* Supporting Member Companies (Clickable Pills) */}
              <div className="space-y-2">
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
                  SUPPORTING ACCOUNTS IN SEGMENT ({inspectingSegment.companyCount} PRIMARY MEMBERS)
                </span>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {storeLeads
                    .filter((l) => inspectingSegment.primaryCompanyIds.includes(l.id))
                    .map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setInspectingSegment(null);
                          navigate(`/companies/${company.id}`);
                        }}
                        className="bg-white hover:bg-[#A1F000] border-[1.5px] border-[#0A0A0A] px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>{company.companyName}</span>
                        <ExternalLink className="w-3 h-3 text-[#0A0A0A]/70" />
                      </button>
                    ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t-[2px] border-[#0A0A0A] pt-4 flex items-center justify-between">
                <BrutalistButton
                  variant="lime"
                  size="sm"
                  onClick={() => {
                    setSelectedSegmentId(inspectingSegment.id);
                    setActiveTab('positioning');
                    setInspectingSegment(null);
                  }}
                  icon={<Compass className="w-3.5 h-3.5" />}
                >
                  VIEW SEGMENT POSITIONING
                </BrutalistButton>

                <BrutalistButton
                  variant="white"
                  size="sm"
                  onClick={() => setInspectingSegment(null)}
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
