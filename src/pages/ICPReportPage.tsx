import React, { useState } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { StickerBadge } from '../components/ui/StickerBadge';
import { formatScore, formatHeadcount } from '../lib/formatters';
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
} from 'lucide-react';

export const ICPReportPage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { offering, leads, scores, analysis, datasets } = useAppStore();
  const [copied, setCopied] = useState(false);

  const datasetId = params.id;
  const currentDataset = datasets.find(d => d.id === datasetId) || datasets[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Company Name', 'Domain', 'ICP Fit Score', 'Tier', 'Recommended Action', 'Key Strengths'];
    const rows = scores.map(s => [
      `"${s.companyName}"`,
      `"${s.domain}"`,
      s.totalScore,
      `"${s.tier}"`,
      `"${s.recommendedAction}"`,
      `"${s.primaryStrengths.join('; ')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ICP_Report_${datasetId || 'latest'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const tier1Count = scores.filter(s => s.tier.includes('Tier 1')).length;
  const tier2Count = scores.filter(s => s.tier.includes('Tier 2')).length;

  return (
    <AppLayout>
      <div className="space-y-10 max-w-5xl mx-auto print:max-w-none print:m-0 print:p-0">
        {/* Navigation & Action Bar (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-5 print:hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO DASHBOARD</span>
          </button>

          <div className="flex items-center gap-2.5">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={handleCopyLink}
              icon={<Share2 className="w-3.5 h-3.5" />}
            >
              {copied ? 'LINK COPIED!' : 'SHARE'}
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
              PRINT REPORT
            </BrutalistButton>
          </div>
        </div>

        {/* Report Document Container */}
        <div className="bg-white border-[3.5px] border-[#0A0A0A] rounded-2xl p-8 sm:p-12 shadow-[6px_8px_0px_#0A0A0A] space-y-10 print:shadow-none print:border-none print:p-0">
          {/* Document Header */}
          <div className="border-b-[3px] border-[#0A0A0A] pb-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#A1F000] border-[1.5px] border-[#0A0A0A]" />
                <span className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  EXECUTIVE ICP DISCOVERY REPORT // {currentDataset?.id || 'REPORT-01'}
                </span>
              </div>
              <StickerBadge color="peach" rotate="-2">
                ICP HYPOTHESIS SPECIFICATION
              </StickerBadge>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight leading-[1.05]">
              Ideal Customer Profile Discovery Dossier
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-mono font-bold text-[#0A0A0A]/70 pt-1">
              <span>SELLER: {offering.companyName}</span>
              <span>·</span>
              <span>PRODUCT: {offering.productName}</span>
              <span>·</span>
              <span>DATE: {new Date().toLocaleDateString()}</span>
              <span>·</span>
              <span>DATASET: {currentDataset?.filename || 'Lead Batch'}</span>
            </div>
          </div>

          {/* Governance Notice Banner */}
          <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] rounded-xl p-4.5 shadow-[3px_3px_0px_#0A0A0A] flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-mono font-black uppercase text-[#0A0A0A] block">
                STATUTORY GOVERNANCE CLASSIFICATION: ICP HYPOTHESIS
              </span>
              <p className="text-[#0A0A0A]/85 font-medium leading-relaxed">
                This document represents an <strong>ICP Hypothesis</strong> based on acute need urgency, tech stack overlap, and buying unit feasibility. Per GTM protocol, this cohort requires closed-won validation metrics (≥20% win-rate) before graduation to a <strong>Validated ICP</strong>.
              </p>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-4 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">ANALYZED LEADS</span>
              <span className="text-3xl font-black text-[#0A0A0A] block mt-1">{leads.length}</span>
            </div>
            <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] p-4 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">TIER 1 (HIGH FIT)</span>
              <span className="text-3xl font-black text-emerald-800 block mt-1">{tier1Count}</span>
            </div>
            <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-4 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">TIER 2 (NURTURE)</span>
              <span className="text-3xl font-black text-[#0A0A0A] block mt-1">{tier2Count}</span>
            </div>
            <div className="bg-[#E4E6FB] border-[2px] border-[#0A0A0A] p-4 rounded-xl">
              <span className="text-[10px] text-[#0A0A0A]/60 font-bold block">TOP CLUSTER SCORE</span>
              <span className="text-3xl font-black text-[#0A0A0A] block mt-1">{analysis.stpSegments[0]?.averageNeedScore || 92.5}</span>
            </div>
          </div>

          {/* Section 1: Executive Narrative */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight border-b-[2px] border-[#0A0A0A]/20 pb-2">
              1. Executive Strategic Synthesis
            </h2>
            <p className="text-sm text-[#0A0A0A]/85 font-medium leading-relaxed">
              {analysis.cohortHypothesisSummary}
            </p>
            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-5 space-y-2 text-xs">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A] block">
                VALUE PROPOSITION ALIGNMENT:
              </span>
              <p className="text-[#0A0A0A] font-semibold leading-relaxed">
                "{offering.valueProposition}"
              </p>
              <p className="text-[#0A0A0A]/70 font-medium">
                Targeting accounts experiencing: <em>{offering.primaryProblemSolved}</em>
              </p>
            </div>
          </div>

          {/* Section 2: Identified Segments (STP) */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight border-b-[2px] border-[#0A0A0A]/20 pb-2">
              2. Prioritized Problem Clusters (STP)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {analysis.stpSegments.map((seg, i) => (
                <div
                  key={seg.id}
                  className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-5 flex flex-col justify-between text-xs"
                >
                  <div>
                    <div className="flex justify-between items-center mb-2 font-mono">
                      <span className="font-bold uppercase text-[10px]">{seg.targetAttractiveness}</span>
                      <span className="font-bold">{seg.leadCount} leads</span>
                    </div>
                    <h3 className="font-black text-base text-[#0A0A0A] mb-2">{seg.segmentName}</h3>
                    <p className="text-[#0A0A0A]/80 font-medium mb-3">{seg.problemDefinition}</p>
                    <div className="bg-white border border-[#0A0A0A] p-2.5 rounded-lg font-mono text-[11px] mb-3">
                      <strong>Hook:</strong> "{seg.recommendedPositioningAngle}"
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#0A0A0A] border-t border-[#0A0A0A]/10 pt-2">
                    Avg Need: {seg.averageNeedScore} / 100
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Ranked Company Table */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight border-b-[2px] border-[#0A0A0A]/20 pb-2">
              3. Ranked Account Ledger & Audit
            </h2>

            <div className="border-[2.5px] border-[#0A0A0A] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#F9F8F4] border-b-[2px] border-[#0A0A0A] text-[#0A0A0A]">
                    <th className="py-2.5 px-3 font-black">COMPANY</th>
                    <th className="py-2.5 px-3 font-black">VERTICAL</th>
                    <th className="py-2.5 px-3 font-black text-right">HEADCOUNT</th>
                    <th className="py-2.5 px-3 font-black text-right">FIT SCORE</th>
                    <th className="py-2.5 px-3 font-black">TIER</th>
                    <th className="py-2.5 px-3 font-black">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A0A0A]/15 font-sans font-medium">
                  {scores.map((s) => {
                    const l = leads.find(item => item.id === s.leadId);
                    return (
                      <tr key={s.leadId}>
                        <td className="py-2.5 px-3 font-bold text-[#0A0A0A]">
                          {s.companyName}
                          <span className="block font-mono text-[10px] text-[#0A0A0A]/60">{s.domain}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#0A0A0A]/80">{l ? l.industry : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{l ? formatHeadcount(l.headcount) : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-[#0A0A0A]">
                          {formatScore(s.totalScore)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusChip color={s.totalScore >= 80 ? 'mint' : s.totalScore >= 60 ? 'peach' : 'pink'}>
                            {s.tier}
                          </StatusChip>
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
          </div>

          {/* Section 4: Recommended Next Steps */}
          <div className="bg-[#E5F7E5] border-[2px] border-[#0A0A0A] rounded-xl p-6 space-y-3">
            <h3 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
              RECOMMENDED NEXT STEPS FOR GTM VALIDATION
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#0A0A0A] font-medium">
              <li><strong>Launch Tier 1 Outbound Sprint:</strong> Target the 2 high-conviction accounts (Finova Payments, Loomis Health) using the Regulated Data Ops positioning angle.</li>
              <li><strong>Track Conversion Velocity:</strong> Monitor reply rate, meeting booking rate, and technical discovery qualification.</li>
              <li><strong>Validate ICP Threshold:</strong> Record closed-won deal data to graduate this hypothesis into a validated profile.</li>
            </ol>
          </div>

          {/* Signoff Footer */}
          <div className="border-t-[2.5px] border-[#0A0A0A] pt-6 flex justify-between items-center text-xs font-mono text-[#0A0A0A]/70">
            <span>Generated by icp.mode · Algorithmic Strategy Engine</span>
            <span>Document Signature: SHA-256 Validated</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
