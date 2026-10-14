import React from 'react';

export const NotFoundPage: React.FC = () => (
  <main className="min-h-screen bg-[#F9F8F4] px-6 py-20 flex items-center justify-center">
    <div className="max-w-lg w-full rounded-2xl border-[3px] border-[#0A0A0A] bg-white p-8 shadow-[6px_7px_0px_#0A0A0A]">
      <p className="font-mono text-sm font-black">404 / PAGE NOT FOUND</p>
      <h1 className="mt-4 text-4xl font-black">This page doesn't exist.</h1>
      <p className="mt-3 text-[#0A0A0A]/70">Check the address or head back to icp.mode.</p>
      <div className="mt-8 flex flex-wrap gap-3 font-mono text-sm font-bold">
        <a className="rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 hover:bg-[#92dc00]" href="/">Go home</a>
        <a className="rounded-lg border-2 border-black bg-white px-4 py-3 hover:bg-[#F9F8F4]" href="/demo">Try the demo</a>
      </div>
    </div>
  </main>
);
