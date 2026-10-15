import React from 'react';
import { contactEmail, contactHref } from '../lib/contact';

export const PrivacyPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#F9F8F4] px-6 py-10 text-[#0A0A0A]">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">
          ← FiguredIt
        </a>
        <h1 className="mb-2 text-4xl font-black">Privacy notice</h1>
        <p className="mb-8 font-mono text-sm text-slate-600">Last updated October 15, 2026</p>

        <div className="space-y-7 leading-relaxed">
          <section>
            <h2 className="mb-2 text-xl font-bold">Information used for your account</h2>
            <p>When you sign in with Google, Google shares your name, email address, and basic profile information with our authentication provider, Supabase. We use this information to create and maintain your FiguredIt account and show your account identity in the app. Email and password sign-in is also available.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Information you add to FiguredIt</h2>
            <p>The app processes the offering details, company information, and CSV records you provide to generate customer fit analyses, segments, and reports. We store your profile, datasets, normalized company records, analyses, scores, and reports in Supabase. Some app preferences and demo data are stored in your browser.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Service providers</h2>
            <p>Render hosts the app. Supabase provides authentication and data storage. When you use AI analysis, relevant uploaded company rows and offering details are sent to Google Gemini to generate the requested output. Personal contact fields are removed before analysis. Google also processes the basic profile data needed for Google sign-in.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Retention and deletion</h2>
            <p>We do not keep the original uploaded file. Raw row copies retained for processing are cleared after 90 days; normalized records and analysis remain in your workspace until you request deletion or your account is removed. To request deletion of your account and saved data, email us below.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Sessions and security</h2>
            <p>The app stores an authentication session in your browser so you can remain signed in. Access to saved live workspace data is tied to your signed-in account. Sign out on a shared device when finished.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Questions and requests</h2>
            <p>For questions about your data or to request access or deletion, contact <a className="underline" href={contactHref}>{contactEmail}</a>. We will review requests against the data held by FiguredIt and its service providers.</p>
          </section>
        </div>
      </div>
    </main>
  );
};
