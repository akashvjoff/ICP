import React from 'react';
import { AppNavbar } from '../components/ui/AppNavbar';
import { ArrowRight, Mail, Phone, MessageCircle, Instagram } from 'lucide-react';
import { contactEmail, contactHref } from '../lib/contact';

const questions = [
  {
    question: 'What does FiguredIt do?',
    answer: 'FiguredIt helps you describe your offering, examine potential customer accounts, and build an ideal customer profile (ICP) hypothesis. It connects customer fit, segments, and go-to-market ideas in one workspace.',
  },
  {
    question: 'Who is it for?',
    answer: 'It is built for founders, sales teams, and marketers who need a clearer view of which business customers to pursue and why.',
  },
  {
    question: 'Can I explore it before creating an account?',
    answer: 'Yes. The homepage shows an illustrative score breakdown, and the public demo lets you try a keyword preview with fictional accounts. Your own results depend on the offering and accounts you provide.',
  },
  {
    question: 'Can I use my own lead list?',
    answer: 'Yes. In a signed-in workspace, you can upload a CSV of companies and review the resulting analyses and reports.',
  },
  {
    question: 'How are customer fit scores calculated?',
    answer: 'A fixed scoring model evaluates need urgency, capability match, stakeholder feasibility, and firmographic alignment. The score breakdown shows where points came from and where information is missing.',
  },
  {
    question: 'Does a high score guarantee a sale?',
    answer: 'No. An initial score is an ICP hypothesis. Validate it with real outreach, deal outcomes, and retention data before treating a segment as proven.',
  },
  {
    question: 'How is my information handled?',
    answer: 'Your signed-in workspace stores the offering and company information you add. AI-assisted analysis uses relevant details to generate findings. Read the privacy notice for how data is handled.',
  },
];

