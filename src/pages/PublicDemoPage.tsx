import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Link2, Sparkles } from 'lucide-react';

type DemoLead = { name: string; industry: string; headcount: number; problem: string; context: string };

const leads: DemoLead[] = [
  { name: 'Harbor Health', industry: 'Healthcare', headcount: 420, problem: 'Patient intake and scheduling are slowed by manual approvals and disconnected records.', context: 'A regional care network expanding to new clinics.' },
  { name: 'Atlas Freight', industry: 'Logistics', headcount: 190, problem: 'Dispatchers reconcile shipment updates in spreadsheets, delaying exception alerts and deliveries.', context: 'A growing freight operator with multiple depots.' },
  { name: 'Northstar Retail', industry: 'Retail', headcount: 650, problem: 'Inventory forecasts miss demand swings, creating stockouts and costly overstock.', context: 'An omnichannel retailer adding new stores.' },
  { name: 'Meridian Labs', industry: 'Technology', headcount: 85, problem: 'Data pipeline changes break dashboards and delay reporting for customer teams.', context: 'A software company with a lean analytics team.' },
  { name: 'Cedar Works', industry: 'Manufacturing', headcount: 310, problem: 'Quality checks and compliance evidence are tracked manually across production sites.', context: 'A manufacturer expanding its supplier network.' },
];

const presets = [
  { label: 'Workflow automation', product: 'Workflow automation', problem: 'manual approvals spreadsheets scheduling', industry: '' },
  { label: 'Inventory planning', product: 'Inventory planning', problem: 'inventory forecasts stockouts overstock', industry: 'Retail' },
  { label: 'Data reliability', product: 'Data reliability', problem: 'data pipeline dashboards reporting', industry: 'Technology' },
];

const stopwords = new Set(['a', 'an', 'and', 'are', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'your', 'their', 'from', 'is']);
const words = (value: string) => [...new Set(value.toLowerCase().match(/[a-z]{3,}/g)?.filter(word => !stopwords.has(word)) || [])];
const sharedIndex = (value: string | null, length: number) => value !== null && /^\d+$/.test(value) && Number(value) < length ? Number(value) : 0;

