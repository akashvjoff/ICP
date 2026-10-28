import React, { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { BrutalistLink } from './BrutalistButton';

const links = [
  { href: '/#how-it-works', label: 'HOW IT WORKS' },
  { href: '/#test-drive', label: 'SAMPLE ANALYSIS' },
  { href: '/demo', label: 'PUBLIC DEMO' },
  { href: '/about', label: 'ABOUT & Q&A' },
  { href: '/guides/ideal-customer-profile-from-leads', label: 'ICP GUIDE' },
  { href: '/pricing', label: 'PRICING' },
  { href: '/privacy', label: 'PRIVACY' },
  { href: '/auth', label: 'SIGN IN' },
];

export const AppNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b-[3px] border-[#0A0A0A] bg-[#F9F8F4]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl min-w-0 items-center justify-between gap-2 px-4 sm:px-8">
        <a href="/" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0A0A0A]" aria-label="Let’s FiguredIt — home">
          <span className="font-mono text-xs font-black uppercase tracking-tight sm:text-sm">LET’S</span>
          <span className="text-2xl font-black tracking-tighter sm:text-3xl">Figured<span className="text-[#5F3EB5]">It</span></span>
        </a>
        <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-3 xl:gap-4">
          {links.map(link => <a key={link.href} href={link.href} className="font-mono text-[10px] xl:text-xs font-bold tracking-wide hover:underline">{link.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <BrutalistLink href="/demo" size="sm" variant="lime" icon={<ArrowRight size={14} />} className="hidden sm:inline-flex text-xs">EXPLORE DEMO</BrutalistLink>
          <button type="button" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" className="lg:hidden p-2 border-[2px] border-[#0A0A0A] rounded-lg bg-white shadow-[2px_2px_0px_#0A0A0A]">
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="lg:hidden border-t-[2px] border-black bg-[#F9F8F4] px-6 py-5 space-y-3">{links.map(link => <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block rounded-lg border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_#0A0A0A]">{link.label}</a>)}</nav>}
    </header>
  );
};
