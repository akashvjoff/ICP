import React from 'react';

export type StickerColor = 'lime' | 'purple' | 'peach' | 'lavender' | 'mint' | 'pink' | 'white' | 'blue';

interface StickerBadgeProps {
  children: React.ReactNode;
  color?: StickerColor;
  rotate?: '-2' | '2' | '-3' | '3' | '0';
  className?: string;
  icon?: React.ReactNode;
}

export const StickerBadge: React.FC<StickerBadgeProps> = ({
  children,
  color = 'lime',
  rotate = '-2',
  className = '',
  icon,
}) => {
  const colorMap: Record<StickerColor, string> = {
    lime: 'bg-[#A1F000] text-[#0A0A0A]',
    purple: 'bg-[#5F3EB5] text-white',
    peach: 'bg-[#FFE3B3] text-[#0A0A0A]',
    lavender: 'bg-[#E4E6FB] text-[#0A0A0A]',
    mint: 'bg-[#E5F7E5] text-[#0A0A0A]',
    pink: 'bg-[#FFB6C2] text-[#0A0A0A]',
    blue: 'bg-[#6AAAFB] text-[#0A0A0A]',
    white: 'bg-white text-[#0A0A0A]',
  };

  const rotateMap: Record<string, string> = {
    '-2': '-rotate-2',
    '2': 'rotate-2',
    '-3': '-rotate-3',
    '3': 'rotate-3',
    '0': 'rotate-0',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-md
        border-[2px] border-[#0A0A0A]
        shadow-[2px_3px_0px_#0A0A0A]
        font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider
        whitespace-nowrap select-none
        transition-transform duration-150 hover:scale-105
        ${colorMap[color]}
        ${rotateMap[rotate] || 'rotate-0'}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