export const PublicDemoPage: React.FC = () => {
  const sharedParams = new URLSearchParams(window.location.search);
  const initialPreset = presets[sharedIndex(sharedParams.get('example'), presets.length)];
  const [product, setProduct] = useState(initialPreset.product);
  const [problem, setProblem] = useState(initialPreset.problem);
  const [industry, setIndustry] = useState(initialPreset.industry);
  const [selected, setSelected] = useState(sharedIndex(sharedParams.get('account'), leads.length));
  const [shareUrl, setShareUrl] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const sharePreview = async () => {
    const url = new URL('/demo', window.location.origin);
    const example = presets.findIndex(preset => preset.product === product && preset.problem === problem && preset.industry === industry);
    if (example >= 0) url.searchParams.set('example', String(example));
    url.searchParams.set('account', String(selected));
    setShareUrl(url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus(example >= 0 ? 'Sample preview link copied.' : 'Sample account link copied. Your custom text stays private.');
    } catch {
      setShareStatus('Select and copy the sample link below. Your custom text stays private.');
    }
  };
  const evaluated = useMemo(() => leads.map(lead => {
    const terms = words(problem);
    const accountWords = words(`${lead.problem} ${lead.context}`);
    const matches = terms.filter(term => accountWords.includes(term));
    const industryMatch = Boolean(industry && industry.toLowerCase() === lead.industry.toLowerCase());
    return { lead, matches, industryMatch, signal: matches.length + (industryMatch ? 1 : 0) };
  }), [problem, industry]);
  const active = evaluated[selected];

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-[#F9F8F4] text-[#0A0A0A]">
      <header className="border-b-[3px] border-black px-6 py-5">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="font-black text-2xl tracking-tighter" aria-label="FiguredIt home">Figured<span className="text-[#8C6ADE]">It</span></a>
          <nav className="flex flex-wrap items-center gap-4 font-mono text-xs font-bold"><a href="/" className="hover:underline">HOME</a><a href="/auth" className="hover:underline">SIGN IN</a></nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        <a href="/" className="inline-flex items-center gap-2 font-mono text-xs font-bold hover:underline"><ArrowLeft size={15} /> BACK HOME</a>
        <div className="mt-7 max-w-3xl">
          <span className="rounded border-2 border-black bg-[#A1F000] px-2 py-1 font-mono text-xs font-black">KEYWORD PREVIEW · NO ACCOUNT NEEDED</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-black leading-tight tracking-tight">Try your product against five sample accounts.</h1>
          <p className="mt-4 text-base text-black/75">Choose an example or describe what you sell. This keyword preview matches words in fictional accounts; sign in for full analysis of your own leads.</p>
        </div>
        <section aria-labelledby="product-heading" className="mt-10 rounded-2xl border-[3px] border-black bg-white p-5 sm:p-7 shadow-[5px_6px_0px_#0A0A0A]">
          <h2 id="product-heading" className="text-xl font-black">What do you sell?</h2>
          <div className="mt-4 flex flex-wrap gap-2">{presets.map(preset => <button key={preset.label} type="button" onClick={() => { setProduct(preset.product); setProblem(preset.problem); setIndustry(preset.industry); }} className="rounded-lg border-2 border-black bg-[#E4E6FB] px-3 py-2 text-xs font-bold hover:bg-[#A1F000]">{preset.label}</button>)}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block text-xs font-bold">PRODUCT NAME<input value={product} onChange={e => setProduct(e.target.value)} maxLength={80} className="mt-2 w-full rounded-lg border-2 border-black p-3 text-sm font-normal" placeholder="Your product" /></label>
            <label className="block text-xs font-bold">PROBLEM YOU SOLVE<input value={problem} onChange={e => setProblem(e.target.value)} maxLength={240} className="mt-2 w-full rounded-lg border-2 border-black p-3 text-sm font-normal" placeholder="e.g. inventory stockouts" /></label>
            <label className="block text-xs font-bold">TARGET INDUSTRY (OPTIONAL)<select value={industry} onChange={e => setIndustry(e.target.value)} className="mt-2 w-full rounded-lg border-2 border-black p-3 text-sm font-normal"><option value="">Any industry</option>{leads.map(lead => <option key={lead.industry} value={lead.industry}>{lead.industry}</option>)}</select></label>
          </div>
          <p className="mt-4 text-xs text-black/65">The preview compares your problem words with account descriptions and checks your industry choice. It is an illustrative hypothesis, not a verified ICP score or buying intent.</p>
        </section>
        <section aria-labelledby="accounts-heading" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="accounts-heading" className="text-2xl font-black">Five sample B2B accounts</h2><span className="font-mono text-xs font-bold">FICTIONAL DATA · CLIENT SIDE</span></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="space-y-3">{evaluated.map((item, index) => <button key={item.lead.name} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index} className={`w-full rounded-xl border-[2.5px] border-black p-4 text-left shadow-[3px_4px_0px_#0A0A0A] ${selected === index ? 'bg-[#A1F000]' : 'bg-white hover:bg-[#E4E6FB]'}`}><span className="block font-black">{item.lead.name}</span><span className="mt-1 block text-xs">{item.lead.industry} · {item.lead.headcount} employees</span><span className="mt-2 block font-mono text-xs font-bold">{item.signal > 0 ? `${item.signal} matching signal${item.signal === 1 ? '' : 's'}` : 'No matching signals in sample data'}</span></button>)}</div>
            <article className="min-w-0 rounded-xl border-[3px] border-black bg-white p-5 sm:p-7 shadow-[5px_6px_0px_#0A0A0A]">
              <span className="font-mono text-xs font-bold text-black/60">ACCOUNT PREVIEW</span><h3 className="mt-2 text-3xl font-black">{active.lead.name}</h3>
              <p className="mt-3 text-sm text-black/75">{active.lead.context}</p><p className="mt-4 rounded-lg bg-[#F9F8F4] p-4 text-sm"><strong>Observed in this sample:</strong> {active.lead.problem}</p>
              <h4 className="mt-6 font-black">Fit signals for {product.trim() || 'your product'}</h4>
              <ul className="mt-3 space-y-2 text-sm"><li>Industry: {active.industryMatch ? 'Matches your target' : industry ? `Outside ${industry}` : 'No industry restriction selected'}</li><li>Problem overlap: {active.matches.length ? active.matches.join(', ') : 'No shared terms found'}</li><li>Buying intent: Unknown</li></ul>
              <p className="mt-5 text-xs text-black/60">This preview uses only the words shown here. A real analysis needs your product details and lead evidence.</p>
            </article>
          </div>
        </section>
        <div className="mt-12 rounded-xl border-[3px] border-black bg-[#E4E6FB] p-6 sm:p-8"><Sparkles size={25} aria-hidden="true" /><h2 className="mt-3 text-2xl font-black">Ready for the full analysis?</h2><p className="mt-2 text-sm">Create a free account to save your offering, upload a lead list, and run AI-assisted analysis with an explainable score.</p><div className="mt-5 flex flex-wrap gap-3"><a href="/auth?tab=signup" className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-[#A1F000] px-5 py-3 font-mono text-sm font-bold hover:bg-[#92dc00]">START FREE ANALYSIS <ArrowRight size={16} /></a><button type="button" onClick={sharePreview} className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-5 py-3 font-mono text-sm font-bold hover:bg-[#F9F8F4]"><Link2 size={16} /> SHARE SAMPLE PREVIEW</button></div>{shareStatus && <p role="status" className="mt-4 text-sm font-bold">{shareStatus}</p>}{shareUrl && <input aria-label="Sample preview link" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-lg border-2 border-black bg-white p-2 text-xs" />}</div>
      </main>
    </div>
  );
};
