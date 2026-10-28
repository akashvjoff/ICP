import React from 'react';
import { AppNavbar } from '../components/ui/AppNavbar';

const steps = [
  {
    title: 'Start with the problem you solve',
    body: 'Write down your product, the problem it addresses, and the buyer roles involved. A company is only a promising lead when its situation connects to that offering.',
  },
  {
    title: 'Clean your lead list',
    body: 'Keep one company per domain, even when several contacts work there. Check industry, company size, location, and missing fields before comparing accounts.',
  },
  {
    title: 'Separate evidence from assumptions',
    body: 'A website or uploaded row may support an observation. A need inferred only from your offering is still an assumption. Mark low-data accounts for research instead of treating them as confirmed fits.',
  },
  {
    title: 'Score, then validate',
    body: 'Use the score breakdown to see why an account ranks highly. Compare the resulting segments with replies, meetings, and qualified opportunities. Update your ICP when those outcomes disagree with the initial score.',
  },
];

export const ICPGuidePage: React.FC = () => (
  <div className="min-h-screen bg-[#F9F8F4] text-[#0A0A0A] font-sans">
    <AppNavbar />
    <main>
      <section className="border-b-[3px] border-black px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <span className="inline-block rounded border-2 border-black bg-[#A1F000] px-3 py-1 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">PRACTICAL ICP GUIDE</span>
          <h1 className="mt-7 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">Build an ideal customer profile from your lead list.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed">For B2B founders and sales teams: turn a CSV of companies and contacts into a testable picture of who to pursue and why. AI-assisted analysis helps examine accounts; an explainable, rule-based score helps prioritize them.</p>
          <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs font-black">
            <a href="/demo" className="rounded-lg border-[3px] border-black bg-[#A1F000] px-5 py-3 shadow-[4px_4px_0px_#0A0A0A]">TRY THE SAMPLE PREVIEW →</a>
            <a href="/pricing" className="rounded-lg border-[3px] border-black bg-white px-5 py-3 shadow-[4px_4px_0px_#0A0A0A]">SEE PLAN LIMITS</a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-3xl font-black tracking-tight">A four-step workflow</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {steps.map((step, index) => <article key={step.title} className="rounded-xl border-[3px] border-black bg-white p-6 shadow-[5px_5px_0px_#0A0A0A]">
            <span className="font-mono text-xs font-black text-[#5F3EB5]">0{index + 1} / GUIDE</span>
            <h3 className="mt-3 text-xl font-black">{step.title}</h3>
            <p className="mt-3 leading-relaxed">{step.body}</p>
          </article>)}
        </div>
      </section>
      <section className="border-y-[3px] border-black bg-[#E4E6FB] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight">Worked example: a fictional lead list</h2>
          <p className="mt-4 max-w-3xl leading-relaxed">Suppose you sell workflow software for teams managing manual approvals. Your CSV includes two contacts at Aster Cloud and one at Briar Cloud. Group the Aster contacts under one company domain before analysis. An operations title may suggest a relevant buyer, but it does not prove the company has an approval bottleneck. Look for company-specific evidence and record missing information. Then compare both accounts with actual outreach results.</p>
          <p className="mt-4 max-w-3xl font-mono text-xs font-bold">EXAMPLE DATA IS FICTIONAL. A SCORE IS AN ICP HYPOTHESIS, NOT A SALES GUARANTEE.</p>
          <a href="/samples/saas.csv" download className="mt-6 inline-block font-mono text-sm font-black underline underline-offset-4">DOWNLOAD A FICTIONAL SAMPLE CSV →</a>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-3xl font-black tracking-tight">Try it with your own accounts</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">The public demo is a keyword preview using fictional accounts. Sign in to describe your offering, upload a lead list, and review the full analysis and score breakdown. The Free plan includes one dataset and up to 25 AI-analyzed companies.</p>
        <a href="/auth" className="mt-6 inline-block rounded-lg border-[3px] border-black bg-[#A1F000] px-5 py-3 font-mono text-xs font-black shadow-[4px_4px_0px_#0A0A0A]">START FREE →</a>
      </section>
    </main>
    <footer className="border-t-[3px] border-black px-6 py-8 font-mono text-xs font-bold"><div className="mx-auto flex max-w-6xl flex-wrap gap-5"><a href="/">HOME</a><a href="/demo">DEMO</a><a href="/pricing">PRICING</a><a href="/privacy">PRIVACY</a><a href="/contact">CONTACT</a></div></footer>
  </div>
);
