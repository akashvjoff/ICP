import React from 'react';
import { BrutalistCard, BrutalistCardBg } from './BrutalistCard';
import { IconMedallion } from './IconMedallion';
import { StickerColor } from './StickerBadge';

interface PastelStepCardProps {
  stepNumber: string;
  title: string;
  subtitle: string;
  description: string;
  takeaway?: string;
  bg?: BrutalistCardBg;
  icon?: React.ReactNode;
  iconColor?: StickerColor;
  className?: string;
}

export const PastelStepCard: React.FC<PastelStepCardProps> = ({
  stepNumber,
  title,
  subtitle,
  description,
  takeaway,
  bg = 'lavender',
  icon,
  iconColor = 'purple',
  className = '',
}) => {
  return (
    <BrutalistCard
      bg={bg}
      hoverable
      shadowSize="md"
      className={`p-6 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-4 border-b-[2px] border-[#0A0A0A]/20 pb-3">
          <span className="font-mono text-xs font-black tracking-widest text-[#0A0A0A] bg-white/70 px-2 py-0.5 rounded border border-[#0A0A0A]">
            STEP {stepNumber}
          </span>
          {icon && <IconMedallion icon={icon} color={iconColor} size="md" />}
        </div>

        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]/70 mb-1">
          {subtitle}
        </p>
        <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight leading-tight mb-3">
          {title}
        </h3>
        <p className="text-sm text-[#0A0A0A]/85 leading-relaxed font-normal mb-4">
          {description}
        </p>
      </div>

      {takeaway && (
        <div className="mt-auto pt-3 border-t-[2px] border-[#0A0A0A]/20">
          <p className="font-mono text-[11px] font-bold text-[#0A0A0A] leading-snug">
            ↳ {takeaway}
          </p>
        </div>
      )}
    </BrutalistCard>
  );
};
