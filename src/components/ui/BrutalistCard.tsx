import React from 'react';

export type BrutalistCardBg = 'white' | 'peach' | 'lavender' | 'mint' | 'pink' | 'canvas' | 'lime' | 'dark';

interface BrutalistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  bg?: BrutalistCardBg;
  hoverable?: boolean;
  shadowSize?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const BrutalistCard: React.FC<BrutalistCardProps> = ({
  bg = 'white',
  hoverable = false,
  shadowSize = 'md',
  children,
  className = '',
  ...props
}) => {
  const bgMap: Record<BrutalistCardBg, string> = {
    white: 'bg-white text-[#0A0A0A]',
    peach: 'bg-[#FFE3B3] text-[#0A0A0A]',
    lavender: 'bg-[#E4E6FB] text-[#0A0A0A]',
    mint: 'bg-[#E5F7E5] text-[#0A0A0A]',
    pink: 'bg-[#FFB6C2] text-[#0A0A0A]',
    canvas: 'bg-[#F9F8F4] text-[#0A0A0A]',
    lime: 'bg-[#A1F000] text-[#0A0A0A]',
    dark: 'bg-[#0A0A0A] text-white',
  };

  const shadowMap = {
    sm: 'shadow-[3px_3px_0px_#0A0A0A]',
    md: 'shadow-[4px_5px_0px_#0A0A0A]',
    lg: 'shadow-[6px_7px_0px_#0A0A0A]',
  };

  const hoverClass = hoverable
    ? 'transition-all duration-150 ease-out hover:-translate-y-1 hover:shadow-[6px_8px_0px_#0A0A0A]'
    : '';

  return (
    <div
      className={`
        border-[2.5px] sm:border-[3px] border-[#0A0A0A]
        rounded-2xl
        ${shadowMap[shadowSize]}
        ${bgMap[bg]}
        ${hoverClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
