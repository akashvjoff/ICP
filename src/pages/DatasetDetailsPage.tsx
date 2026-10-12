import React from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { StatusChip } from '../components/ui/StatusChip';
import { TableShell } from '../components/ui/TableShell';
import { formatScore, formatHeadcount } from '../lib/formatters';
import {
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Download,
  RotateCcw,
} from 'lucide-react';

export const DatasetDetailsPage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { navigate } = useRouter();
  const { datasets, leads, scores } = useAppStore();

  const datasetId = params.id || 'dataset-01';
  const dataset = datasets.find(d => d.id === datasetId) || datasets[0] || {
    id: datasetId,
    filename: 'Q1_North_America_SaaS_Pipeline.csv',
    fileSize: '1.4 MB',
    totalRows: 5,
    validRows: 5,
    uploadedAt: '2026-03-20T08:15:00Z',
    status: 'Completed' as const,
    processingProgress: 100,
    tier1Count: 2,
    tier2Count: 2,
    disqualifiedCount: 1,
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#8C6ADE]">
              DATASET DETAILS & HYGIENE
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              {dataset.filename}
            </h1>
            <p className="font-mono text-xs text-[#0A0A0A]/60 font-bold mt-1">
              DATASET ID: {dataset.id} · SIZE: {dataset.fileSize} · UPLOADED: {new Date(dataset.uploadedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={() => navigate('/uploads/new')}
            >
              UPLOAD NEW FILE
            </BrutalistButton>

            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={() => navigate(`/icp/report/${dataset.id}`)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              VIEW ICP REPORT
            </BrutalistButton>
          </div>
        </div>

        {/* Dataset Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[#E4E6FB] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_5px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              PROCESSING STATUS
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono text-[#0A0A0A]">
                {dataset.status}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/80 mt-1 block">
              100% Deterministic match
            </span>
          </div>

          <div className="bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_5px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              TOTAL ROWS
            </span>
            <span className="text-3xl font-black font-mono text-[#0A0A0A]">
              {dataset.totalRows}
            </span>
            <span className="font-mono text-[11px] font-bold text-[#0A0A0A]/80 mt-1 block">
              0 Duplicate domains
            </span>
          </div>

          <div className="bg-[#E5F7E5] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_5px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              TIER 1 (HIGH CONVICTION)
            </span>
            <span className="text-3xl font-black font-mono text-[#0A0A0A]">
              {dataset.tier1Count}
            </span>
            <span className="font-mono text-[11px] font-bold text-emerald-800 mt-1 block">
              Acute need detected
            </span>
          </div>

          <div className="bg-[#FFB6C2] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[4px_5px_0px_#0A0A0A]">
            <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block mb-1">
              OUT OF SCOPE
            </span>
            <span className="text-3xl font-black font-mono text-[#0A0A0A]">
              {dataset.disqualifiedCount}
            </span>
            <span className="font-mono text-[11px] font-bold text-rose-800 mt-1 block">
              Disqualified from outreach
            </span>
          </div>
        </div>

        {/* Scored Companies Table */}
        <TableShell
          title="Ingested Accounts in this Batch"
          countLabel={`${leads.length} LEADS`}
        >
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">FIT SCORE</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">COHORT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
              {scores.map((score) => {
                const lead = leads.find(l => l.id === score.leadId);
                return (
                  <tr
                    key={score.leadId}
                    className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/companies/${score.leadId}`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[#0A0A0A] text-sm">
                        {score.companyName}
                      </div>
                      <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                        {score.domain}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                      {lead ? lead.industry : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                      {lead ? formatHeadcount(lead.headcount) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <span className="text-base font-black text-[#0A0A0A]">
                        {formatScore(score.totalScore)}
                      </span>
                      <span className="text-[#0A0A0A]/40 text-xs font-bold"> / 100</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusChip
                        color={score.totalScore >= 80 ? 'mint' : score.totalScore >= 60 ? 'peach' : 'pink'}
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
                        className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>VIEW DOSSIER</span>
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
    </AppLayout>
  );
};
