import React from 'react';
import { BrutalistCard, BrutalistCardBg } from './BrutalistCard';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  bg?: BrutalistCardBg;
  badge?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  bg = 'white',
  badge,
  className = '',
}) => {
  return (
    <BrutalistCard bg={bg} shadowSize="sm" className={`p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#0A0A0A]/70">
          {label}
        </span>
        {badge}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight text-[#0A0A0A]">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-mono font-bold text-[#0A0A0A]/60">
            {unit}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-[#0A0A0A]/80 font-medium mt-1 leading-snug">
          {subtext}
        </p>
      )}
    </BrutalistCard>
  );
};
