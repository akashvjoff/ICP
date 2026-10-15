import React, { useState, useEffect } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { TableShell } from '../components/ui/TableShell';
import { StatusChip } from '../components/ui/StatusChip';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { formatScore, formatHeadcount } from '../lib/formatters';
import { analyzedScores, deriveTierCounts, scoreTier } from '../lib/tiers';
import { Search, Filter, ExternalLink, Download, ArrowUpDown } from 'lucide-react';

export const CompaniesPage: React.FC = () => {
  const { navigate } = useRouter();
  const { leads, scores, datasets, isDemoMode, refreshLiveWorkspace } = useAppStore();
  const hasDatasets = datasets.length > 0;
  useEffect(() => {
    if (!isDemoMode && hasDatasets) refreshLiveWorkspace();
  }, [isDemoMode, hasDatasets, refreshLiveWorkspace]);

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'scoreDesc' | 'scoreAsc' | 'name'>('scoreDesc');

  const visibleScores = analyzedScores(scores, isDemoMode ? undefined : leads);
  const companyRows = leads.map((lead) => ({
    lead,
    score: visibleScores.find((score) => score.leadId === lead.id),
  }));
  const tierCounts = deriveTierCounts(scores, isDemoMode ? undefined : leads);

  const filtered = companyRows
    .filter(({ lead, score }) => {
      const matchesSearch =
        lead.companyName.toLowerCase().includes(search.toLowerCase()) ||
        (lead.domain ? lead.domain.toLowerCase().includes(search.toLowerCase()) : false) ||
        lead.industry.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (tierFilter === 'tier1' || tierFilter === 'tier2' || tierFilter === 'tier3') return score ? scoreTier(score) === tierFilter : false;
      if (tierFilter === 'tier4' || tierFilter === 'disqualified') return score ? scoreTier(score) === 'disqualified' : false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'scoreDesc') return (b.score?.totalScore ?? -1) - (a.score?.totalScore ?? -1);
      if (sortBy === 'scoreAsc') return (a.score?.totalScore ?? Number.MAX_SAFE_INTEGER) - (b.score?.totalScore ?? Number.MAX_SAFE_INTEGER);
      return a.lead.companyName.localeCompare(b.lead.companyName);
    });

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#6AAAFB]">
              ACCOUNT DIRECTORY
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              Company Intelligence Table
            </h1>
            <p className="text-xs text-[#0A0A0A]/70 font-medium mt-1">
              Search, filter, and inspect mathematically scored candidate accounts.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={() => navigate('/uploads/new')}
            >
              INGEST MORE LEADS
            </BrutalistButton>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-[2.5px] border-[#0A0A0A] p-3 rounded-2xl shadow-[3px_4px_0px_#0A0A0A]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#0A0A0A]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, domain, or vertical..."
              className="w-full bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl pl-9 pr-3.5 py-2 font-mono text-xs font-bold text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none focus:ring-2 focus:ring-[#A1F000]"
            />
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto overflow-x-auto">
            <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> TIER:
            </span>
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] cursor-pointer ${
                tierFilter === 'all' ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]' : 'bg-white text-[#0A0A0A]'
              }`}
            >
              ALL ({leads.length})
            </button>
            <button
              onClick={() => setTierFilter('tier1')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] cursor-pointer ${
                tierFilter === 'tier1' ? 'bg-[#E5F7E5] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]' : 'bg-white text-[#0A0A0A]'
              }`}
            >
              TIER 1 ({tierCounts.tier1})
            </button>
            <button
              onClick={() => setTierFilter('tier2')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] cursor-pointer ${
                tierFilter === 'tier2' ? 'bg-[#FFE3B3] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]' : 'bg-white text-[#0A0A0A]'
              }`}
            >
              TIER 2 ({tierCounts.tier2})
            </button>
            <button
              onClick={() => setTierFilter('tier3')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] cursor-pointer ${
                tierFilter === 'tier3' ? 'bg-[#E4E6FB] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]' : 'bg-white text-[#0A0A0A]'
              }`}
            >
              TIER 3 ({tierCounts.tier3})
            </button>
            <button
              onClick={() => setTierFilter('tier4')}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border-[2px] border-[#0A0A0A] cursor-pointer ${
                tierFilter === 'tier4' ? 'bg-[#FFB6C2] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]' : 'bg-white text-[#0A0A0A]'
              }`}
            >
              DISQUALIFIED ({tierCounts.disqualified})
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <TableShell
          title="Account Intelligence Records"
          countLabel={`${filtered.length} COMPANIES`}
        >
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">REVENUE</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">ICP FIT SCORE</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">COHORT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <p className="font-mono text-sm font-bold text-[#0A0A0A]/70 mb-3">
                      No accounts found matching "{search || tierFilter}".
                    </p>
                    <button
                      onClick={() => { setSearch(''); setTierFilter('all'); }}
                      className="font-mono text-xs font-black bg-[#FFE3B3] border-[2px] border-[#0A0A0A] px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#A1F000] cursor-pointer"
                    >
                      RESET FILTERS
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(({ lead, score }) => {
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/companies/${lead.id}`)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#0A0A0A] text-sm group-hover:text-[#8C6ADE] transition-colors">
                          {lead.companyName}
                        </div>
                        <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                          {lead.domain || 'No website'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                        {lead ? lead.industry : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                        {lead ? formatHeadcount(lead.headcount) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                        {lead ? (lead.annualRevenue || '—') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <span className="text-base font-black text-[#0A0A0A]">
                          {score ? formatScore(score.totalScore) : '—'}
                        </span>
                        {score && <span className="text-[#0A0A0A]/40 text-xs font-bold"> / 100</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusChip
                          color={!score ? 'lavender' : score.totalScore >= 80 ? 'mint' : score.totalScore >= 60 ? 'peach' : 'pink'}
                        >
                          {score?.tier || 'PENDING'}
                        </StatusChip>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/companies/${lead.id}`);
                          }}
                          className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>PROFILE</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>
      </div>
    </AppLayout>
  );
};
