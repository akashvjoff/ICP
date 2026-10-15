import React from 'react';
import { contactEmail, contactHref } from '../lib/contact';

export const RefundPolicyPage: React.FC = () => <main className="min-h-screen bg-[#F9F8F4] px-6 py-10 text-[#0A0A0A]">
  <div className="mx-auto max-w-3xl">
    <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">← FiguredIt</a>
    <h1 className="mb-2 text-4xl font-black">Refund policy</h1>
    <p className="mb-8 font-mono text-sm text-slate-600">Last updated October 15, 2026</p>
    <div className="space-y-7 leading-relaxed">
      <section><h2 className="mb-2 text-xl font-bold">Cancel anytime</h2><p>Paid plans are coming soon. Once subscriptions launch, you may cancel at any time. Your paid access continues until the end of the current billing period, and your plan will not renew.</p></section>
      <section><h2 className="mb-2 text-xl font-bold">Refunds</h2><p>We do not offer partial refunds for unused time in a billing period. For your first annual purchase, request a full refund within 7 days of purchase. This does not limit rights available under applicable law.</p></section>
      <section><h2 className="mb-2 text-xl font-bold">Contact</h2><p>For cancellation or refund help, email <a href={contactHref} className="underline">{contactEmail}</a>.</p></section>
    </div>
  </div>
</main>;
