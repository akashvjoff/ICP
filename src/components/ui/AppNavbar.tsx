import React, { useState } from 'react';
import { BrutalistButton } from './BrutalistButton';
import { ArrowRight, Menu, X, Sparkles } from 'lucide-react';

interface AppNavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onPrimaryAction: () => void;
  isWorkspace: boolean;
  onToggleView: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  currentTab,
  onSelectTab,
  onPrimaryAction,
  isWorkspace,
  onToggleView,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'offering', label: 'OFFERING PROFILE' },
    { id: 'ingestion', label: 'LEAD INGESTION' },
    { id: 'pipeline', label: 'STRATEGIC PIPELINE' },
    { id: 'dossier', label: 'ICP DOSSIER' },
  ];

  const handleNavClick = (id: string) => {
    if (!isWorkspace) onToggleView();
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b-[3px] border-[#0A0A0A] bg-[#F9F8F4]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
        {/* Left: small lime square + "THE CUSTOMER-FIT ENGINE" */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="w-3.5 h-3.5 bg-[#A1F000] border-[2px] border-[#0A0A0A] shadow-[1.5px_1.5px_0px_#0A0A0A]"
            aria-hidden="true"
          />
          <span className="font-mono text-xs font-black tracking-wider uppercase text-[#0A0A0A] hidden sm:inline-block">
            THE CUSTOMER-FIT ENGINE
          </span>
          <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-[#0A0A0A] sm:hidden">
            ICP ENGINE
          </span>
        </div>

        {/* Center: icp.mode wordmark */}
        <button
          onClick={onToggleView}
          className="flex items-center text-center cursor-pointer group"
          aria-label="icp.mode home"
        >
          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-[#0A0A0A] group-hover:text-[#8C6ADE] transition-colors">
            icp<span className="text-[#A1F000] drop-shadow-[1px_1px_0px_#0A0A0A]">.</span>mode
          </span>
        </button>

        {/* Right: desktop nav & outlined/lime action button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-5 mr-3">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`font-mono text-xs font-bold tracking-wider transition-colors cursor-pointer py-1 ${
                  currentTab === link.id && isWorkspace
                    ? 'text-[#0A0A0A] border-b-[2.5px] border-[#A1F000]'
                    : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <BrutalistButton
            variant="lime"
            size="sm"
            onClick={onPrimaryAction}
            className="text-xs font-black tracking-wide"
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            {isWorkspace ? 'NEW DISCOVERY' : 'MY DASHBOARD →'}
          </BrutalistButton>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 border-[2px] border-[#0A0A0A] rounded-lg bg-white shadow-[2px_2px_0px_#0A0A0A] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#0A0A0A]" /> : <Menu className="w-5 h-5 text-[#0A0A0A]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t-[2.5px] border-[#0A0A0A] bg-[#F9F8F4] px-6 py-5 space-y-3">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link.id)}
              className={`w-full text-left font-mono text-xs font-bold tracking-wider py-2 px-3 rounded-lg border-[2px] border-[#0A0A0A] transition-colors ${
                currentTab === link.id && isWorkspace
                  ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="pt-2 border-t-[2px] border-[#0A0A0A]/20 flex gap-2">
            <button
              onClick={() => {
                onToggleView();
                setMobileMenuOpen(false);
              }}
              className="flex-1 text-center font-mono text-xs font-bold py-2 bg-[#E4E6FB] border-[2px] border-[#0A0A0A] rounded-lg shadow-[2px_2px_0px_#0A0A0A]"
            >
              {isWorkspace ? 'VIEW LANDING PAGE' : 'VIEW WORKSPACE'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
