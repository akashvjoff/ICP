import React from 'react';
import { BrutalistCard } from './BrutalistCard';
import { IconMedallion } from './IconMedallion';
import { BrutalistButton } from './BrutalistButton';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
  className = '',
}) => {
  return (
    <BrutalistCard bg="white" shadowSize="md" className={`p-10 text-center max-w-lg mx-auto ${className}`}>
      <div className="flex justify-center mb-4">
        <IconMedallion
          icon={icon || <AlertCircle className="w-6 h-6 text-[#0A0A0A]" />}
          color="lavender"
          size="lg"
        />
      </div>

      <h3 className="text-xl font-black text-[#0A0A0A] tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-sm text-[#0A0A0A]/70 leading-relaxed mb-6">
        {description}
      </p>

      {actionText && onAction && (
        <BrutalistButton variant="lime" size="md" onClick={onAction}>
          {actionText}
        </BrutalistButton>
      )}
    </BrutalistCard>
  );
};