export const AboutPage: React.FC = () => (
  <div className="min-h-screen max-w-full overflow-x-clip bg-[#F9F8F4] text-[#0A0A0A] font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
    <AppNavbar />
    <main>
      <section className="border-b-[3px] border-[#0A0A0A] bg-[linear-gradient(45deg,#E4E6FB_25%,transparent_25%),linear-gradient(-45deg,#E4E6FB_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E4E6FB_75%),linear-gradient(-45deg,transparent_75%,#E4E6FB_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0] px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <span className="inline-block rotate-[-2deg] rounded-md border-2 border-black bg-[#A1F000] px-3 py-1 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">ABOUT FIGUREDIT</span>
          <h1 className="mt-8 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Figure out who your best customers are.</h1>
          <p className="mt-6 max-w-2xl border-l-4 border-[#8C6ADE] pl-5 text-lg leading-relaxed sm:text-xl">AI-assisted analysis with an explainable, rule-based score. FiguredIt helps turn a lead list into a clearer plan for finding the right customers.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="/demo" className="inline-flex items-center gap-2 rounded-lg border-[3px] border-black bg-[#A1F000] px-5 py-3 font-mono text-xs font-black shadow-[4px_4px_0px_#0A0A0A] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#0A0A0A]">EXPLORE DEMO <ArrowRight size={16} aria-hidden="true" /></a>
            <a href="/auth?tab=signup" className="inline-flex items-center gap-2 rounded-lg border-[3px] border-black bg-white px-5 py-3 font-mono text-xs font-black shadow-[4px_4px_0px_#0A0A0A] hover:bg-[#E4E6FB]">FIND MY IDEAL CUSTOMERS</a>
          </div>
        </div>
      </section>

      <section className="border-b-[3px] border-[#0A0A0A] px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="font-mono text-xs font-black tracking-wider text-[#5F3EB5]">THE IDEA</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clearer path from leads to learning.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border-[3px] border-black bg-[#FFE3B3] p-5 shadow-[4px_4px_0px_#0A0A0A]"><span className="font-mono text-xs font-black">01 / DEFINE</span><h3 className="mt-3 text-xl font-black">Describe your offering</h3><p className="mt-2 text-sm leading-relaxed">Start with the problem you solve and the customers you think need it.</p></article>
            <article className="rounded-xl border-[3px] border-black bg-[#E4E6FB] p-5 shadow-[4px_4px_0px_#0A0A0A]"><span className="font-mono text-xs font-black">02 / EXPLORE</span><h3 className="mt-3 text-xl font-black">Examine accounts</h3><p className="mt-2 text-sm leading-relaxed">Bring your lead list and inspect each company against your offering.</p></article>
            <article className="rounded-xl border-[3px] border-black bg-[#E5F7E5] p-5 shadow-[4px_4px_0px_#0A0A0A]"><span className="font-mono text-xs font-black">03 / EXPLAIN</span><h3 className="mt-3 text-xl font-black">See the reasoning</h3><p className="mt-2 text-sm leading-relaxed">Review score components, gaps, segments, and strategic analysis.</p></article>
            <article className="rounded-xl border-[3px] border-black bg-[#FFB6C2] p-5 shadow-[4px_4px_0px_#0A0A0A]"><span className="font-mono text-xs font-black">04 / VALIDATE</span><h3 className="mt-3 text-xl font-black">Test the hypothesis</h3><p className="mt-2 text-sm leading-relaxed">Use actual sales outcomes to learn which customer groups convert.</p></article>
          </div>
        </div>
      </section>

      <section id="questions" className="scroll-mt-24 border-b-[3px] border-[#0A0A0A] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <span className="font-mono text-xs font-black tracking-wider text-[#5F3EB5]">Q&A</span>
          <h2 className="mt-3 mb-8 text-3xl font-black tracking-tight sm:text-4xl">Questions people ask.</h2>
          <div className="space-y-3">
            {questions.map(({ question, answer }) => (
              <details key={question} className="group rounded-xl border-[2.5px] border-black bg-white px-5 py-4 shadow-[3px_3px_0px_#0A0A0A] open:bg-[#E4E6FB]">
                <summary className="cursor-pointer pr-5 font-bold marker:text-[#5F3EB5]">{question}</summary>
                <p className="mt-3 border-t border-black/20 pt-3 text-sm leading-relaxed">{answer} {question === 'How is my information handled?' && <a href="/privacy" className="font-bold underline">Privacy notice</a>}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-2xl border-[3px] border-black bg-[#A1F000] p-6 shadow-[6px_6px_0px_#0A0A0A] sm:p-9 md:grid-cols-2">
          <div>
            <span className="font-mono text-xs font-black tracking-wider">GET IN TOUCH</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Questions about FiguredIt?</h2>
            <p className="mt-3 text-sm leading-relaxed">FiguredIt is built by Akash V. Reach out about the app, your account, or your data.</p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <a className="inline-flex items-center gap-3 break-all rounded-lg border-2 border-black bg-white p-3 font-mono text-sm font-bold hover:bg-[#E4E6FB]" href={contactHref}><Mail size={18} className="shrink-0" aria-hidden="true" />{contactEmail}</a>
            <a className="inline-flex items-center gap-3 rounded-lg border-2 border-black bg-white p-3 font-mono text-sm font-bold hover:bg-[#E4E6FB]" href="tel:+918778068507"><Phone size={18} className="shrink-0" aria-hidden="true" />+91 87780 68507</a>
            <a className="inline-flex items-center gap-3 rounded-lg border-2 border-black bg-white p-3 font-mono text-sm font-bold hover:bg-[#E4E6FB]" href="https://wa.me/918778068507" target="_blank" rel="noopener noreferrer"><MessageCircle size={18} className="shrink-0" aria-hidden="true" />WHATSAPP</a>
            <a className="inline-flex items-center gap-3 rounded-lg border-2 border-black bg-white p-3 font-mono text-sm font-bold hover:bg-[#E4E6FB]" href="https://www.instagram.com/akash_vijaychandran" target="_blank" rel="noopener noreferrer"><Instagram size={18} className="shrink-0" aria-hidden="true" />INSTAGRAM</a>
          </div>
        </div>
      </section>
    </main>
    <footer className="border-t-[3px] border-black px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 font-mono text-xs font-bold">
        <a href="/" className="text-lg font-black tracking-tight">Figured<span className="text-[#5F3EB5]">It</span></a>
        <div className="flex flex-wrap gap-4"><a className="underline" href="/demo">DEMO</a><a className="underline" href="/pricing">PRICING</a><a className="underline" href="/terms">TERMS</a><a className="underline" href="/privacy">PRIVACY</a><a className="underline" href="/refund-policy">REFUNDS</a><a className="underline" href="/contact">CONTACT</a></div>
      </div>
    </footer>
  </div>
);
