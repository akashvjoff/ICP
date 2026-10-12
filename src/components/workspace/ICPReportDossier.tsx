import React, { useState } from 'react';
import { LeadICPScore } from '../../types/scoring';
import { NormalizedLead } from '../../types/lead';
import { OfferingProfile } from '../../types/offering';
import { FullStrategicAnalysis } from '../../types/analysis';
import { formatScore, formatHeadcount } from '../../lib/formatters';
import { SectionHeading } from '../ui/SectionHeading';
import { MetricCard } from '../ui/MetricCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { TableShell } from '../ui/TableShell';
import { StatusChip } from '../ui/StatusChip';
import { StickerBadge } from '../ui/StickerBadge';
import { Search, Download, Filter, ExternalLink, ShieldCheck } from 'lucide-react';

interface ICPReportDossierProps {
  scores: LeadICPScore[];
  leads: NormalizedLead[];
  offering: OfferingProfile;
  analysis: FullStrategicAnalysis;
  onInspectLead: (lead: NormalizedLead) => void;
}

export const ICPReportDossier: React.FC<ICPReportDossierProps> = ({
  scores,
  leads,
  offering,
  analysis,
  onInspectLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const filteredScores = scores.filter((score) => {
    const lead = leads.find((l) => l.id === score.leadId);
    const matchesSearch =
      score.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (score.domain ? score.domain.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
      (lead && lead.industry.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (tierFilter === 'all') return true;
    if (tierFilter === 'tier1') return score.tier.includes('Tier 1');
    if (tierFilter === 'tier2') return score.tier.includes('Tier 2');
    if (tierFilter === 'tier4') return score.tier.includes('Tier 4');
    return true;
  });

  const tier1Count = scores.filter(s => s.tier.includes('Tier 1')).length;
  const tier2Count = scores.filter(s => s.tier.includes('Tier 2')).length;
  const disqualifiedCount = scores.filter(s => s.tier.includes('Tier 4')).length;

  const handleExportCSV = () => {
    const headers = ['Company Name', 'Domain', 'ICP Fit Score', 'Tier', 'Recommended Action', 'Key Strengths', 'Key Disqualifiers'];
    const rows = scores.map(s => [
      `"${s.companyName}"`,
      `"${s.domain}"`,
      s.totalScore,
      `"${s.tier}"`,
      `"${s.recommendedAction}"`,
      `"${s.primaryStrengths.join('; ')}"`,
      `"${s.primaryDisqualifiers.join('; ')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `icp_mode_dossier_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
        <SectionHeading
          eyebrow="STEP 05 OF 05 // EXECUTIVE SYNTHESIS"
          eyebrowColor="bg-[#A1F000]"
          title="Explainable ICP Report & Lead Dossier"
          description="Deterministic customer scores, mathematical audit traces, and segmented go-to-market priorities."
          className="mb-0"
        />

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <BrutalistButton
            variant="lime"
            size="md"
            onClick={handleExportCSV}
            icon={<Download className="w-4 h-4" />}
          >
            {downloadSuccess ? 'EXPORTED CSV' : 'EXPORT DOSSIER CSV'}
          </BrutalistButton>
        </div>
      </div>

      {/* Massive Metric Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard
          label="TIER 1 (HIGH CONVICTION)"
          value={tier1Count}
          unit={`of ${scores.length}`}
          subtext="Acute need urgency with native architecture match."
          bg="mint"
          badge={<StickerBadge color="lime" rotate="-2">PRIORITY</StickerBadge>}
        />

        <MetricCard
          label="TIER 2 (MODERATE FIT)"
          value={tier2Count}
          unit={`of ${scores.length}`}
          subtext="Viable accounts for nurturing and long-term pipeline."
          bg="peach"
          badge={<StickerBadge color="peach" rotate="2">NURTURE</StickerBadge>}
        />

        <MetricCard
          label="DISQUALIFIED COHORT"
          value={disqualifiedCount}
          unit={`of ${scores.length}`}
          subtext="Incompatible architecture or sub-scale headcount."
          bg="pink"
          badge={<StickerBadge color="pink" rotate="-2">FILTER OUT</StickerBadge>}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-[2.5px] border-[#0A0A0A] p-3 rounded-2xl shadow-[3px_4px_0px_#0A0A0A]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#0A0A0A]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, domain, vertical..."
            className="w-full bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl pl-9 pr-3.5 py-2 font-mono text-xs font-bold text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none focus:ring-2 focus:ring-[#A1F000]"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto overflow-x-auto">
          <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> TIER:
          </span>
          <button
            onClick={() => setTierFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] transition-all cursor-pointer ${
              tierFilter === 'all'
                ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-white text-[#0A0A0A] hover:bg-[#F9F8F4]'
            }`}
          >
            ALL ({scores.length})
          </button>
          <button
            onClick={() => setTierFilter('tier1')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] transition-all cursor-pointer ${
              tierFilter === 'tier1'
                ? 'bg-[#E5F7E5] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-white text-[#0A0A0A] hover:bg-[#E5F7E5]/40'
            }`}
          >
            TIER 1 ({tier1Count})
          </button>
          <button
            onClick={() => setTierFilter('tier2')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] transition-all cursor-pointer ${
              tierFilter === 'tier2'
                ? 'bg-[#FFE3B3] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-white text-[#0A0A0A] hover:bg-[#FFE3B3]/40'
            }`}
          >
            TIER 2 ({tier2Count})
          </button>
          <button
            onClick={() => setTierFilter('tier4')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] transition-all cursor-pointer ${
              tierFilter === 'tier4'
                ? 'bg-[#FFB6C2] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-white text-[#0A0A0A] hover:bg-[#FFB6C2]/40'
            }`}
          >
            DISQUALIFIED ({disqualifiedCount})
          </button>
        </div>
      </div>

      {/* Main Scored Leads Directory Table */}
      <TableShell
        title="Evaluated Account Directory"
        countLabel={`${filteredScores.length} DISPLAYED`}
      >
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
              <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase text-right">FIT SCORE</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase">COHORT TIER</th>
              <th className="py-3 px-4 font-black tracking-wider uppercase text-center">AUDIT LEDGER</th>
            </tr>
          </thead>
          <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
            {filteredScores.map((score) => {
              const lead = leads.find((l) => l.id === score.leadId);
              return (
                <tr
                  key={score.leadId}
                  className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer group"
                  onClick={() => lead && onInspectLead(lead)}
                >
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-[#0A0A0A] text-sm group-hover:text-[#8C6ADE] transition-colors">
                      {score.companyName}
                    </div>
                    <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                      {score.domain || 'No website'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                    {lead ? lead.industry : '—'}
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
                        if (lead) onInspectLead(lead);
                      }}
                      className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>INSPECT</span>
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
  );
};
