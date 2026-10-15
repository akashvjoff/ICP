import React from 'react';
import { contactEmail, contactHref } from '../lib/contact';

export const TermsPage: React.FC = () => (
  <main className="min-h-screen bg-[#F9F8F4] px-6 py-10 text-[#0A0A0A]">
    <div className="mx-auto max-w-3xl">
      <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">← FiguredIt</a>
      <h1 className="mb-2 text-4xl font-black">Terms of use</h1>
      <p className="mb-8 font-mono text-sm text-slate-600">Last updated October 15, 2026</p>
      <div className="space-y-7 leading-relaxed">
        <section>
          <h2 className="mb-2 text-xl font-bold">Using FiguredIt</h2>
          <p>Use FiguredIt only with information you have the right to upload and analyze. Do not use the service to break the law, infringe someone else’s rights, send spam, or interfere with the service. You are responsible for reviewing your inputs and the decisions you make using the results.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Analysis and scores</h2>
          <p>FiguredIt uses AI-assisted analysis and an explainable, rule-based score to help you explore potential customers. The findings are hypotheses and do not guarantee sales, revenue, or any other outcome.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Your account and data</h2>
          <p>You own the data you upload. You give FiguredIt permission to process it only to provide the service; we do not sell or resell your uploaded data. Keep your sign-in details secure. Our <a href="/privacy" className="underline">privacy notice</a> explains how account information and uploaded data are handled.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Payments and cancellation</h2>
          <p>Paid plans are coming soon. When available, their cancellation and refund terms will follow our <a href="/refund-policy" className="underline">refund policy</a>.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Availability and liability</h2>
          <p>We work to keep FiguredIt available, but cannot promise uninterrupted service or error-free analysis. To the extent permitted by applicable law, FiguredIt is not liable for indirect or consequential losses, including lost revenue or opportunities. Our total liability for a claim is limited to the amount you paid us for the service in the 12 months before that claim. This does not limit rights that cannot legally be limited.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Governing law</h2>
          <p>These terms are governed by the laws of India. Courts in Gurugram, Haryana will have jurisdiction, subject to applicable consumer rights.</p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Questions</h2>
          <p>Contact <a href={contactHref} className="underline">{contactEmail}</a> with questions about these terms or the service.</p>
        </section>
      </div>
    </div>
  </main>
);
