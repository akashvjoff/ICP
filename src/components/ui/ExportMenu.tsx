import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { freshAccessToken } from '../../lib/supabase';
import { useAppStore } from '../../lib/store';

type ExportFilters = {
  search?: string;
  tier?: string;
  coverage?: string;
  sort?: string;
  segmentId?: string;
  analyzedOnly?: string;
  limit?: number;
};

export const ExportMenu: React.FC<{ datasetId?: string; filters?: ExportFilters }> = ({ datasetId, filters }) => {
  const { isDemoMode } = useAppStore();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('export') === 'tier1_contacts');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'companies' | 'contacts'>('companies');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [preset, setPreset] = useState<'current' | 'tier1_contacts' | 'all_analyzed'>(() =>
    new URLSearchParams(window.location.search).get('export') === 'tier1_contacts' ? 'tier1_contacts' : 'current');

  const download = async () => {
    if (!datasetId || isDemoMode) {
      setError('Sign in to export your dataset.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = await freshAccessToken();
      const options = new URLSearchParams({ mode: preset === 'tier1_contacts' ? 'contacts' : mode, format });
      const activeFilters = preset === 'current' ? filters : { segmentId: filters?.segmentId };
      Object.entries(activeFilters || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== '') options.set(key, String(value));
      });
      if (preset !== 'current') options.set('preset', preset);
      const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/export?${options}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Export failed. Please try again.');
      }
      const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `figuredit_export.${format}`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} disabled={!datasetId}
        className="inline-flex items-center gap-1.5 bg-white border-[2px] border-[#0A0A0A] rounded-lg px-3 py-1.5 font-mono text-xs font-black shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#A1F000] disabled:opacity-50 cursor-pointer">
        <Download className="w-3.5 h-3.5" /> EXPORT
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 bg-white border-[2px] border-[#0A0A0A] rounded-xl p-3 shadow-[4px_4px_0px_#0A0A0A] font-mono text-xs space-y-2">
          <label className="block font-black">PRESET
            <select value={preset} onChange={event => setPreset(event.target.value as typeof preset)} className="mt-1 w-full border border-[#0A0A0A] rounded p-1.5 bg-[#F9F8F4]">
              <option value="current">Current filtered view</option>
              <option value="tier1_contacts">Tier 1 contacts</option>
              <option value="all_analyzed">All analyzed</option>
            </select>
          </label>
          {preset !== 'tier1_contacts' && <label className="block font-black">ROWS
            <select value={mode} onChange={event => setMode(event.target.value as typeof mode)} className="mt-1 w-full border border-[#0A0A0A] rounded p-1.5 bg-[#F9F8F4]">
              <option value="companies">Companies</option>
              <option value="contacts">Contacts</option>
            </select>
          </label>}
          <label className="block font-black">FORMAT
            <select value={format} onChange={event => setFormat(event.target.value as typeof format)} className="mt-1 w-full border border-[#0A0A0A] rounded p-1.5 bg-[#F9F8F4]">
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
          {error && <p role="alert" className="text-rose-800 font-bold">{error}</p>}
          <button type="button" disabled={busy} onClick={download} className="w-full bg-[#A1F000] border-[2px] border-[#0A0A0A] rounded-lg p-2 font-black cursor-pointer disabled:opacity-50">
            {busy ? 'PREPARING…' : 'DOWNLOAD'}
          </button>
        </div>
      )}
    </div>
  );
};
