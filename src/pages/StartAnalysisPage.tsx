import React, { useEffect, useState } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { sampleIndustries, selectedSampleKey, suggestedSample, type SampleIndustry } from '../lib/sampleLists';
import { AppLayout } from '../components/layout/AppLayout';
import { EmptyState } from '../components/ui/EmptyState';

export const StartAnalysisPage: React.FC = () => {
  const { navigate } = useRouter();
  const { sellerContext } = useAppStore();
  const [industry, setIndustry] = useState<SampleIndustry>(() => suggestedSample(sellerContext.industry));
  useEffect(() => { setIndustry(suggestedSample(sellerContext.industry)); }, [sellerContext.industry]);

  return <AppLayout>
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      <EmptyState title="Your offering is ready. Add your first list."
        description="Upload your own company list, then run analysis and follow its live progress."
        actionText="UPLOAD MY LIST" onAction={() => navigate('/uploads/new')} />
      <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-6 shadow-[4px_4px_0px_#0A0A0A] space-y-4">
        <h2 className="text-lg font-black">Or try a fictional sample list</h2>
        <p className="text-sm">Choose your industry to preview the workflow with 15 sample contacts. These companies and contacts are fictional.</p>
        <label className="block font-mono text-xs font-black">INDUSTRY
          <select value={industry} onChange={event => setIndustry(event.target.value as SampleIndustry)}
            className="block mt-2 w-full border-[2px] border-[#0A0A0A] rounded-lg p-3 bg-[#F9F8F4]">
            {sampleIndustries.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { sessionStorage.setItem(selectedSampleKey, industry); navigate('/uploads/new'); }}
            className="bg-[#A1F000] border-[2px] border-[#0A0A0A] rounded-lg px-5 py-3 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A] cursor-pointer">
            USE SAMPLE LIST →
          </button>
          <a href={`/samples/${industry}.csv`} download={`figuredit_${industry}_sample.csv`}
            className="bg-white border-[2px] border-[#0A0A0A] rounded-lg px-5 py-3 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">
            DOWNLOAD SAMPLE CSV
          </a>
        </div>
      </div>
    </div>
  </AppLayout>;
};
