import React from 'react';
import { contactEmail, contactHref } from '../lib/contact';

export const ContactPage: React.FC = () => <main className="min-h-screen bg-[#F9F8F4] px-6 py-16 text-[#0A0A0A]">
  <div className="mx-auto max-w-3xl">
    <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">← FiguredIt</a>
    <div className="rounded-2xl border-[3px] border-black bg-[#A1F000] p-8 shadow-[6px_7px_0px_#0A0A0A]">
      <span className="font-mono text-xs font-black">GET IN TOUCH</span>
      <h1 className="mt-4 text-4xl font-black">Contact FiguredIt.</h1>
      <p className="mt-4">Questions about your account, your data, or the app? Reach out.</p>
      <dl className="mt-8 space-y-4 font-mono text-sm"><div><dt className="font-black">BUSINESS</dt><dd>FiguredIt</dd></div><div><dt className="font-black">LOCATION</dt><dd>Gurugram, Haryana, India</dd></div><div><dt className="font-black">EMAIL</dt><dd><a className="underline" href={contactHref}>{contactEmail}</a></dd></div></dl>
    </div>
  </div>
</main>;
