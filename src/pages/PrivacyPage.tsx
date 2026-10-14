import React from 'react';

export const PrivacyPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#F9F8F4] px-6 py-10 text-[#0A0A0A]">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="mb-8 inline-block font-mono text-sm font-bold hover:underline">
          ← FiguredIt
        </a>
        <h1 className="mb-2 text-4xl font-black">Privacy notice</h1>
        <p className="mb-8 font-mono text-sm text-slate-600">Effective October 14, 2026</p>

        <div className="space-y-7 leading-relaxed">
          <section>
            <h2 className="mb-2 text-xl font-bold">Information used for your account</h2>
            <p>When you sign in with Google, Google shares your name, email address, and basic profile information with our authentication provider, Supabase. We use this information to create and maintain your FiguredIt account and show your account identity in the app. Email and password sign-in is also available.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Information you add to FiguredIt</h2>
            <p>The app processes the offering details, company information, and CSV or spreadsheet records you provide to generate customer fit analyses, segments, and reports. Account data and saved analyses are stored in Supabase. Some app preferences and demo data are stored in your browser.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Service providers</h2>
            <p>Render hosts the app. Supabase provides authentication and data storage. When you use AI analysis, relevant information from your offering and company records may be sent to Google Gemini to generate the requested output. Google also processes the basic profile data needed for Google sign-in.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Sessions and security</h2>
            <p>The app stores an authentication session in your browser so you can remain signed in. Access to saved live workspace data is tied to your signed-in account. Sign out on a shared device when finished.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold">Questions and requests</h2>
            <p>For questions about your data or to request access or deletion, contact <a className="underline" href="mailto:akashvjoff@gmail.com">akashvjoff@gmail.com</a>. We will review requests against the data held by FiguredIt and its service providers.</p>
          </section>
        </div>
      </div>
    </main>
  );
};
