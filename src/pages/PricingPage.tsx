import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { AppNavbar } from '../components/ui/AppNavbar';
import { useAuth } from '../lib/auth';
import { freshAccessToken } from '../lib/supabase';
import { PLANS, PLAN_COMPARISON_ROWS, type BillingCurrency, type BillingInterval, type Plan } from '../config/plans';

const faqs = [
  { question: 'What can I do on the Free plan?', answer: 'You can store one dataset with up to 25 rows, analyze 25 unique companies, export a companies-only CSV, and view a watermarked report.' },
  { question: 'What happens when I reach a limit?', answer: 'The app stops additional uploads or analysis before exceeding the limit. Choose a larger plan to continue.' },
  { question: 'Can I cancel anytime?', answer: 'Yes. You can cancel anytime and keep access until the end of your paid period.' },
  { question: 'Do you offer refunds?', answer: 'See the refund policy for the annual first-purchase window and other terms.', href: '/refund-policy', link: 'Read the refund policy' },
  { question: 'How do GST and invoices work?', answer: 'GST and invoices are handled by our payment partner.' },
  { question: 'How is my data handled?', answer: 'Your uploaded data stays in your workspace and is processed for AI-assisted analysis as described in our privacy notice.', href: '/privacy', link: 'Read the privacy notice' },
  { question: 'Can I switch plans?', answer: 'Contact us if you need to change your current plan.' },
  { question: 'Do you have a team or enterprise plan?', answer: 'Contact us to discuss a larger workspace or a team workflow.', href: '/contact', link: 'Contact FiguredIt' },
] as const;

