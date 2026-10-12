import React from 'react';

interface SectionEyebrowProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export const SectionEyebrow: React.FC<SectionEyebrowProps> = ({
  children,
  color = 'bg-[#6AAAFB]',
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 mb-3 ${className}`}>
      {/* Blue square marker (or custom pastel square) */}
      <span
        className={`w-2.5 h-2.5 ${color} border-[1.5px] border-[#0A0A0A] shrink-0 shadow-[1px_1px_0px_#0A0A0A]`}
        aria-hidden="true"
      />
      <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-[#0A0A0A]">
        {children}
      </span>
    </div>
  );
};
