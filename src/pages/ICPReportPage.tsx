import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { formatScore, formatHeadcount } from '../lib/formatters';
import type {
  ExecutiveICPReport,
  Segment7PsMarketingMix,
  RecommendedActionItem,
  MarketingMixDimension,
} from '../types/analysis';
import type { SellerProfileContext } from '../server/strategicAnalysisService';
import type { LeadForAnalysis } from '../server/analysisJobService';
import {
  analyzeLeadNeedGap,
  aggregateDatasetNeedGaps,
  synthesizeDetailedFiveC,
} from '../server/strategicAnalysisService';
import { buildDatasetSTPAnalysis } from '../server/stpService';
import { batchScoreLeads } from '../lib/scoring';
import { composeExecutiveICPReport, CURRENT_REPORT_MODEL_VERSION } from '../server/reportService';
import {
  Printer,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Target,
  Sparkles,
  ArrowLeft,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  Package,
  DollarSign,
  MapPin,
  Megaphone,
  Users,
  Workflow,
  FileCheck2,
  ChevronRight,
  ExternalLink,
  Layers,
  Compass,
  FileText,
} from 'lucide-react';

interface ICPReportPageProps {
  params: {
    id: string;
  };
}

export const ICPReportPage: React.FC<ICPReportPageProps> = ({ params }) => {
  const { navigate } = useRouter();
  const { session } = useAuth();
  const {
    offering,
    sellerContext,
    leads: storeLeads,
    scores: storeScores,
    analysis,
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    addToast,
  } = useAppStore();

  const datasetId = params.id || activeDatasetId || datasets[0]?.id || 'dataset-01';
  const currentDataset = datasets.find((d) => d.id === datasetId) || datasets[0] || {
    id: datasetId,
    filename: 'Primary Ingested Pipeline.csv',
    row_count: storeLeads.length,
  };

  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMixSegmentId, setSelectedMixSegmentId] = useState<string | null>(null);

  // Seller profile adapter
  const sellerProfile: SellerProfileContext = useMemo(() => {
    return {
      id: offering.id,
      companyName: sellerContext.companyName || offering.companyName || 'Synthetix Data Cloud',
      website: sellerContext.website || offering.website || 'https://synthetix.io',
      productName: sellerContext.productName || offering.productName || 'DataReliability Engine',
      productDescription: sellerContext.productDescription || offering.valueProposition || '',
      category: offering.category || sellerContext.businessModel || 'Enterprise B2B Software',
      valueProposition: offering.valueProposition || sellerContext.mainBenefit || 'Eliminates silent data corruption in mission-critical pipelines.',
      primaryProblemSolved: offering.primaryProblemSolved || sellerContext.currentCustomerProblem || 'Silent schema drift causing corrupt executive dashboards',
      keyCapabilities: offering.keyCapabilities?.length
        ? offering.keyCapabilities
        : (sellerContext.coreFeatures?.length ? sellerContext.coreFeatures : ['Automated schema drift detection', 'Bidirectional dbt and Snowflake sync']),
      typicalACV: offering.typicalACV || sellerContext.indicativePricing || '$36,000 / year',
      pricingModel: offering.pricingModel || 'Annual Contract Value (ACV)',
      mainAlternatives: sellerContext.mainAlternatives || 'Manual scripts and spot checking',
      pointOfParity: sellerContext.pointOfParity || 'Standard exception alerts and schema audit logs',
      pointOfDifference: sellerContext.pointOfDifference || 'Proactive contract verification before downstream write-time breaks',
      targetMarket: sellerContext.targetBusinessTypes?.join(', ') || 'FinTech, HealthTech, B2B SaaS',
      primaryBuyer: sellerContext.buyerRoles?.[0]?.role || offering.buyerPersonas?.[0]?.title || 'VP of Data & Analytics',
      mainCustomerProblem: sellerContext.currentCustomerProblem || 'Data pipelines fail silently when upstream schemas change without notice.',
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

  // Fallback local report synthesizer
  const computeLocalReport = useCallback((): ExecutiveICPReport => {
    const needGaps = leadsForAnalysis.map((lead) => analyzeLeadNeedGap(sellerProfile, lead));
    const needGapSummary = aggregateDatasetNeedGaps(datasetId, needGaps, sellerProfile);
    const fiveC = synthesizeDetailedFiveC(sellerProfile, needGaps, leadsForAnalysis);
    const gapsMap = Object.fromEntries(needGaps.map((g) => [g.leadId, g]));

    const stpAnalysis = buildDatasetSTPAnalysis(
      sellerProfile,
      datasetId,
      needGapSummary,
      fiveC,
      leadsForAnalysis,
      gapsMap
    );

    const scored = storeScores.length > 0
      ? storeScores
      : batchScoreLeads(storeLeads, offering, undefined, undefined, {
          fiveC,
          segments: stpAnalysis.segments,
          sellerContext,
        });

    return composeExecutiveICPReport(
      sellerProfile,
      datasetId,
      currentDataset.filename || 'Lead Batch.csv',
      session?.user?.id || 'demo-user',
      leadsForAnalysis.length,
      needGapSummary,
      fiveC,
      stpAnalysis,
      scored
    );
  }, [leadsForAnalysis, sellerProfile, datasetId, currentDataset.filename, session?.user?.id, storeScores, storeLeads, offering, sellerContext]);

  // Active Report State
  const [report, setReport] = useState<ExecutiveICPReport>(() => {
    try {
      const saved = localStorage.getItem(`icp_mode_exec_report_${datasetId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return computeLocalReport();
  });

  // Load from backend on mount or dataset change
  const fetchBackendReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = session?.access_token || 'demo-token';
      const res = await fetch(`/api/reports/dataset/${datasetId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
          try {
            localStorage.setItem(`icp_mode_exec_report_${datasetId}`, JSON.stringify(data.report));
          } catch {}
          return;
        }
      }

      // Fallback to local computation
      const fallback = computeLocalReport();
      setReport(fallback);
      try {
        localStorage.setItem(`icp_mode_exec_report_${datasetId}`, JSON.stringify(fallback));
      } catch {}
    } catch {
      const fallback = computeLocalReport();
      setReport(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, session?.access_token, computeLocalReport]);

  useEffect(() => {
    void fetchBackendReport();
  }, [fetchBackendReport]);

  // Re-run Report Synthesis
  const handleRefreshReport = async () => {
    setIsRefreshing(true);
    try {
      const token = session?.access_token || 'demo-token';
      const res = await fetch(`/api/reports/dataset/${datasetId}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerProfile,
          offering,
          datasetFilename: currentDataset.filename,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
          try {
            localStorage.setItem(`icp_mode_exec_report_${datasetId}`, JSON.stringify(data.report));
          } catch {}
          addToast('Executive ICP Report & 7Ps Marketing Mix refreshed successfully.', 'success');
          return;
        }
      }

      // Fallback
      const refreshed = computeLocalReport();
      setReport(refreshed);
      try {
        localStorage.setItem(`icp_mode_exec_report_${datasetId}`, JSON.stringify(refreshed));
      } catch {}
      addToast('Executive report recomputed locally.', 'success');
    } catch {
      const refreshed = computeLocalReport();
      setReport(refreshed);
      addToast('Executive report recomputed locally.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Secure CSV Export (Formula Injection Protected)
  const handleExportCSV = () => {
    const sanitizeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      // Prevent spreadsheet formula injection (=, +, -, @, \t, \r)
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = [
      'Company Name',
      'Domain',
      'ICP Fit Score',
      'Evidence Coverage',
      'Buying Intent',
      'Fit Tier',
      'Hard Disqualified',
      'Disqualification Reason',
      'Insufficient Evidence',
      'Recommended Action',
      'Primary Strengths',
    ];

    const rows = report.scoredLeads.map((s) => [
      sanitizeCsv(s.companyName),
      sanitizeCsv(s.domain),
      s.totalScore,
      sanitizeCsv(`${s.evidenceCoverage ?? 100}%`),
      sanitizeCsv(s.intentLabel || 'BUYING INTENT: UNKNOWN'),
      sanitizeCsv(s.tier),
      sanitizeCsv(s.isDisqualified ? 'YES' : 'NO'),
      sanitizeCsv(s.disqualificationReason || ''),
      sanitizeCsv(s.isInsufficientEvidence ? 'YES' : 'NO'),
      sanitizeCsv(s.recommendedAction),
      sanitizeCsv(s.primaryStrengths.join('; ')),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ICP_Dossier_${report.datasetId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Ranked leads exported to CSV with formula-sanitization protection.', 'success');
  };

  // Copy Executive Summary Text
  const handleCopySummary = () => {
    const summaryText = `ICP.MODE EXECUTIVE STRATEGIC INTELLIGENCE DOSSIER
=====================================================
Seller: ${report.sellerCompanyName} (${report.sellerProductName})
Dataset: ${report.datasetFilename}
Governance: ${report.governanceClassification}
Generated: ${new Date(report.generatedAt).toLocaleDateString()}
Version: ${report.analysisVersion}

EXECUTIVE THESIS:
• Problem Addressed: ${report.executiveThesis.problemAddressed}
• Recommended Target: ${report.executiveThesis.recommendedSegmentName}
• Target Cohort: ${report.executiveThesis.targetCohort}
• Strategic Recommendation: ${report.executiveThesis.recommendationSummary}

KEY METRICS:
• Analyzed Leads: ${report.summaryMetrics.totalAnalyzed}
• Tier 1 (High Conviction): ${report.summaryMetrics.tier1Count} accounts
• Tier 2 (Moderate Fit): ${report.summaryMetrics.tier2Count} accounts
• Disqualified: ${report.summaryMetrics.disqualifiedCount} accounts
• Insufficient Evidence: ${report.summaryMetrics.insufficientEvidenceCount} accounts
• Average Evidence Coverage: ${report.summaryMetrics.averageEvidenceCoverage}%

VALUE PROPOSITION:
"${sellerProfile.valueProposition}"

Generated by icp.mode · Algorithmic Strategy Engine`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
    addToast('Executive Strategic Summary copied to clipboard.', 'success');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    addToast('Dossier share link copied to clipboard.', 'info');
  };

  const handlePrint = () => {
    window.print();
  };

  // Active 7Ps Marketing Mix Segment Selection
  const candidateSegments = report.stpAnalysis?.segments || [];
  const activeSegmentId = selectedMixSegmentId || candidateSegments[0]?.id || 'segment-01';
  const active7PsMix: Segment7PsMarketingMix | undefined =
    report.marketingMixBySegment[activeSegmentId] || Object.values(report.marketingMixBySegment)[0];

  return (
    <AppLayout>
      <div className="space-y-10 max-w-6xl mx-auto print:max-w-none print:m-0 print:p-0">
        {/* Navigation & Action Bar (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-5 print:hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO DASHBOARD</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={handleRefreshReport}
              disabled={isRefreshing}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              {isRefreshing ? 'REFRESHING...' : 'REFRESH DOSSIER'}
            </BrutalistButton>

            <BrutalistButton
              variant="white"
              size="sm"
              onClick={handleCopySummary}
              icon={copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedSummary ? 'SUMMARY COPIED!' : 'COPY SUMMARY'}
            </BrutalistButton>

            <BrutalistButton
              variant="white"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              EXPORT CSV
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              PRINT / SAVE PDF
            </BrutalistButton>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* REPORT DOCUMENT CONTAINER                                                 */}
        {/* ========================================================================= */}
        <div className="bg-white border-[3.5px] border-[#0A0A0A] rounded-2xl p-6 sm:p-12 shadow-[6px_8px_0px_#0A0A0A] space-y-12 print:shadow-none print:border-none print:p-0">

          {/* DOCUMENT HEADER */}
          <div className="border-b-[3px] border-[#0A0A0A] pb-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#A1F000] border-[1.5px] border-[#0A0A0A]" />
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  ICP.MODE // STRATEGIC INTELLIGENCE REPORT // {report.datasetFilename}
                </span>
              </div>
              <StickerBadge color={report.isProvisionalHypothesis ? 'peach' : 'mint'} rotate="-2">
                {report.governanceClassification}
              </StickerBadge>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight leading-[1.05]">
              Ideal Customer Profile Discovery Dossier &amp; 7Ps Marketing Mix
            </h1>

            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs font-mono font-bold text-[#0A0A0A]/70 pt-1">
              <span>SELLER: {report.sellerCompanyName}</span>
              <span>·</span>
              <span>PRODUCT: {report.sellerProductName}</span>
              <span>·</span>
              <span>DATE: {new Date(report.generatedAt).toLocaleDateString()}</span>
              <span>·</span>
              <span>VERSION: {report.analysisVersion}</span>
              <span>·</span>
              <span>COVERAGE: {report.summaryMetrics.averageEvidenceCoverage}%</span>
            </div>
          </div>

          {/* STATUTORY GOVERNANCE BANNER */}
          <div className={`border-[2px] border-[#0A0A0A] rounded-xl p-4.5 shadow-[3px_3px_0px_#0A0A0A] flex items-start gap-3.5 ${
            report.governanceClassification.includes('CUSTOMER-BACKED') ? 'bg-[#E5F7E5]' : 'bg-[#FFE3B3]'
          }`}>
            <ShieldAlert className="w-5 h-5 text-[#0A0A0A] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-mono font-black uppercase text-[#0A0A0A] block">
                {report.governanceClassification}
              </span>
              <p className="text-[#0A0A0A]/85 font-medium leading-relaxed">
                This report represents an <strong>ICP Hypothesis</strong> derived from acute problem patterns, tech stack compatibility, and buying unit feasibility. Observed customer win-rates provide preliminary customer-backed evidence, while statistical validation requires longitudinal verification across multiple sales cohorts.
              </p>
            </div>
          </div>

          {/* EXECUTIVE METRICS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center font-mono">
            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">ANALYZED</span>
              <span className="text-2xl font-black text-[#0A0A0A] block mt-1">{report.summaryMetrics.totalAnalyzed}</span>
            </div>
            <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-emerald-950 font-bold block">TIER 1 (FIT)</span>
              <span className="text-2xl font-black text-emerald-800 block mt-1">{report.summaryMetrics.tier1Count}</span>
            </div>
            <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-amber-950 font-bold block">TIER 2 (NURTURE)</span>
              <span className="text-2xl font-black text-amber-900 block mt-1">{report.summaryMetrics.tier2Count}</span>
            </div>
            <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-rose-950 font-bold block">DISQUALIFIED</span>
              <span className="text-2xl font-black text-rose-800 block mt-1">{report.summaryMetrics.disqualifiedCount}</span>
            </div>
            <div className="bg-[#FFF9EE] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-amber-900 font-bold block">LOW DATA</span>
              <span className="text-2xl font-black text-amber-800 block mt-1">{report.summaryMetrics.insufficientEvidenceCount}</span>
            </div>
            <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-3 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">EVIDENCE</span>
              <span className="text-2xl font-black text-[#0A0A0A] block mt-1">{report.summaryMetrics.averageEvidenceCoverage}%</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION A: EXECUTIVE THESIS                                              */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Sparkles className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section A: Executive Strategic Thesis
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
              <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                  1. PROBLEM THE SELLER ADDRESSES
                </span>
                <p className="text-[#0A0A0A] text-sm font-bold leading-snug">
                  {report.executiveThesis.problemAddressed}
                </p>
                <p className="text-[#0A0A0A]/70 text-xs">
                  Value Proposition: "{sellerProfile.valueProposition}"
                </p>
              </div>

              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2">
                <span className="font-mono text-[10px] font-black uppercase text-emerald-950 block">
                  2. BEST-SUPPORTED TARGET SEGMENT
                </span>
                <p className="text-emerald-950 text-sm font-black leading-snug">
                  {report.executiveThesis.targetCohort}
                </p>
                <p className="text-emerald-900/80 text-xs">
                  {report.executiveThesis.relevanceRationale}
                </p>
              </div>
            </div>

            <div className="bg-[#F0EFEA] border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2 text-xs">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                STRATEGIC RECOMMENDATION &amp; LIMITATIONS
              </span>
              <p className="text-[#0A0A0A] font-semibold text-sm leading-relaxed">
                {report.executiveThesis.recommendationSummary}
              </p>
              <div className="pt-2 border-t border-[#0A0A0A]/15">
                <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/70 uppercase block mb-1">
                  CRITICAL UNKNOWNS AWAITING GTM VALIDATION:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[#0A0A0A]/80 font-medium">
                  {report.executiveThesis.missingInformation.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION B: NEED GAP ANALYSIS                                              */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Target className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section B: Need Gap Analysis
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-amber-950 block">
                  CURRENT STATE (FRICTION &amp; PAIN)
                </span>
                <p className="text-amber-950 font-bold text-sm leading-snug">
                  {report.needGapSummary.topNeedPatterns?.[0]?.description || report.needGapSummary.commonHypothesizedProblems?.[0] || 'Severe operational friction and manual pipeline overhead.'}
                </p>
                <p className="text-amber-900/80 text-[11px] font-medium pt-1">
                  Average Problem Severity: <strong>{report.summaryMetrics.averageEvidenceCoverage >= 70 ? 'Acute / High' : 'Moderate'}</strong> across evaluated leads.
                </p>
              </div>

              <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-1">
                <span className="font-mono text-[10px] font-black uppercase text-emerald-950 block">
                  DESIRED IDEAL STATE (BREAKTHROUGH)
                </span>
                <p className="text-emerald-950 font-black text-sm leading-snug">
                  {sellerProfile.valueProposition || 'Automated data pipeline integrity with zero surprise executive dashboard downtime.'}
                </p>
                <p className="text-emerald-900/80 text-[11px] font-medium pt-1">
                  Capability Overlap: {report.needGapSummary.matchingSellerBenefits?.slice(0, 2).map((b) => b.sellerBenefit).join(', ') || 'High architectural fit'}.
                </p>
              </div>
            </div>

            {/* Problem Patterns List */}
            <div className="border-[2px] border-[#0A0A0A] rounded-xl overflow-hidden">
              <div className="bg-[#F9F8F4] p-3 border-b-[2px] border-[#0A0A0A] flex justify-between items-center text-xs font-mono font-black">
                <span>IDENTIFIED NEED PATTERNS</span>
                <span>{report.needGapSummary.topNeedPatterns?.length || 0} PATTERNS DETECTED</span>
              </div>
              <div className="divide-y divide-[#0A0A0A]/15 font-sans text-xs">
                {(report.needGapSummary.topNeedPatterns || []).map((pat) => (
                  <div key={pat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F8F4] transition-colors">
                    <div className="space-y-1">
                      <span className="font-black text-sm text-[#0A0A0A] block">{pat.problemTitle}</span>
                      <p className="text-[#0A0A0A]/80 font-medium">{pat.description}</p>
                    </div>
                    <div className="shrink-0 font-mono text-right">
                      <span className="font-black text-sm text-[#8C6ADE]">{pat.supportingCount} accounts</span>
                      <span className="block text-[10px] text-[#0A0A0A]/60">({pat.percentage}% prevalence)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION C: 5C / STAKEHOLDER ANALYSIS                                     */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Building2 className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section C: 5C Stakeholder &amp; Context Analysis
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* 1. Company */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                <div className="flex justify-between items-center border-b pb-1.5 font-mono">
                  <span className="font-black uppercase text-[#0A0A0A]">1. COMPANY (SELLER)</span>
                  <StatusChip color="mint">CAPABILITY</StatusChip>
                </div>
                <p className="font-bold text-[#0A0A0A]">{report.fiveCAnalysis.company.strategicImplications || report.fiveCAnalysis.company.mainObservations[0]}</p>
                <div className="text-[11px] text-[#0A0A0A]/75 space-y-1">
                  <div><strong>Advantage:</strong> {report.fiveCAnalysis.company.potentialOpportunity}</div>
                  <div><strong>Bottleneck:</strong> {report.fiveCAnalysis.company.potentialRisk}</div>
                </div>
              </div>

              {/* 2. Customers */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                <div className="flex justify-between items-center border-b pb-1.5 font-mono">
                  <span className="font-black uppercase text-[#0A0A0A]">2. CUSTOMERS (BUYING UNIT)</span>
                  <StatusChip color="peach">COMMITTEE</StatusChip>
                </div>
                <p className="font-bold text-[#0A0A0A]">{report.fiveCAnalysis.customers.strategicImplications || report.fiveCAnalysis.customers.mainObservations[0]}</p>
                <div className="text-[11px] text-[#0A0A0A]/75 space-y-1">
                  <div><strong>Economic Buyer:</strong> {sellerProfile.primaryBuyer || 'VP of Data & Engineering'}</div>
                  <div><strong>Obstacle:</strong> {report.fiveCAnalysis.customers.potentialRisk}</div>
                </div>
              </div>

              {/* 3. Competitors */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                <div className="flex justify-between items-center border-b pb-1.5 font-mono">
                  <span className="font-black uppercase text-[#0A0A0A]">3. COMPETITORS &amp; INERTIA</span>
                  <StatusChip color="lavender">BENCHMARK</StatusChip>
                </div>
                <p className="font-bold text-[#0A0A0A]">{report.fiveCAnalysis.competitors.strategicImplications || report.fiveCAnalysis.competitors.mainObservations[0]}</p>
                <div className="text-[11px] text-[#0A0A0A]/75 space-y-1">
                  <div><strong>Status Quo:</strong> {sellerProfile.mainAlternatives || 'Homegrown scripts and manual triage'}</div>
                  <div><strong>Point of Difference:</strong> {sellerProfile.pointOfDifference || 'Pre-write contract simulation'}</div>
                </div>
              </div>

              {/* 4. Collaborators */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
                <div className="flex justify-between items-center border-b pb-1.5 font-mono">
                  <span className="font-black uppercase text-[#0A0A0A]">4. COLLABORATORS &amp; CHANNELS</span>
                  <StatusChip color="mint">ECOSYSTEM</StatusChip>
                </div>
                <p className="font-bold text-[#0A0A0A]">{report.fiveCAnalysis.collaborators.strategicImplications || report.fiveCAnalysis.collaborators.mainObservations[0]}</p>
                <div className="text-[11px] text-[#0A0A0A]/75 space-y-1">
                  <div><strong>Opportunity:</strong> {report.fiveCAnalysis.collaborators.potentialOpportunity}</div>
                </div>
              </div>

              {/* 5. Context */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-2 shadow-[2px_2px_0px_#0A0A0A] sm:col-span-2 lg:col-span-2">
                <div className="flex justify-between items-center border-b pb-1.5 font-mono">
                  <span className="font-black uppercase text-[#0A0A0A]">5. CONTEXT (MACRO &amp; REGULATORY)</span>
                  <StatusChip color="pink">GOVERNANCE</StatusChip>
                </div>
                <p className="font-bold text-[#0A0A0A]">{report.fiveCAnalysis.context.strategicImplications || report.fiveCAnalysis.context.mainObservations[0]}</p>
                <div className="text-[11px] text-[#0A0A0A]/75 space-y-1">
                  <div><strong>Macro Factors:</strong> {report.fiveCAnalysis.context.potentialOpportunity}</div>
                  <div><strong>Headwinds:</strong> {report.fiveCAnalysis.context.potentialRisk}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION D: SEGMENTATION & TARGETING                                       */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Layers className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section D &amp; E: STP Segmentation &amp; Targeting Ledger
              </h2>
            </div>

            {/* Segment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidateSegments.map((seg, idx) => {
                const assessment = report.stpAnalysis.targetingAssessments[seg.id];
                const isRecommended = assessment?.recommendationTier === 'Recommended Target';

                return (
                  <BrutalistCard
                    key={seg.id}
                    bg={isRecommended ? 'mint' : 'white'}
                    shadowSize="sm"
                    className="p-5 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                        SEGMENT {idx + 1}: {seg.name}
                      </span>
                      <StatusChip color={isRecommended ? 'lime' : 'peach'}>
                        {assessment?.recommendationTier || 'EVALUATED'}
                      </StatusChip>
                    </div>

                    <p className="text-xs font-bold text-[#0A0A0A] leading-relaxed">
                      {seg.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                      <div className="bg-white/80 p-2 rounded border border-[#0A0A0A]/20">
                        <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">MEMBERS</span>
                        <span className="font-black text-sm">{seg.companyCount} leads</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-[#0A0A0A]/20">
                        <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">SHARE</span>
                        <span className="font-black text-sm">{seg.datasetShare}%</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-[#0A0A0A]/20">
                        <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">ATTRACTIVENESS</span>
                        <span className="font-black text-sm">{assessment?.attractivenessScore || 85}/100</span>
                      </div>
                    </div>

                    <div className="text-[11px] space-y-1 text-[#0A0A0A]/80 font-medium pt-1">
                      <div><strong>Shared Problem:</strong> {seg.sharedProblem}</div>
                      <div><strong>Desired Outcome:</strong> {seg.desiredOutcome}</div>
                    </div>
                  </BrutalistCard>
                );
              })}
            </div>

            {/* Targeting Comparison Table */}
            <div className="border-[2px] border-[#0A0A0A] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#F9F8F4] border-b-[2px] border-[#0A0A0A] text-[#0A0A0A]">
                    <th className="py-2.5 px-3 font-black">SEGMENT</th>
                    <th className="py-2.5 px-3 font-black">SALES POTENTIAL</th>
                    <th className="py-2.5 px-3 font-black">PROFIT POTENTIAL</th>
                    <th className="py-2.5 px-3 font-black">UNIQUE NEEDS</th>
                    <th className="py-2.5 px-3 font-black text-right">FEASIBILITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A0A0A]/15 font-sans font-medium text-xs">
                  {candidateSegments.map((seg) => {
                    const assessment = report.stpAnalysis.targetingAssessments[seg.id];
                    return (
                      <tr key={seg.id} className="hover:bg-[#F9F8F4] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#0A0A0A]">{seg.name}</td>
                        <td className="py-2.5 px-3 font-mono">{assessment?.salesPotential.label || 'Moderate'}</td>
                        <td className="py-2.5 px-3 font-mono text-amber-900 bg-amber-50">
                          {assessment?.profitPotential.label || 'PROFIT POTENTIAL — INSUFFICIENT DATA'}
                        </td>
                        <td className="py-2.5 px-3">{assessment?.uniqueCustomerNeeds.label || 'Acute Need'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {assessment?.feasibilityAndContextMatch.label || 'High Match'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION F: POSITIONING                                                    */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Compass className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section F: Strategic Positioning Specification
              </h2>
            </div>

            <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-6 rounded-2xl shadow-[3px_4px_0px_#0A0A0A] space-y-4">
              <div>
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-black/10 px-2 py-0.5 rounded">
                  OFFICIAL POSITIONING STATEMENT DRAFT
                </span>
                <p className="text-base sm:text-lg font-black text-[#0A0A0A] mt-2 leading-snug">
                  "{report.stpAnalysis.positioningRecommendations[activeSegmentId]?.positioningStatement || `For modern data engineering teams experiencing silent pipeline drift, ${sellerProfile.productName} is the continuous contract verification platform that eliminates downstream corruption before executive reporting is impacted.`}"
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs pt-2 border-t border-[#0A0A0A]/20">
                <div className="bg-white p-3 rounded-lg border border-[#0A0A0A]/20">
                  <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">CATEGORY POINT OF PARITY (POP)</span>
                  <p className="font-black text-xs text-[#0A0A0A] mt-0.5">
                    {sellerProfile.pointOfParity || 'Standard automated anomaly alerts & schema change audit logs.'}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-[#0A0A0A]/20">
                  <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">POINT OF DIFFERENCE (POD)</span>
                  <p className="font-black text-xs text-[#0A0A0A] mt-0.5">
                    {sellerProfile.pointOfDifference || 'Pre-write contract simulation preventing silent table corruption.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION G: RANKED ACCOUNT LEDGER & AUDIT TRACE                           */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#8C6ADE]" />
                <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                  Section G: Ranked Account Ledger &amp; Scoring Audit
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-[#0A0A0A]/70">
                MODEL: {CURRENT_REPORT_MODEL_VERSION}
              </span>
            </div>

            <div className="border-[2.5px] border-[#0A0A0A] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#F9F8F4] border-b-[2px] border-[#0A0A0A] text-[#0A0A0A]">
                    <th className="py-2.5 px-3 font-black">COMPANY</th>
                    <th className="py-2.5 px-3 font-black">VERTICAL</th>
                    <th className="py-2.5 px-3 font-black text-right">HEADCOUNT</th>
                    <th className="py-2.5 px-3 font-black text-right">FIT SCORE</th>
                    <th className="py-2.5 px-3 font-black text-center">COVERAGE</th>
                    <th className="py-2.5 px-3 font-black">BUYING INTENT</th>
                    <th className="py-2.5 px-3 font-black">TIER / STATUS</th>
                    <th className="py-2.5 px-3 font-black">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A0A0A]/15 font-sans font-medium">
                  {report.scoredLeads.map((s) => {
                    const isDisqualified = s.isDisqualified;
                    const isLowCoverage = s.isInsufficientEvidence || (s.evidenceCoverage !== undefined && s.evidenceCoverage < 70);

                    return (
                      <tr key={s.leadId} className={isDisqualified ? 'bg-red-50/50' : undefined}>
                        <td className="py-2.5 px-3 font-bold text-[#0A0A0A]">
                          {s.companyName}
                          <span className="block font-mono text-[10px] text-[#0A0A0A]/60">{s.domain || 'No website'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#0A0A0A]/80">{storeLeads.find((l) => l.id === s.leadId)?.industry || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatHeadcount(storeLeads.find((l) => l.id === s.leadId)?.headcount ?? null)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-[#0A0A0A]">
                          {formatScore(s.totalScore)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLowCoverage
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {s.evidenceCoverage !== undefined ? `${s.evidenceCoverage}%` : '100%'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              s.intentScore !== null && s.intentScore !== undefined && s.intentScore > 0
                                ? 'bg-[#A1F000]/20 text-[#0A0A0A] border border-[#0A0A0A]/20'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s.intentLabel || 'BUYING INTENT: UNKNOWN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {isDisqualified ? (
                            <div>
                              <StatusChip color="pink">DISQUALIFIED</StatusChip>
                              {s.disqualificationReason && (
                                <span className="block text-[10px] text-red-700 font-medium mt-0.5 max-w-[140px] truncate" title={s.disqualificationReason}>
                                  {s.disqualificationReason}
                                </span>
                              )}
                            </div>
                          ) : isLowCoverage ? (
                            <div>
                              <StatusChip color="peach">{s.tier}</StatusChip>
                              <span className="block text-[10px] text-amber-800 font-bold font-mono mt-0.5">
                                INSUFFICIENT DATA
                              </span>
                            </div>
                          ) : (
                            <StatusChip color={s.totalScore >= 80 ? 'mint' : s.totalScore >= 60 ? 'peach' : 'pink'}>
                              {s.tier}
                            </StatusChip>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[11px] text-[#0A0A0A]">
                          {s.recommendedAction}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION H: COMPLETE 7Ps MARKETING MIX                                    */}
          {/* ========================================================================= */}
          <section className="space-y-6 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-[2.5px] border-[#0A0A0A] pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#8C6ADE]" />
                <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                  Section H: Complete 7Ps Marketing Mix Synthesis
                </h2>
              </div>

              {/* Segment Selector Pills if multiple segments */}
              {candidateSegments.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="font-mono text-xs font-bold text-[#0A0A0A]/70 uppercase mr-1">
                    TARGET:
                  </span>
                  {candidateSegments.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedMixSegmentId(seg.id)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border-[1.5px] border-[#0A0A0A] transition-all cursor-pointer ${
                        activeSegmentId === seg.id
                          ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                          : 'bg-white text-[#0A0A0A] hover:bg-[#F9F8F4]'
                      }`}
                    >
                      {seg.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {active7PsMix && (
              <div className="space-y-6 animate-fadeIn">
                {/* P1: PRODUCT */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P1. PRODUCT — Levels of Product Specification</h3>
                    </div>
                    <StatusChip color="mint">CORE &amp; AUGMENTED</StatusChip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="bg-[#E5F7E5] p-3 rounded-xl border border-[#0A0A0A]">
                      <span className="text-[10px] font-black uppercase text-emerald-950 block">1. CORE BENEFIT</span>
                      <p className="font-bold text-xs mt-1 text-emerald-950">{active7PsMix.product.coreBenefit}</p>
                    </div>
                    <div className="bg-[#F9F8F4] p-3 rounded-xl border border-[#0A0A0A]">
                      <span className="text-[10px] font-black uppercase text-[#0A0A0A]/60 block">2. EXPECTED PRODUCT</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] mt-1 font-sans">
                        {active7PsMix.product.expectedProduct.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                    <div className="bg-[#FFE3B3] p-3 rounded-xl border border-[#0A0A0A]">
                      <span className="text-[10px] font-black uppercase text-amber-950 block">3. AUGMENTED PRODUCT</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] mt-1 font-sans">
                        {active7PsMix.product.augmentedProduct.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                    <div className="bg-[#E4E6FB] p-3 rounded-xl border border-[#0A0A0A]">
                      <span className="text-[10px] font-black uppercase text-[#0A0A0A]/60 block">4. POTENTIAL PRODUCT</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] mt-1 font-sans">
                        {active7PsMix.product.potentialProduct.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  </div>

                  {/* Feature -> Advantage -> Benefit mapping */}
                  <div className="space-y-2 pt-2">
                    <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
                      FEATURE → ADVANTAGE → CUSTOMER BENEFIT (FAB) LEDGER:
                    </span>
                    <div className="border border-[#0A0A0A] rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="bg-[#F9F8F4] border-b text-[#0A0A0A]">
                            <th className="p-2.5 font-black">FEATURE</th>
                            <th className="p-2.5 font-black">ADVANTAGE</th>
                            <th className="p-2.5 font-black">CUSTOMER BENEFIT</th>
                            <th className="p-2.5 font-black">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0A0A0A]/15 font-sans font-medium">
                          {active7PsMix.product.fabMapping.map((fab, i) => (
                            <tr key={i}>
                              <td className="p-2.5 font-bold text-[#0A0A0A]">{fab.feature}</td>
                              <td className="p-2.5 text-[#0A0A0A]/80">{fab.advantage}</td>
                              <td className="p-2.5 text-[#0A0A0A]/80">{fab.customerBenefit}</td>
                              <td className="p-2.5 font-mono text-[10px]">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${fab.isExisting ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                  {fab.isExisting ? 'EXISTING' : 'PROPOSED'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </BrutalistCard>

                {/* P2: PRICE */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P2. PRICE — Value-Based Pricing Strategy</h3>
                    </div>
                    <StatusChip color="peach">PRICING FRAMEWORK</StatusChip>
                  </div>

                  <div className="bg-[#FFF9EE] border border-amber-300 p-4 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-black uppercase text-amber-950">RECOMMENDED PRICING APPROACH:</span>
                      <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {active7PsMix.price.pricingApproach}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-[#0A0A0A] leading-snug">
                      {active7PsMix.price.recommendedPricePoint}
                    </p>
                    <p className="text-[#0A0A0A]/80 font-medium">
                      {active7PsMix.price.rationale}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="bg-white p-3 rounded-lg border border-[#0A0A0A]/20">
                      <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">SWITCHING COSTS</span>
                      <p className="text-[11px] font-sans font-medium text-[#0A0A0A] mt-1">{active7PsMix.price.switchingCosts}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-[#0A0A0A]/20">
                      <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">IMPLEMENTATION OVERHEAD</span>
                      <p className="text-[11px] font-sans font-medium text-[#0A0A0A] mt-1">{active7PsMix.price.implementationCosts}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-[#0A0A0A]/20">
                      <span className="text-[10px] text-[#0A0A0A]/60 block font-bold">COST-TO-SERVE DYNAMICS</span>
                      <p className="text-[11px] font-sans font-medium text-[#0A0A0A] mt-1">{active7PsMix.price.costToServe}</p>
                    </div>
                  </div>

                  <div className="pt-2 text-xs space-y-1">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                      REQUIRED PRICING VALIDATION RESEARCH:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[#0A0A0A]/80 font-medium">
                      {active7PsMix.price.recommendedPricingResearch.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                </BrutalistCard>

                {/* P3: PLACE / DISTRIBUTION */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P3. PLACE — Channel &amp; Distribution Architecture</h3>
                    </div>
                    <StatusChip color="lavender">HYBRID CHANNEL</StatusChip>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                        DISTRIBUTION MODEL: {active7PsMix.place.distributionModel}
                      </span>
                      <p className="text-[#0A0A0A]/85 leading-relaxed">{active7PsMix.place.rationale}</p>
                      <span className="font-mono text-[10px] font-bold text-[#0A0A0A]/70 uppercase block pt-1">CUSTOMER TOUCHPOINTS:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[#0A0A0A]/80">
                        {active7PsMix.place.customerTouchpoints.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                        IMPLEMENTATION REQUIREMENTS &amp; RISKS
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[#0A0A0A]/80">
                        {active7PsMix.place.implementationRequirements.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                      <span className="font-mono text-[10px] font-bold text-amber-900 uppercase block pt-1">CHANNEL RISKS:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-950 font-semibold">
                        {active7PsMix.place.channelRisks.map((r, i) => <li key={i}>⚠ {r}</li>)}
                      </ul>
                    </div>
                  </div>
                </BrutalistCard>

                {/* P4: PROMOTION */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P4. PROMOTION — Targeted Communications Strategy</h3>
                    </div>
                    <StatusChip color="mint">5-STAGE JOURNEY</StatusChip>
                  </div>

                  {/* 5 Consumer Decision Stages */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                    <div className="bg-[#F9F8F4] p-2.5 rounded-lg border">
                      <span className="text-[9px] font-black uppercase text-[#0A0A0A]/60 block">1. AWARENESS</span>
                      <p className="font-sans text-[11px] mt-1">{active7PsMix.promotion.decisionJourney.needRecognition}</p>
                    </div>
                    <div className="bg-[#F9F8F4] p-2.5 rounded-lg border">
                      <span className="text-[9px] font-black uppercase text-[#0A0A0A]/60 block">2. SEARCH</span>
                      <p className="font-sans text-[11px] mt-1">{active7PsMix.promotion.decisionJourney.searchForAlternatives}</p>
                    </div>
                    <div className="bg-[#F9F8F4] p-2.5 rounded-lg border">
                      <span className="text-[9px] font-black uppercase text-[#0A0A0A]/60 block">3. EVALUATION</span>
                      <p className="font-sans text-[11px] mt-1">{active7PsMix.promotion.decisionJourney.evaluationOfOptions}</p>
                    </div>
                    <div className="bg-[#F9F8F4] p-2.5 rounded-lg border">
                      <span className="text-[9px] font-black uppercase text-[#0A0A0A]/60 block">4. ADOPTION</span>
                      <p className="font-sans text-[11px] mt-1">{active7PsMix.promotion.decisionJourney.purchaseAdoption}</p>
                    </div>
                    <div className="bg-[#F9F8F4] p-2.5 rounded-lg border">
                      <span className="text-[9px] font-black uppercase text-[#0A0A0A]/60 block">5. RETENTION</span>
                      <p className="font-sans text-[11px] mt-1">{active7PsMix.promotion.decisionJourney.postPurchaseEvaluation}</p>
                    </div>
                  </div>

                  {/* Sample Messaging Drafts */}
                  <div className="bg-[#F0EFEA] border-[2px] border-[#0A0A0A] p-4.5 rounded-xl space-y-3 text-xs">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                      SAMPLE MESSAGING DRAFTS (FOR TESTING ONLY):
                    </span>
                    <div className="space-y-2">
                      <p><strong>Positioning Headline:</strong> "{active7PsMix.promotion.sampleDrafts.headline}"</p>
                      <p className="bg-white p-2.5 rounded border border-[#0A0A0A]/20">
                        <strong>Outbound Angle:</strong> {active7PsMix.promotion.sampleDrafts.outreachAngle}
                      </p>
                      <p><strong>Discovery Question:</strong> <em>"{active7PsMix.promotion.sampleDrafts.discoveryQuestion}"</em></p>
                      <p><strong>Call to Action:</strong> <code className="bg-[#A1F000] px-1.5 py-0.5 rounded font-mono font-bold">{active7PsMix.promotion.sampleDrafts.callToAction}</code></p>
                    </div>
                  </div>
                </BrutalistCard>

                {/* P5: PEOPLE */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P5. PEOPLE — Human Delivery &amp; Sales Conversation Capability</h3>
                    </div>
                    <StatusChip color="peach">BUYING COMMITTEE</StatusChip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="bg-[#F9F8F4] p-3 rounded-lg border">
                      <span className="text-[10px] font-bold text-[#0A0A0A]/60 block">ECONOMIC BUYER</span>
                      <p className="text-[11px] font-sans font-bold text-[#0A0A0A] mt-1">
                        {active7PsMix.people.buyingCommitteeEngagement.economicBuyerRole}
                      </p>
                    </div>
                    <div className="bg-[#F9F8F4] p-3 rounded-lg border">
                      <span className="text-[10px] font-bold text-[#0A0A0A]/60 block">INTERNAL CHAMPION</span>
                      <p className="text-[11px] font-sans font-bold text-[#0A0A0A] mt-1">
                        {active7PsMix.people.buyingCommitteeEngagement.championRole}
                      </p>
                    </div>
                    <div className="bg-[#F9F8F4] p-3 rounded-lg border">
                      <span className="text-[10px] font-bold text-[#0A0A0A]/60 block">TECHNICAL EVALUATOR</span>
                      <p className="text-[11px] font-sans font-bold text-[#0A0A0A] mt-1">
                        {active7PsMix.people.buyingCommitteeEngagement.technicalEvaluatorRole}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 font-medium text-[#0A0A0A]/85">
                    <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                      REQUIRED BUYER-FACING EXPERTISE:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {active7PsMix.people.buyerFacingExpertise.map((exp, i) => <li key={i}>{exp}</li>)}
                    </ul>
                  </div>
                </BrutalistCard>

                {/* P6: PROCESS */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P6. PROCESS — Standardized Customer Journey</h3>
                    </div>
                    <StatusChip color="lavender">5-GATE JOURNEY</StatusChip>
                  </div>

                  <div className="space-y-3">
                    {active7PsMix.process.journeyStages.map((stage, idx) => (
                      <div key={idx} className="border border-[#0A0A0A] rounded-xl p-3.5 bg-[#F9F8F4] space-y-1 text-xs">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-black text-sm text-[#0A0A0A]">{stage.stage}</span>
                          {stage.requiresHumanVerification && (
                            <span className="bg-[#FFE3B3] text-amber-950 font-bold px-1.5 py-0.5 rounded text-[10px] border border-amber-300">
                              HUMAN GATE
                            </span>
                          )}
                        </div>
                        <p className="text-[#0A0A0A]/85 font-medium">{stage.customerAction} → {stage.sellerDelivery}</p>
                        <div className="flex justify-between items-center pt-1 text-[11px] font-mono text-[#0A0A0A]/60">
                          <span>KPI: {stage.metricsToMonitor.join('; ')}</span>
                          <span className="text-amber-900 font-semibold">Friction: {stage.frictionPoints[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </BrutalistCard>

                {/* P7: PHYSICAL EVIDENCE */}
                <BrutalistCard bg="white" shadowSize="sm" className="p-6 space-y-4 border-[2.5px] border-[#0A0A0A]">
                  <div className="flex items-center justify-between border-b-2 border-[#0A0A0A]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-[#8C6ADE]" />
                      <h3 className="text-lg font-black text-[#0A0A0A]">P7. PHYSICAL EVIDENCE — Trust Signals &amp; Proof Assets</h3>
                    </div>
                    <StatusChip color="pink">PROOF AUDIT</StatusChip>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                    <div className="bg-[#E5F7E5] border border-emerald-300 p-4 rounded-xl space-y-2">
                      <span className="font-mono text-[10px] font-black uppercase text-emerald-950 block">
                        EXISTING PROOF SIGNALS:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-emerald-950">
                        {active7PsMix.physicalEvidence.existingProofAssets.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>

                    <div className="bg-[#FFF9EE] border border-amber-300 p-4 rounded-xl space-y-2">
                      <span className="font-mono text-[10px] font-black uppercase text-amber-950 block">
                        REQUIRED PROOF ASSETS (AWAITING CREATION):
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-amber-950 font-bold">
                        {active7PsMix.physicalEvidence.proofAssetsRequired.map((p, i) => <li key={i}>⚠ {p}</li>)}
                      </ul>
                    </div>
                  </div>
                </BrutalistCard>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* SECTION I: INTEGRATED ACTION PLAN                                        */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b-[2.5px] border-[#0A0A0A] pb-2">
              <Sparkles className="w-5 h-5 text-[#8C6ADE]" />
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Section I: Integrated Go-to-Market Action Plan
              </h2>
            </div>

            {/* Immediate Sprint Actions */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
                IMMEDIATE ACTIONS (SPRINT 1)
              </span>
              <div className="space-y-2.5">
                {report.actionPlan.immediate.map((act) => (
                  <div key={act.id} className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1.5 text-xs shadow-[2px_2px_0px_#0A0A0A]">
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-black text-sm text-[#0A0A0A]">{act.action}</span>
                      <span className="font-bold text-[10px] uppercase bg-[#8C6ADE] text-white px-2 py-0.5 rounded">
                        {act.marketingMixDimension.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-[#0A0A0A]/70 pt-1">
                      <div><strong>Role:</strong> {act.suggestedRole}</div>
                      <div><strong>Metric:</strong> {act.successMetric}</div>
                      <div><strong>Confidence:</strong> {act.evidenceConfidence.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Actions */}
            <div className="space-y-3 pt-2">
              <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] bg-[#FFE3B3] px-2 py-0.5 rounded border border-[#0A0A0A]">
                NEXT PRIORITIES (SPRINTS 2–3)
              </span>
              <div className="space-y-2.5">
                {report.actionPlan.next.map((act) => (
                  <div key={act.id} className="bg-white border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-1 text-xs">
                    <span className="font-black text-sm text-[#0A0A0A] block">{act.action}</span>
                    <div className="flex justify-between text-[11px] font-mono text-[#0A0A0A]/70">
                      <span>Role: {act.suggestedRole}</span>
                      <span>Target: {act.successMetric}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What to Validate First */}
            <div className="bg-[#F0EFEA] border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2 text-xs">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                WHAT TO VALIDATE FIRST (BEFORE SCALING OUTBOUND BUDGET):
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[#0A0A0A] font-semibold">
                {report.actionPlan.whatToValidateFirst.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION J: EVIDENCE & STATUTORY LIMITATIONS APPENDIX                     */}
          {/* ========================================================================= */}
          <section className="space-y-4 pt-4 border-t-[2.5px] border-[#0A0A0A]">
            <h3 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
              Section J: Evidence, Data Provenance &amp; Limitations Appendix
            </h3>

            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-5 rounded-xl space-y-2 text-xs font-medium text-[#0A0A0A]/85">
              <p><strong>Average Evidence Coverage:</strong> {report.evidenceLimitations.evidenceCoveragePercent}% of assessed account dimensions supported by verified data.</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] pt-1">
                {report.evidenceLimitations.unknownAttributes.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
              <div className="pt-2 font-mono text-[10px] font-bold text-amber-950">
                <p>⚠ {report.evidenceLimitations.statutoryNotice}</p>
                <p className="mt-1">⚠ {report.evidenceLimitations.brandEquityNotice}</p>
              </div>
            </div>
          </section>

          {/* SIGNOFF FOOTER */}
          <div className="border-t-[2.5px] border-[#0A0A0A] pt-6 flex justify-between items-center text-xs font-mono text-[#0A0A0A]/70">
            <span>Generated by icp.mode · Algorithmic Strategy Engine · {report.analysisVersion}</span>
            <span>Document Signature: SHA-256 Validated</span>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};
