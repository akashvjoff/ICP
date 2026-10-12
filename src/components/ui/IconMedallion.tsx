import React from 'react';
import { StickerColor } from './StickerBadge';

interface IconMedallionProps {
  icon: React.ReactNode;
  color?: StickerColor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const IconMedallion: React.FC<IconMedallionProps> = ({
  icon,
  color = 'lavender',
  size = 'md',
  className = '',
}) => {
  const colorMap: Record<StickerColor, string> = {
    lime: 'bg-[#A1F000] text-[#0A0A0A]',
    purple: 'bg-[#8C6ADE] text-white',
    peach: 'bg-[#FFE3B3] text-[#0A0A0A]',
    lavender: 'bg-[#E4E6FB] text-[#0A0A0A]',
    mint: 'bg-[#E5F7E5] text-[#0A0A0A]',
    pink: 'bg-[#FFB6C2] text-[#0A0A0A]',
    blue: 'bg-[#6AAAFB] text-[#0A0A0A]',
    white: 'bg-white text-[#0A0A0A]',
  };

  const sizeMap = {
    sm: 'w-7 h-7 text-xs border-[1.5px] shadow-[1.5px_2px_0px_#0A0A0A]',
    md: 'w-10 h-10 text-sm border-[2px] shadow-[2px_3px_0px_#0A0A0A]',
    lg: 'w-14 h-14 text-xl border-[2.5px] shadow-[3px_4px_0px_#0A0A0A]',
  };

  return (
    <div
      className={`
        inline-flex items-center justify-center
        rounded-full border-[#0A0A0A] shrink-0
        ${colorMap[color]}
        ${sizeMap[size]}
        ${className}
      `}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
};
