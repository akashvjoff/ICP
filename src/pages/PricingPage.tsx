import React from 'react';
import { contactEmail, contactHref } from '../lib/contact';

export const PricingPage: React.FC = () => (
  <main className="min-h-screen bg-[#F9F8F4] px-6 py-16 text-[#0A0A0A]">
    <div className="mx-auto max-w-3xl">
      <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">← FiguredIt</a>
      <div className="rounded-2xl border-[3px] border-[#0A0A0A] bg-white p-8 shadow-[6px_7px_0px_#0A0A0A]">
        <span className="font-mono text-xs font-black">PRICING</span>
        <h1 className="mt-4 text-4xl font-black">Talk to us about your workspace.</h1>
        <p className="mt-4 text-[#0A0A0A]/75">For current pricing and access details, contact the FiguredIt team.</p>
        <a className="mt-8 inline-block rounded-lg border-2 border-black bg-[#A1F000] px-5 py-3 font-mono text-sm font-black hover:bg-[#92dc00]" href={contactHref}>EMAIL {contactEmail}</a>
      </div>
    </div>
  </main>
);
