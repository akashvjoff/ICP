import React, { useEffect, useState } from 'react';

export function UpgradeModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (response.status === 402) window.dispatchEvent(new Event('figuredit:plan-limit'));
      return response;
    };
    const show = () => setOpen(true);
    window.addEventListener('figuredit:plan-limit', show);
    return () => { window.fetch = original; window.removeEventListener('figuredit:plan-limit', show); };
  }, []);
  if (!open) return null;
  return <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
    <section role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onClick={event => event.stopPropagation()}
      className="w-full max-w-md rounded-2xl border-[3px] border-black bg-white p-7 shadow-[7px_7px_0px_#A1F000]">
      <h2 id="upgrade-title" className="text-2xl font-black">Ready for more?</h2>
      <p className="mt-3 text-sm font-medium">Your current plan has reached its limit. Compare plans to keep working with your list.</p>
      <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs font-black">
        <a href="/pricing" className="rounded-lg border-2 border-black bg-[#A1F000] px-5 py-3 shadow-[3px_3px_0px_#0A0A0A]">VIEW PLANS</a>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border-2 border-black bg-white px-5 py-3">CLOSE</button>
      </div>
    </section>
  </div>;
}
