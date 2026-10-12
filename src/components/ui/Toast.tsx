import React from 'react';
import { StickerColor } from './StickerBadge';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'warning' | 'info';
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onClose,
  className = '',
}) => {
  const typeMap = {
    success: { bg: 'bg-[#A1F000]', icon: <Check className="w-4 h-4 text-[#0A0A0A]" /> },
    warning: { bg: 'bg-[#FFE3B3]', icon: <AlertTriangle className="w-4 h-4 text-[#0A0A0A]" /> },
    info: { bg: 'bg-[#E4E6FB]', icon: <Info className="w-4 h-4 text-[#0A0A0A]" /> },
  };

  const { bg, icon } = typeMap[type];

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-3
        px-4 py-3
        border-[2.5px] border-[#0A0A0A]
        rounded-xl
        shadow-[4px_5px_0px_#0A0A0A]
        ${bg} text-[#0A0A0A]
        font-mono text-xs font-bold
        ${className}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/10 rounded cursor-pointer shrink-0"
          aria-label="Dismiss toast"
        >
          <X className="w-3.5 h-3.5 text-[#0A0A0A]" />
        </button>
      )}
    </div>
  );
};
