import React, { useState } from 'react';
import { PLANS, annualPriceInr, approximateUsd, type PaidPlanId } from '../config/plans';

export const PricingPage: React.FC = () => {
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanId | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const joinWaitlist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlan || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: selectedPlan }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      setMessage('You’re on the list. We’ll email you when this plan opens.');
      setEmail('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen bg-[#F9F8F4] px-6 py-16 text-[#0A0A0A]">
    <div className="mx-auto max-w-6xl">
      <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">← FiguredIt</a>
      <span className="block font-mono text-xs font-black">PRICING</span>
      <h1 className="mt-4 text-4xl font-black">Find the right fit for your workspace.</h1>
      <p className="mt-4 text-[#0A0A0A]/75">Start free. Paid plans are coming soon.</p>
      <div className="mt-7 inline-flex rounded-lg border-2 border-black bg-white p-1 font-mono text-xs font-black" aria-label="Billing period">
        <button type="button" onClick={() => setAnnual(false)} className={`rounded px-4 py-2 ${!annual ? 'bg-[#A1F000]' : ''}`}>MONTHLY</button>
        <button type="button" onClick={() => setAnnual(true)} className={`rounded px-4 py-2 ${annual ? 'bg-[#A1F000]' : ''}`}>ANNUAL · 2 MONTHS FREE</button>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const priceInr = annual ? annualPriceInr(plan.monthlyPriceInr) : plan.monthlyPriceInr;
          return <article key={plan.id} className="flex flex-col rounded-2xl border-[3px] border-black bg-white p-7 shadow-[6px_7px_0px_#0A0A0A]">
            <h2 className="font-mono text-sm font-black uppercase">{plan.name}</h2>
            <p className="mt-5 text-4xl font-black">₹{priceInr.toLocaleString('en-IN')}<span className="text-sm">/{annual ? 'yr' : 'mo'}</span></p>
            <p className="mt-1 text-sm text-[#0A0A0A]/65">≈ ${approximateUsd(priceInr).toLocaleString('en-US')} USD/{annual ? 'yr' : 'mo'}</p>
            <ul className="my-8 flex-1 space-y-3 text-sm font-medium">{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul>
            {plan.id === 'free'
              ? <a href="/auth" className="rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 text-center font-mono text-xs font-black hover:bg-[#92dc00]">START FREE</a>
              : <button type="button" onClick={() => { setSelectedPlan(plan.id as PaidPlanId); setMessage(''); }} className="rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 font-mono text-xs font-black hover:bg-[#92dc00]">Coming soon: join waitlist</button>}
          </article>;
        })}
      </div>
      <p className="mt-5 text-xs text-[#0A0A0A]/65">USD figures are approximate. Paid plans are not available for purchase yet.</p>
      {selectedPlan && <form onSubmit={joinWaitlist} className="mt-8 max-w-xl rounded-2xl border-[3px] border-black bg-[#E4E6FB] p-6 shadow-[5px_5px_0px_#0A0A0A]">
        <h2 className="text-xl font-black">Join the {selectedPlan === 'starter' ? 'Starter' : 'Pro'} waitlist</h2>
        <label htmlFor="waitlist-email" className="mt-4 block font-mono text-xs font-black">WORK EMAIL</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="waitlist-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-4 py-3" />
          <button disabled={saving} className="rounded-lg border-2 border-black bg-[#A1F000] px-5 py-3 font-mono text-xs font-black disabled:opacity-50">{saving ? 'JOINING...' : 'JOIN WAITLIST'}</button>
        </div>
        {message && <p role="status" className="mt-3 text-sm font-bold">{message}</p>}
      </form>}
    </div>
  </main>;
};
