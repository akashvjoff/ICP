import React from 'react';
import { SectionEyebrow } from './SectionEyebrow';

interface SectionHeadingProps {
  eyebrow?: string;
  eyebrowColor?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  eyebrowColor = 'bg-[#6AAAFB]',
  title,
  description,
  align = 'left',
  className = '',
}) => {
  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left';

  return (
    <div className={`max-w-3xl mb-10 ${alignClass} ${className}`}>
      {eyebrow && (
        <div className={align === 'center' ? 'flex justify-center' : ''}>
          <SectionEyebrow color={eyebrowColor}>{eyebrow}</SectionEyebrow>
        </div>
      )}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0A0A0A] tracking-tight leading-[1.08] text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base sm:text-lg text-[#0A0A0A]/75 font-normal leading-relaxed max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
};
