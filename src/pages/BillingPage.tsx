import React, { useEffect, useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { freshAccessToken } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type BillingStatus = {
  plan: string;
  subscription: { status: string; interval: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  usage: { datasets_count: number; ai_companies_used: number };
  limits: { datasets: number | null; companies: number; rows: number };
};

export function BillingPage() {
  const { isDemoUser } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isDemoUser) return;
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    const returnedFromCheckout = new URLSearchParams(window.location.search).get('status') === 'success';
    const load = async () => {
      try {
        const token = await freshAccessToken();
        const response = await fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Billing status is temporarily unavailable.');
        const data = await response.json() as BillingStatus;
        if (active) {
          setBilling(data);
          if (returnedFromCheckout && data.plan === 'free' && attempts++ < 12) {
            setMessage('Waiting for payment confirmation…');
            timer = window.setTimeout(() => void load(), 5000);
          } else setMessage(returnedFromCheckout && data.plan === 'free' ? 'Payment confirmation is still pending. Refresh this page shortly.' : '');
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load billing.'); }
    };
    void load();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [isDemoUser]);

  const action = async (path: 'portal' | 'cancel') => {
    setBusy(true); setMessage('');
    try {
      const token = await freshAccessToken();
      const response = await fetch(`/api/billing/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Please try again.');
      if (path === 'portal') window.location.assign(body.url);
      else setMessage(body.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const bar = (label: string, count: number, limit: number | null) => <div className="space-y-2">
    <div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{count} / {limit ?? 'Unlimited'}</span></div>
    {limit !== null && <div className="h-3 overflow-hidden rounded-full border-2 border-black bg-white"><div className="h-full bg-[#A1F000]" style={{ width: `${Math.min(100, 100 * count / limit)}%` }} /></div>}
  </div>;
  return <AppLayout><div className="mx-auto max-w-3xl space-y-7">
    <div><p className="font-mono text-xs font-black">YOUR ACCOUNT</p><h1 className="text-4xl font-black">Billing</h1></div>
    <BrutalistCard bg="white" shadowSize="md" className="space-y-5 p-7">
      {isDemoUser ? <p>Sign in to manage a subscription.</p> : !billing ? <p>{message || 'Loading billing…'}</p> : <>
        <div><p className="font-mono text-xs font-black">CURRENT PLAN</p><p className="text-2xl font-black capitalize">{billing.plan}</p></div>
        {billing.subscription && <p className="text-sm">{billing.subscription.cancel_at_period_end ? 'Access until' : 'Renews'} {billing.subscription.current_period_end ? new Date(billing.subscription.current_period_end).toLocaleDateString() : '—'} · {billing.subscription.status.replaceAll('_', ' ')}</p>}
        {bar('Datasets this period', billing.usage.datasets_count, billing.limits.datasets)}
        {bar('AI-analyzed companies this period', billing.usage.ai_companies_used, null)}
        <div className="flex flex-wrap gap-3">
          <a href="/pricing" className="rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 font-mono text-xs font-black">COMPARE PLANS</a>
          {billing.subscription && <BrutalistButton type="button" size="sm" onClick={() => void action('portal')} disabled={busy}>MANAGE SUBSCRIPTION</BrutalistButton>}
          {billing.subscription && !billing.subscription.cancel_at_period_end && <BrutalistButton type="button" size="sm" onClick={() => void action('cancel')} disabled={busy}>CANCEL AT PERIOD END</BrutalistButton>}
        </div>
        {message && <p role="status" className="text-sm font-bold">{message}</p>}
      </>}
    </BrutalistCard>
  </div></AppLayout>;
}