function defaultCurrency(): BillingCurrency {
  const indiaLanguage = (navigator.languages?.length ? navigator.languages : [navigator.language])
    .some(language => /-IN$/i.test(language));
  const indiaTimeZone = ['Asia/Kolkata', 'Asia/Calcutta'].includes(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return indiaLanguage || indiaTimeZone ? 'INR' : 'USD';
}

function money(amount: number, currency: BillingCurrency): string {
  return `${currency === 'INR' ? '₹' : '$'}${amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
}

function trackPricingEvent(name: string, metadata: Record<string, string>): void {
  const event = (window as Window & { sa_event?: (name: string, data?: Record<string, string>) => void }).sa_event;
  event?.(name, metadata);
}

const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true';

export function getPlanCta(plan: Plan, user: User | null, currentPlan: string = 'free'): { label: string; action: 'auth' | 'checkout' | 'dashboard' | 'billing' | 'waitlist'; current: boolean } {
  if (user && plan.id === currentPlan) return { label: 'Open dashboard', action: 'dashboard', current: true };
  if (plan.id === 'free') return { label: 'Start free', action: 'auth', current: false };
  if (!billingEnabled) return { label: 'Coming soon: join waitlist', action: 'waitlist', current: false };
  if (user && currentPlan !== 'free') return { label: 'Manage plan', action: 'billing', current: false };
  return user ? { label: 'Choose plan', action: 'checkout', current: false } : { label: 'Sign in to choose', action: 'auth', current: false };
}

export const PricingPage: React.FC = () => {
  const { user } = useAuth();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [currency, setCurrency] = useState<BillingCurrency>(defaultCurrency);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState<Plan | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');

  useEffect(() => {
    if (!user) return;
    void freshAccessToken().then(token => fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` } }))
      .then(response => response.ok ? response.json() : null).then(data => { if (data?.plan) setCurrentPlan(data.plan); })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const nodes = [description, ogTitle, ogDescription, ogUrl, canonical] as const;
    const attributes = ['content', 'content', 'content', 'content', 'href'] as const;
    const previous = nodes.map((node, index) => node?.getAttribute(attributes[index]));
    const values = [
      'Simple pricing for explainable ICP discovery. Start free, then upgrade to Starter or Pro as your pipeline grows.',
      'Pricing | FiguredIt',
      'Start free. Upgrade when your pipeline grows. Compare Free, Starter and Pro plans for AI-assisted ICP analysis.',
      'https://figuredit.in/pricing',
      'https://figuredit.in/pricing',
    ];
    nodes.forEach((node, index) => node?.setAttribute(attributes[index], values[index]));
    return () => nodes.forEach((node, index) => { if (previous[index] != null) node?.setAttribute(attributes[index], previous[index]!); });
  }, []);

  const handlePlanClick = async (plan: Plan) => {
    trackPricingEvent('pricing_cta_click', { plan: plan.id });
    const cta = getPlanCta(plan, user, currentPlan);
    if (cta.action === 'auth') { window.location.assign('/auth'); return; }
    if (cta.action === 'dashboard') { window.location.assign('/dashboard'); return; }
    if (cta.action === 'billing') { window.location.assign('/settings/billing'); return; }
    if (cta.action === 'waitlist') {
      setWaitlistPlan(plan);
      setWaitlistEmail(user?.email || '');
      setMessage('');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const token = await freshAccessToken();
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: plan.id, interval, currency }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || 'Checkout is unavailable right now. Please try again.');
      const checkoutUrl = new URL(result.url);
      if (checkoutUrl.protocol !== 'https:') throw new Error('Checkout returned an invalid link.');
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout is unavailable right now.');
    } finally {
      setSaving(false);
    }
  };

  const joinWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!waitlistPlan) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, plan: waitlistPlan.id, interval, currency }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not add you right now.');
      setMessage(`You're on the ${waitlistPlan.name} waitlist.`);
      setWaitlistPlan(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not add you right now.');
    } finally {
      setSaving(false);
    }
  };

  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
  };

  return <div className="min-h-screen max-w-full overflow-x-clip bg-[#F9F8F4] text-[#0A0A0A] font-sans">
    <AppNavbar />
    <main className="mx-auto max-w-7xl min-w-0 px-4 py-12 sm:px-8 sm:py-16 space-y-20">
      <section aria-labelledby="pricing-title" className="text-center">
        <span className="inline-block rounded border-2 border-black bg-[#A1F000] px-3 py-1 font-mono text-xs font-black">PRICING</span>
        <h1 id="pricing-title" className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Simple pricing. Explainable ICPs.</h1>
        <p className="mt-4 text-lg font-medium">Start free. Upgrade when your pipeline grows.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 font-mono text-xs font-black">
          <div role="group" aria-label="Billing interval" className="inline-flex max-w-full rounded-xl border-2 border-black bg-white p-1 shadow-[2px_2px_0px_#0A0A0A]">
            {(['monthly', 'annual'] as const).map(value => <button key={value} type="button" aria-pressed={interval === value}
              onClick={() => { setInterval(value); trackPricingEvent('pricing_toggle_interval', { interval: value }); }}
              className={`rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${interval === value ? 'bg-[#A1F000]' : 'hover:bg-[#F9F8F4]'}`}>
              {value === 'annual' ? 'ANNUAL · 2 MONTHS FREE' : 'MONTHLY'}
            </button>)}
          </div>
          <div role="group" aria-label="Currency" className="inline-flex rounded-xl border-2 border-black bg-white p-1 shadow-[2px_2px_0px_#0A0A0A]">
            {(['INR', 'USD'] as const).map(value => <button key={value} type="button" aria-pressed={currency === value}
              onClick={() => { setCurrency(value); trackPricingEvent('pricing_toggle_currency', { currency: value }); }}
              className={`rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${currency === value ? 'bg-[#A1F000]' : 'hover:bg-[#F9F8F4]'}`}>
              {value}
            </button>)}
          </div>
        </div>
      </section>

      <section aria-label="Plans" className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map(plan => {
          const cta = getPlanCta(plan, user, currentPlan);
          const price = plan.prices[currency][interval];
          return <article key={plan.id} className={`relative flex min-w-0 flex-col rounded-2xl border-[3px] border-black p-6 shadow-[6px_7px_0px_#0A0A0A] sm:p-7 ${plan.id === 'pro' ? 'order-1 bg-[#E4E6FB] md:order-3' : plan.id === 'free' ? 'order-2 bg-white md:order-1' : 'order-3 bg-white md:order-2'}`}>
            <div className="flex min-h-7 items-start justify-between gap-2">
              <h2 className="font-mono text-base font-black uppercase">{plan.name}</h2>
              {plan.id === 'pro' && <span className="rounded border-2 border-black bg-[#A1F000] px-2 py-1 font-mono text-[10px] font-black">MOST POPULAR</span>}
            </div>
            {cta.current && <span className="mt-2 self-start rounded border border-black bg-[#E5F7E5] px-2 py-1 font-mono text-[10px] font-black">CURRENT PLAN</span>}
            <p className="mt-6 font-black tracking-tight"><span className="text-4xl sm:text-5xl">{money(price, currency)}</span><span className="ml-1 text-sm">/{plan.id === 'free' ? 'mo' : interval === 'annual' ? 'yr' : 'mo'}</span></p>
            <p className="mt-2 min-h-10 text-sm font-medium text-[#0A0A0A]/75">
              {interval === 'annual' && plan.id !== 'free' ? `${money(Math.round(price / 12), currency)}/mo equivalent, billed annually` : plan.id === 'free' ? 'Free to start.' : 'Billed monthly.'}
            </p>
            <p className="mt-4 border-t-2 border-black/20 pt-4 text-sm font-bold">Best for: {plan.bestFor}</p>
            <ul className="my-7 flex-1 space-y-3">{plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-sm font-medium"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 stroke-[3]" /><span>{feature}</span></li>)}</ul>
            <button type="button" onClick={() => void handlePlanClick(plan)} disabled={saving}
              className="min-h-12 rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 text-center font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A] hover:bg-[#92dc00] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black disabled:opacity-60">
              {cta.label.toUpperCase()}
            </button>
          </article>;
        })}
      </section>

      {waitlistPlan && <form onSubmit={joinWaitlist} className="mx-auto max-w-xl rounded-xl border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#0A0A0A]">
        <label htmlFor="waitlist-email" className="block font-mono text-xs font-black">EMAIL FOR THE {waitlistPlan.name.toUpperCase()} WAITLIST</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="waitlist-email" type="email" required autoComplete="email" value={waitlistEmail} onChange={event => setWaitlistEmail(event.target.value)} className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-2" placeholder="you@company.com" />
          <button type="submit" disabled={saving} className="rounded-lg border-2 border-black bg-[#A1F000] px-4 py-2 font-mono text-xs font-black disabled:opacity-60">JOIN WAITLIST</button>
        </div>
      </form>}
      {message && <p role="status" className="mx-auto max-w-xl rounded-lg border-2 border-black bg-white p-3 text-sm font-bold">{message}</p>}

      <section aria-labelledby="comparison-title">
        <span className="font-mono text-xs font-black">COMPARE PLANS</span>
        <h2 id="comparison-title" className="mt-2 text-3xl font-black">See what is included.</h2>
        <div className="mt-6 hidden md:block rounded-2xl border-[3px] border-black bg-white shadow-[5px_5px_0px_#0A0A0A]">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-20 z-10 bg-[#A1F000] font-mono text-xs font-black">
              <tr><th scope="col" className="w-[40%] border-b-2 border-black p-4">FEATURE</th>{PLANS.map(plan => <th key={plan.id} scope="col" className="border-b-2 border-black p-4">{plan.name.toUpperCase()}</th>)}</tr>
            </thead>
            <tbody>{PLAN_COMPARISON_ROWS.map(row => <tr key={row.key} className="border-b border-black/20 last:border-b-0">
              <th scope="row" className="p-4 font-semibold">{row.label}</th>
              {PLANS.map(plan => <td key={plan.id} className="p-4 font-medium">{plan.comparison[row.key]}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="mt-6 space-y-3 md:hidden">{PLANS.map(plan => <details key={plan.id} className="group rounded-xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#0A0A0A]">
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-sm font-black">{plan.name.toUpperCase()}<ChevronDown aria-hidden="true" className="h-4 w-4 group-open:rotate-180" /></summary>
          <dl className="mt-4 space-y-3 border-t border-black/20 pt-4">{PLAN_COMPARISON_ROWS.map(row => <div key={row.key} className="flex items-start justify-between gap-3 text-sm"><dt className="min-w-0 font-medium">{row.label}</dt><dd className="max-w-[52%] text-right font-bold">{plan.comparison[row.key]}</dd></div>)}</dl>
        </details>)}</div>
      </section>

      <section className="grid gap-6 rounded-2xl border-[3px] border-black bg-[#FFE3B3] p-6 shadow-[5px_5px_0px_#0A0A0A] md:grid-cols-[1fr_2fr] sm:p-8">
        <h2 className="text-2xl font-black">What counts as an AI-analyzed company?</h2>
        <p className="text-sm font-medium leading-7">One unique company, identified by domain, counts once when analyzed. Duplicate contacts at that company count once. Re-runs within 30 days are free, and contacts never count toward the AI company limit.</p>
      </section>

      <section aria-labelledby="why-title">
        <span className="font-mono text-xs font-black">WHY FIGUREDIT</span>
        <h2 id="why-title" className="mt-2 text-3xl font-black">Clear reasons to move forward.</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['01', 'Explainable 0–100 score', 'See which evidence contributed to each company score.'],
            ['02', 'Built from your lead list', 'Start with your own companies and the offering you sell.'],
            ['03', 'India-friendly pricing', 'See plans in rupees, with a USD view when useful.'],
          ].map(([number, title, body]) => <div key={number} className="rounded-xl border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#0A0A0A]"><span className="font-mono text-xs font-black">{number}</span><h3 className="mt-3 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6">{body}</p></div>)}
        </div>
      </section>

      <section aria-labelledby="faq-title" className="mx-auto max-w-4xl">
        <span className="font-mono text-xs font-black">GOOD TO KNOW</span>
        <h2 id="faq-title" className="mt-2 text-3xl font-black">Pricing questions, answered.</h2>
        <div className="mt-6 space-y-3">{faqs.map(item => <details key={item.question} className="group rounded-xl border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#0A0A0A]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black sm:text-base">{item.question}<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 group-open:rotate-180" /></summary>
          <p className="mt-3 text-sm leading-6">{item.answer} {'href' in item && <a href={item.href} className="font-bold underline underline-offset-2">{item.link}.</a>}</p>
        </details>)}</div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }} />
      </section>

      <section className="rounded-2xl border-[3px] border-black bg-[#A1F000] p-7 text-center shadow-[6px_6px_0px_#0A0A0A] sm:p-10">
        <h2 className="text-3xl font-black">Find your best customers in 10 minutes</h2>
        <p className="mt-3 text-sm font-medium">Start with a list you already have, or explore sample output first.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void handlePlanClick(PLANS[0])} className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-5 py-3 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">START FREE <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
          <a href="/demo" className="inline-flex items-center rounded-lg border-2 border-black bg-[#E4E6FB] px-5 py-3 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">TRY THE DEMO</a>
        </div>
      </section>
    </main>
    <footer className="mt-16 border-t-[3px] border-black px-4 py-9 font-mono text-xs font-bold sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><span>FiguredIt · Figure out who your best customers are.</span><nav aria-label="Footer" className="flex flex-wrap gap-4"><a href="/pricing" className="underline">PRICING</a><a href="/privacy" className="underline">PRIVACY</a><a href="/terms" className="underline">TERMS</a><a href="/refund-policy" className="underline">REFUNDS</a><a href="/contact" className="underline">CONTACT</a></nav></div>
    </footer>
  </div>;
};
