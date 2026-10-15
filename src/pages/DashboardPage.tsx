import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { MetricCard } from '../components/ui/MetricCard';
import { StickerBadge } from '../components/ui/StickerBadge';
import { StatusChip } from '../components/ui/StatusChip';
import { TableShell } from '../components/ui/TableShell';
import { EmptyState } from '../components/ui/EmptyState';
import { formatScore, formatHeadcount } from '../lib/formatters';
import { batchScoreLeads } from '../lib/scoring';
import { deriveTierCounts, qualifiedSegmentIds, scoreTier } from '../lib/tiers';
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  GitFork,
  Building2,
  CheckCircle2,
  ExternalLink,
  Target,
  RefreshCw,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  ShieldAlert,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    leads,
    scores,
    segments,
    datasets,
    activeDatasetId,
    isDemoMode,
    sellerContext,
    offering,
    analysis,
    weights,
    isContextComplete,
    contextCompletionScore,
    missingContextFields,
    resetToDemoData,
    refreshLiveWorkspace,
  } = useAppStore();

  const hasDatasets = datasets.length > 0;
  useEffect(() => {
    if (!isDemoMode && hasDatasets) refreshLiveWorkspace();
  }, [isDemoMode, hasDatasets, refreshLiveWorkspace]);

  const [tierFilter, setTierFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'coverage_desc' | 'headcount_desc'>('score_desc');

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  const totalLeads = leads.length;
  const classifiedCount = isDemoMode ? leads.filter((l) => l.aiClassification).length || totalLeads : leads.filter((l) => l.analysisStatus === 'completed').length;
  const candidateSegmentsCount = segments.length;

  // Real scores: use store scores if populated, or compute deterministic scores
  const allScoredLeads = useMemo(() => {
    if (scores.length > 0) return scores;
    if (isDemoMode && leads.length > 0) {
      return batchScoreLeads(leads, offering, analysis, weights);
    }
    return [];
  }, [scores, leads, offering, analysis, weights, isDemoMode]);

  const tierCounts = deriveTierCounts(allScoredLeads);
  const highFitCount = tierCounts.tier1;

  const topSegment = segments.find(segment => segment.targetAttractiveness !== 'Avoid' && qualifiedSegmentIds(segment.matchedLeadIds, allScoredLeads).length > 0) || null;

  const filteredAndSortedScores = useMemo(() => {
    let result = [...allScoredLeads];

    // Filter by tier
    if (tierFilter !== 'all') {
      if (tierFilter === 'tier1' || tierFilter === 'tier2' || tierFilter === 'tier3' || tierFilter === 'disqualified') result = result.filter((s) => scoreTier(s) === tierFilter);
    }

    // Filter by evidence coverage
    if (coverageFilter === 'sufficient') {
      result = result.filter((s) => (s.evidenceCoverage ?? 100) >= 70);
    } else if (coverageFilter === 'insufficient') {
      result = result.filter((s) => (s.evidenceCoverage ?? 100) < 70);
    }

    // Sort
    result.sort((a, b) => {
      const leadA = leads.find((l) => l.id === a.leadId);
      const leadB = leads.find((l) => l.id === b.leadId);

      if (sortBy === 'score_desc') return b.totalScore - a.totalScore;
      if (sortBy === 'score_asc') return a.totalScore - b.totalScore;
      if (sortBy === 'coverage_desc') return (b.evidenceCoverage ?? 100) - (a.evidenceCoverage ?? 100);
      if (sortBy === 'headcount_desc') return (leadB?.headcount || 0) - (leadA?.headcount || 0);
      return 0;
    });

    return result;
  }, [allScoredLeads, tierFilter, coverageFilter, sortBy, leads]);

  return (
    <AppLayout>
      <div className="space-y-10">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b-[2.5px] border-[#0A0A0A] pb-8">
          <div>
            <SectionEyebrow color="bg-[#6AAAFB]">
              YOUR CUSTOMER INTELLIGENCE
            </SectionEyebrow>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0A0A0A] tracking-tight leading-[1.08] text-balance">
              Your next best customer is already in your data.
            </h1>

            <p className="mt-3 text-base text-[#0A0A0A]/75 font-medium max-w-2xl">
              Upload, understand, and prioritize companies that fit what you sell.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isDemoMode && totalLeads === 0 ? (
              <BrutalistButton
                variant="white"
                size="md"
                onClick={resetToDemoData}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="text-xs font-bold"
              >
                RESTORE DEMO DATA
              </BrutalistButton>
            ) : null}

            <BrutalistButton
              variant="lime"
              size="md"
              onClick={() => navigate('/uploads/new')}
              icon={<UploadCloud className="w-4 h-4" />}
              className="text-xs font-black tracking-wider"
            >
              UPLOAD LEADS
            </BrutalistButton>
          </div>
        </div>

        {/* Seller Product Context Calibration Banner */}
        {!isContextComplete ? (
          <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-4 sm:p-5 rounded-2xl shadow-[4px_4px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white border-[2px] border-[#0A0A0A] rounded-xl shadow-[2px_2px_0px_#0A0A0A] shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                    SELLER OFFERING CONTEXT INCOMPLETE ({contextCompletionScore}%)
                  </span>
                  <span className="bg-[#FFB6C2] font-mono text-[10px] font-black px-2 py-0.5 rounded border border-[#0A0A0A]">
                    REQUIRED FOR ICP ACCURACY
                  </span>
                </div>
                <p className="text-xs text-[#0A0A0A]/80 font-medium mt-1 leading-relaxed">
                  Your ICP engine needs product capabilities and Need Gap definitions to calculate high-conviction match scores. Missing: <strong>{missingContextFields.slice(0, 3).join(', ')}</strong>.
                </p>
              </div>
            </div>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate('/onboarding')}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              className="text-xs font-black shrink-0"
            >
              COMPLETE SELLER ONBOARDING
            </BrutalistButton>
          </div>
        ) : (
          <div className="bg-white border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5 truncate">
              <span className="w-2.5 h-2.5 bg-[#A1F000] border border-[#0A0A0A] rounded-full shrink-0" />
              <span className="font-bold text-[#0A0A0A]">ACTIVE SELLER PROFILE:</span>
              <span className="font-black text-[#0A0A0A] bg-[#E5F7E5] px-2 py-0.5 rounded border border-[#0A0A0A] truncate">
                {sellerContext.productName || sellerContext.companyName} ({sellerContext.businessModel})
              </span>
              <span className="text-[#0A0A0A]/60 hidden md:inline">
                · {sellerContext.indicativePricing || 'ACV Calibrated'}
              </span>
            </div>

            <button
              onClick={() => navigate('/onboarding')}
              className="font-bold text-[#0A0A0A] underline hover:text-[#8C6ADE] cursor-pointer text-left sm:text-right shrink-0"
            >
              EDIT OFFERING PARAMS →
            </button>
          </div>
        )}

        {/* Four Pastel Metric Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="TOTAL UPLOADED LEADS"
            value={totalLeads}
            unit="ACCOUNTS"
            subtext={totalLeads > 0 ? `${datasets.length} active lead batch` : 'No lead files uploaded'}
            bg="peach"
            badge={<StickerBadge color="peach" rotate="-2">INGESTED</StickerBadge>}
          />

          <MetricCard
            label="CLASSIFIED COMPANIES"
            value={classifiedCount}
            unit="ENRICHED"
            subtext="Clean firmographics & tech stacks"
            bg="lavender"
            badge={<StickerBadge color="purple" rotate="2">NORMALIZED</StickerBadge>}
          />

          <MetricCard
            label="CANDIDATE ICP SEGMENTS"
            value={candidateSegmentsCount}
            unit="CLUSTERS"
            subtext="Grouped by shared business problem"
            bg="mint"
            badge={<StickerBadge color="lime" rotate="-2">STP MATRIX</StickerBadge>}
          />

          <MetricCard
            label="HIGH-FIT COMPANIES"
            value={highFitCount}
            unit="TIER 1"
            subtext="Acute need urgency & architecture fit"
            bg="pink"
            badge={<StickerBadge color="pink" rotate="2">PRIORITY</StickerBadge>}
          />
        </div>

        {/* If leads exist: show middle & bottom sections */}
        {totalLeads > 0 ? (
          <>
            {/* Middle Grid: Latest Dataset Progress & Top Segment */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Middle-Left: Latest Dataset & Progress */}
              <div className="lg:col-span-6">
                <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4 border-b-[2px] border-[#0A0A0A]/15 pb-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#8C6ADE]" />
                        <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                          LATEST UPLOADED DATASET
                        </span>
                      </div>
                      <StatusChip color={activeDataset?.status === 'Completed' ? 'mint' : 'peach'}>
                        {activeDataset?.status || 'Active'}
                      </StatusChip>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight">
                          {activeDataset?.filename || 'Primary_Lead_List.csv'}
                        </h3>
                        <p className="font-mono text-xs text-[#0A0A0A]/60 font-semibold mt-0.5">
                          ID: {activeDataset?.id} · Size: {activeDataset?.fileSize} · Uploaded: {activeDataset?.uploadedAt ? new Date(activeDataset.uploadedAt).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="pt-2">
                        <div className="flex justify-between text-xs font-mono font-bold text-[#0A0A0A] mb-1">
                          <span>PIPELINE PROCESSING</span>
                          <span>{activeDataset?.processingProgress ?? 0}% COMPLETE</span>
                        </div>
                        <div className="h-3 w-full bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-md overflow-hidden p-0.5">
                          <div
                            className="h-full bg-[#A1F000] rounded-xs transition-all duration-300"
                            style={{ width: `${activeDataset?.processingProgress ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2 text-center font-mono">
                        <div className="bg-[#E5F7E5] border-[1.5px] border-[#0A0A0A] p-2 rounded-lg">
                          <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">TIER 1</span>
                          <span className="text-sm font-black text-[#0A0A0A]">{tierCounts.tier1}</span>
                        </div>
                        <div className="bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] p-2 rounded-lg">
                          <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">TIER 2</span>
                          <span className="text-sm font-black text-[#0A0A0A]">{tierCounts.tier2}</span>
                        </div>
                        <div className="bg-[#FFB6C2] border-[1.5px] border-[#0A0A0A] p-2 rounded-lg">
                          <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">OUT OF SCOPE</span>
                          <span className="text-sm font-black text-[#0A0A0A]">{tierCounts.disqualified}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-[2px] border-[#0A0A0A]/15 pt-4 mt-6 flex justify-between items-center">
                    <span className="text-xs font-mono text-[#0A0A0A]/60 font-medium">
                      {allScoredLeads.length} of {totalLeads} accounts scored
                    </span>
                    <button
                      onClick={() => navigate(`/uploads/${activeDataset?.id || 'dataset-01'}`)}
                      className="font-mono text-xs font-black text-[#0A0A0A] hover:text-[#8C6ADE] flex items-center gap-1 cursor-pointer"
                    >
                      <span>DATASET DETAILS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </BrutalistCard>
              </div>

              {/* Middle-Right: Top Identified Customer Segment */}
              <div className="lg:col-span-6">
                <BrutalistCard bg="mint" shadowSize="md" className="p-6 sm:p-7 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4 border-b-[2px] border-[#0A0A0A]/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-[#0A0A0A]" />
                        <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                          TOP IDENTIFIED CUSTOMER SEGMENT
                        </span>
                      </div>
                      <StickerBadge color="lime" rotate="-2">
                        HIGHEST CONVICTION
                      </StickerBadge>
                    </div>

                    {topSegment ? (
                      <div className="space-y-3">
                        <h3 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                          {topSegment.segmentName}
                        </h3>
                        <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed">
                          {topSegment.problemDefinition}
                        </p>

                        <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-3.5 shadow-[2px_2px_0px_#0A0A0A] space-y-1">
                          <span className="font-mono text-[10px] font-bold uppercase text-[#0A0A0A]/60 block">
                            RECOMMENDED POSITIONING HOOK:
                          </span>
                          <p className="text-xs font-black text-[#0A0A0A] italic">
                            "{topSegment.recommendedPositioningAngle}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-medium">No saved segment is available in this workspace yet.</p>
                    )}
                  </div>

                  <div className="border-t-[2px] border-[#0A0A0A]/20 pt-4 mt-6 flex justify-between items-center">
                    <span className="font-mono text-xs font-black text-[#0A0A0A]">
                      {topSegment ? `AVG FIT: ${topSegment.averageNeedScore} / 100` : 'SEGMENT NOT YET GENERATED'}
                    </span>
                    <button
                      onClick={() => navigate('/segments')}
                      className="font-mono text-xs font-black text-[#0A0A0A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>VIEW ALL SEGMENTS ({candidateSegmentsCount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </BrutalistCard>
              </div>
            </div>

            {/* Bottom: Ranked Company Preview Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight">
                    Ranked Company Preview
                  </h3>
                  <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
                    {filteredAndSortedScores.length} OF {allScoredLeads.length} ACCOUNTS
                  </span>
                </div>
                <button
                  onClick={() => navigate('/companies')}
                  className="font-mono text-xs font-black text-[#0A0A0A] hover:text-[#8C6ADE] underline underline-offset-4 cursor-pointer"
                >
                  VIEW ALL {leads.length} COMPANIES →
                </button>
              </div>

              {/* Filtering & Sorting Controls Bar (Prompt 12) */}
              <div className="bg-white border-[2px] border-[#0A0A0A] p-3 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#0A0A0A]/60" />
                    <span className="font-bold text-[#0A0A0A]/70">TIER:</span>
                    <select
                      value={tierFilter}
                      onChange={(e) => setTierFilter(e.target.value)}
                      className="bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A] px-2 py-1 rounded font-bold text-[#0A0A0A] cursor-pointer"
                    >
                      <option value="all">All Tiers ({allScoredLeads.length})</option>
                      <option value="tier1">Tier 1: High Conviction</option>
                      <option value="tier2">Tier 2: Moderate Fit</option>
                      <option value="tier3">Tier 3: Niche / Edge</option>
                      <option value="disqualified">Disqualified Accounts</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#0A0A0A]/70">COVERAGE:</span>
                    <select
                      value={coverageFilter}
                      onChange={(e) => setCoverageFilter(e.target.value)}
                      className="bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A] px-2 py-1 rounded font-bold text-[#0A0A0A] cursor-pointer"
                    >
                      <option value="all">All Evidence</option>
                      <option value="sufficient">Sufficient (≥70%)</option>
                      <option value="insufficient">Insufficient (&lt;70%)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#0A0A0A]/60" />
                  <span className="font-bold text-[#0A0A0A]/70">SORT:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-[#F9F8F4] border-[1.5px] border-[#0A0A0A] px-2 py-1 rounded font-bold text-[#0A0A0A] cursor-pointer"
                  >
                    <option value="score_desc">ICP Fit Score (High → Low)</option>
                    <option value="score_asc">ICP Fit Score (Low → High)</option>
                    <option value="coverage_desc">Evidence Coverage (High → Low)</option>
                    <option value="headcount_desc">Headcount (Large → Small)</option>
                  </select>
                </div>
              </div>

              <TableShell>
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                      <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase text-right">ICP FIT SCORE</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase text-center">COVERAGE</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase">INTENT STATUS</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase">CLASSIFICATION</th>
                      <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
                    {filteredAndSortedScores.slice(0, 10).map((score) => {
                      const lead = leads.find((l) => l.id === score.leadId);
                      return (
                        <tr
                          key={score.leadId}
                          className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/companies/${score.leadId}`)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-[#0A0A0A] text-sm group-hover:text-[#8C6ADE] transition-colors flex items-center gap-1.5">
                              <span>{score.companyName}</span>
                              {score.isDisqualified && (
                                <span className="bg-[#FFB6C2] text-rose-900 border border-rose-900 text-[9px] font-mono px-1 py-0.2 rounded font-black">
                                  DISQUALIFIED
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                              {score.domain || 'No website'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                            {lead ? lead.industry : 'Technology'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                            {lead ? formatHeadcount(lead.headcount) : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <span className="text-lg font-black text-[#0A0A0A]">
                              {formatScore(score.totalScore)}
                            </span>
                            <span className="text-[#0A0A0A]/40 text-xs font-bold"> / 100</span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-black ${
                                (score.evidenceCoverage ?? 100) >= 70
                                  ? 'bg-[#E5F7E5] border-emerald-800 text-emerald-950'
                                  : 'bg-[#FFB6C2] border-rose-800 text-rose-950'
                              }`}
                            >
                              {score.evidenceCoverage ?? 100}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[10px] font-bold text-[#0A0A0A]/70">
                            {score.intentLabel || 'BUYING INTENT: UNKNOWN'}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusChip
                              color={
                                score.isDisqualified
                                  ? 'pink'
                                  : score.totalScore >= 80
                                  ? 'mint'
                                  : score.totalScore >= 60
                                  ? 'peach'
                                  : 'pink'
                              }
                            >
                              {score.tier}
                            </StatusChip>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/companies/${score.leadId}`);
                              }}
                              className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>PROFILE</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableShell>
            </div>
          </>
        ) : (
          /* Empty-state guide for first-time users */
          <div className="py-6">
            <EmptyState
              title="Welcome! No lead datasets ingested yet."
              description="To discover your Ideal Customer Profile, begin by configuring your offering or upload your first company lead CSV."
              actionText="START UPLOAD WIZARD"
              onAction={() => navigate('/uploads/new')}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};
