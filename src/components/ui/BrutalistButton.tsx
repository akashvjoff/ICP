import React from 'react';

export type BrutalistButtonVariant = 'lime' | 'white' | 'purple' | 'dark' | 'peach' | 'lavender' | 'outline';
export type BrutalistButtonSize = 'sm' | 'md' | 'lg';

interface BrutalistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrutalistButtonVariant;
  size?: BrutalistButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  variant = 'lime',
  size = 'md',
  children,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles: Record<BrutalistButtonVariant, string> = {
    lime: 'bg-[#A1F000] text-[#0A0A0A] hover:bg-[#92dc00]',
    white: 'bg-white text-[#0A0A0A] hover:bg-[#f2f2ee]',
    purple: 'bg-[#8C6ADE] text-white hover:bg-[#7b57d6]',
    dark: 'bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]',
    peach: 'bg-[#FFE3B3] text-[#0A0A0A] hover:bg-[#fad395]',
    lavender: 'bg-[#E4E6FB] text-[#0A0A0A] hover:bg-[#d4d7f7]',
    outline: 'bg-transparent text-[#0A0A0A] hover:bg-black/5',
  };

  const sizeStyles: Record<BrutalistButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs font-bold rounded-lg',
    md: 'px-5 py-2.5 text-sm font-bold rounded-xl',
    lg: 'px-7 py-3.5 text-base font-extrabold rounded-xl',
  };

  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2
        border-[2.5px] border-[#0A0A0A]
        shadow-[4px_5px_0px_#0A0A0A]
        transition-all duration-150 ease-out
        active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_1px_0px_#0A0A0A]
        hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_6px_0px_#0A0A0A]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C6ADE] focus-visible:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none
        cursor-pointer select-none whitespace-nowrap shrink-0
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
