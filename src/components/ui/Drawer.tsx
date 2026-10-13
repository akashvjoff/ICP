import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { SectionEyebrow } from './SectionEyebrow';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  eyebrow = 'ACCOUNT DOSSIER',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#0A0A0A]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl border-l-[3.5px] border-[#0A0A0A] bg-[#F9F8F4] text-[#0A0A0A] shadow-[-10px_0px_0px_rgba(10,10,0,0.1)] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b-[2.5px] border-[#0A0A0A] px-6 py-5 bg-white">
            <div>
              <SectionEyebrow color="bg-[#6AAAFB]">{eyebrow}</SectionEyebrow>
              <h2 id="drawer-title" className="text-2xl font-black text-[#0A0A0A] tracking-tight">{title}</h2>
              {subtitle && <p className="mt-1 font-mono text-xs text-[#0A0A0A]/70 font-semibold">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 border-[2px] border-[#0A0A0A] rounded-xl bg-white shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFE3B3] transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5 text-[#0A0A0A]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
