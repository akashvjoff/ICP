import React from 'react';

export interface StepItem {
  id: string;
  num: string;
  label: string;
  pastelBg?: 'peach' | 'lavender' | 'mint' | 'pink';
}

interface ProgressStepperProps {
  steps: StepItem[];
  currentStepId: string;
  onSelectStep: (id: string) => void;
  className?: string;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStepId,
  onSelectStep,
  className = '',
}) => {
  const pastelMap = {
    peach: 'bg-[#FFE3B3]',
    lavender: 'bg-[#E4E6FB]',
    mint: 'bg-[#E5F7E5]',
    pink: 'bg-[#FFB6C2]',
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}>
      {steps.map((step, idx) => {
        const isActive = step.id === currentStepId;
        const bg = step.pastelBg ? pastelMap[step.pastelBg] : 'bg-white';

        return (
          <button
            key={step.id}
            onClick={() => onSelectStep(step.id)}
            className={`
              flex items-center gap-2
              px-3 sm:px-4 py-2
              rounded-xl
              border-[2.5px] border-[#0A0A0A]
              transition-all duration-120 cursor-pointer select-none
              ${isActive
                ? 'bg-[#A1F000] shadow-[3px_4px_0px_#0A0A0A] -translate-y-0.5'
                : `${bg} shadow-[2px_2px_0px_#0A0A0A] hover:bg-white/80`
              }
            `}
          >
            <span className="font-mono text-[11px] font-black text-[#0A0A0A] bg-white/70 px-1.5 py-0.5 rounded border border-[#0A0A0A]">
              {step.num}
            </span>
            <span className="font-mono text-xs font-bold text-[#0A0A0A] tracking-wider uppercase whitespace-nowrap">
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
