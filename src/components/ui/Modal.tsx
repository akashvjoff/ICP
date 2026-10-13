import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { BrutalistCard } from './BrutalistCard';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  children,
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center"
    >
      {/* Backdrop with faint checkerboard tint */}
      <div
        className="fixed inset-0 bg-[#0A0A0A]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`relative w-full max-w-2xl z-10 ${className}`}>
        <BrutalistCard bg="white" shadowSize="lg" className="overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b-[2.5px] border-[#0A0A0A] px-6 py-4 bg-[#F9F8F4]">
            <div>
              {eyebrow && (
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/60 block mb-1">
                  {eyebrow}
                </span>
              )}
              <h3 id="modal-title" className="text-xl font-black text-[#0A0A0A] tracking-tight">
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 border-[2px] border-[#0A0A0A] rounded-lg bg-white shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFE3B3] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-[#0A0A0A]" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            {children}
          </div>
        </BrutalistCard>
      </div>
    </div>
  );
};
