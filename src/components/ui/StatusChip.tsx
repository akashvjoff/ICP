import React from 'react';
import { StickerColor } from './StickerBadge';

interface StatusChipProps {
  children: React.ReactNode;
  color?: StickerColor;
  className?: string;
  dot?: boolean;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  children,
  color = 'mint',
  className = '',
  dot = false,
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

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-[6px]
        border-[2px] border-[#0A0A0A]
        shadow-[1.5px_2px_0px_#0A0A0A]
        font-mono text-[11px] font-bold uppercase tracking-wider
        whitespace-nowrap shrink-0
        ${colorMap[color]}
        ${className}
      `}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      )}
      <span>{children}</span>
    </span>
  );
};
