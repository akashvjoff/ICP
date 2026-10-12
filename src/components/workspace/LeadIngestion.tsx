import React, { useState, useRef } from 'react';
import { NormalizedLead } from '../../types/lead';
import { parseCSVString, normalizeRawLead } from '../../lib/parser';
import { SAMPLE_LEADS } from '../../lib/mockData';
import { formatHeadcount } from '../../lib/formatters';
import { SectionHeading } from '../ui/SectionHeading';
import { BrutalistCard } from '../ui/BrutalistCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { TableShell } from '../ui/TableShell';
import { StatusChip } from '../ui/StatusChip';
import { EmptyState } from '../ui/EmptyState';
import { Upload, FileText, Sparkles, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LeadIngestionProps {
  leads: NormalizedLead[];
  onUpdateLeads: (leads: NormalizedLead[]) => void;
  onNextStep: () => void;
  onInspectLead: (lead: NormalizedLead) => void;
}

export const LeadIngestion: React.FC<LeadIngestionProps> = ({
  leads,
  onUpdateLeads,
  onNextStep,
  onInspectLead,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const text = await file.text();
    const result = await parseCSVString(text);

    if (result.rawRows.length > 0) {
      const normalized = result.rawRows.map((row, idx) => 
        normalizeRawLead(row, result.detectedMapping, idx)
      );
      onUpdateLeads(normalized);
    }
    setIsUploading(false);
  };

  const handleProcessPaste = async () => {
    if (!pasteContent.trim()) return;
    setIsUploading(true);
    const result = await parseCSVString(pasteContent);
    if (result.rawRows.length > 0) {
      const normalized = result.rawRows.map((row, idx) => 
        normalizeRawLead(row, result.detectedMapping, idx)
      );
      onUpdateLeads(normalized);
      setShowPasteModal(false);
      setPasteContent('');
    }
    setIsUploading(false);
  };

  const handleLoadSample = () => {
    onUpdateLeads(SAMPLE_LEADS);
  };

  const handleClearLeads = () => {
    onUpdateLeads([]);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
        <SectionHeading
          eyebrow="STEP 02 OF 05 // INGESTION"
          eyebrowColor="bg-[#E4E6FB]"
          title="Lead List Ingestion & Data Hygiene"
          description="Upload raw CSV exports. The parser trims domains, normalizes headcount, and enforces data hygiene before classification."
          className="mb-0"
        />

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          {leads.length > 0 && (
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={handleClearLeads}
              icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
            >
              CLEAR LEADS
            </BrutalistButton>
          )}

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={onNextStep}
            disabled={leads.length === 0}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            RUN STRATEGIC ANALYSIS
          </BrutalistButton>
        </div>
      </div>

      {/* Upload Zone & Quick Sample Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CSV Drop Card */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="md:col-span-2 bg-white border-[3px] border-dashed border-[#0A0A0A] hover:border-[#8C6ADE] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 shadow-[4px_5px_0px_#0A0A0A] hover:-translate-y-0.5 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />
          <div className="w-14 h-14 rounded-full bg-[#A1F000] border-[2px] border-[#0A0A0A] flex items-center justify-center text-[#0A0A0A] mb-4 shadow-[2px_2px_0px_#0A0A0A] group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-black text-[#0A0A0A] mb-1">
            Drop your company leads CSV here
          </h3>
          <p className="text-xs text-[#0A0A0A]/70 max-w-sm mb-4 font-medium">
            Compatible with Apollo, ZoomInfo, LinkedIn Sales Nav, and custom CSV exports.
          </p>
          <span className="font-mono text-xs font-bold text-[#8C6ADE] underline underline-offset-4">
            Click to browse file
          </span>
        </div>

        {/* Quick Sample Box */}
        <BrutalistCard bg="lavender" shadowSize="md" className="p-6 flex flex-col justify-between">
          <div>
            <span className="font-mono text-[10px] font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#0A0A0A] inline-block mb-2">
              ZERO SETUP PREVIEW
            </span>
            <h3 className="text-base font-black text-[#0A0A0A] mb-2">
              Instant B2B Dataset
            </h3>
            <p className="text-xs text-[#0A0A0A]/80 leading-relaxed font-medium mb-4">
              Explore the entire 4-stage pipeline with 5 calibrated enterprise leads (Finnova, Loomis Health, Velociraptor, Kestrel, Beacon).
            </p>
          </div>

          <div className="space-y-2.5">
            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={handleLoadSample}
              icon={<Sparkles className="w-3.5 h-3.5" />}
              className="w-full"
            >
              LOAD 5 SAMPLE LEADS
            </BrutalistButton>

            <button
              onClick={() => setShowPasteModal(true)}
              className="w-full font-mono text-xs font-bold text-[#0A0A0A] hover:underline flex items-center justify-center gap-1.5 py-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PASTE CSV TEXT</span>
            </button>
          </div>
        </BrutalistCard>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <BrutalistCard bg="white" shadowSize="lg" className="max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b-[2px] border-[#0A0A0A] pb-3">
              <h3 className="text-base font-black text-[#0A0A0A]">PASTE RAW CSV TEXT</h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="font-mono text-xs font-bold text-[#0A0A0A]/60 hover:text-[#0A0A0A]"
              >
                [ESC] CLOSE
              </button>
            </div>
            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Company Name,Domain,Industry,Headcount,Revenue,Description&#10;Acme Inc,acme.com,B2B SaaS,250,$30M,Cloud infrastructure platform"
              className="w-full bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl p-3 text-xs font-mono text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#A1F000]"
            />
            <div className="flex justify-end gap-3 pt-2">
              <BrutalistButton
                variant="white"
                size="sm"
                onClick={() => setShowPasteModal(false)}
              >
                CANCEL
              </BrutalistButton>
              <BrutalistButton
                variant="lime"
                size="sm"
                onClick={handleProcessPaste}
                disabled={isUploading || !pasteContent.trim()}
              >
                PROCESS ROWS
              </BrutalistButton>
            </div>
          </BrutalistCard>
        </div>
      )}

      {/* Leads Table */}
      {leads.length > 0 ? (
        <TableShell
          title="Ingested Account Records"
          countLabel={`${leads.length} ACCOUNTS READY`}
          actions={
            <StatusChip color="mint">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
              HYGIENE PASSED
            </StatusChip>
          }
        >
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A]">
                <th className="py-3 px-4 font-black tracking-wider uppercase">COMPANY</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">VERTICAL</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">HEADCOUNT</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-right">REVENUE</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase">TECH STACK</th>
                <th className="py-3 px-4 font-black tracking-wider uppercase text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-[#0A0A0A]/15 font-sans font-medium">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-[#FFE3B3]/20 transition-colors cursor-pointer group"
                  onClick={() => onInspectLead(lead)}
                >
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-[#0A0A0A] text-sm group-hover:text-[#8C6ADE] transition-colors">
                      {lead.companyName}
                    </div>
                    <div className="font-mono text-[11px] text-[#0A0A0A]/60 font-bold">
                      {lead.domain}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#0A0A0A]/85 font-semibold">
                    {lead.industry}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                    {formatHeadcount(lead.headcount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#0A0A0A]">
                    {lead.annualRevenue || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-[#0A0A0A]/70 font-mono text-[11px] max-w-xs truncate">
                    {lead.technologies.length > 0 ? lead.technologies.slice(0, 3).join(', ') : 'Not detected'}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectLead(lead);
                      }}
                      className="font-mono text-xs font-black text-[#0A0A0A] bg-[#FFE3B3] border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md shadow-[1.5px_1.5px_0px_#0A0A0A] hover:bg-[#A1F000] transition-colors cursor-pointer"
                    >
                      AUDIT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : (
        <EmptyState
          title="No Leads Loaded Yet"
          description="Upload your target lead list CSV above, or click 'Load 5 Sample Leads' to test the strategic pipeline instantly."
          actionText="LOAD SAMPLE LEADS"
          onAction={handleLoadSample}
        />
      )}
    </div>
  );
};
