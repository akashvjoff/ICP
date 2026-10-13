import React from 'react';

interface FormFieldProps {
  label: string;
  sublabel?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  sublabel,
  error,
  htmlFor,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">
          {label}
        </label>
        {sublabel && (
          <span className="text-[11px] text-[#0A0A0A]/60 font-medium">
            {sublabel}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p className="font-mono text-[11px] font-bold text-rose-600 mt-1">
          ⚠ {error}
        </p>
      )}
    </div>
  );
};

export const BrutalistInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <input
      className={`
        w-full
        bg-white
        border-[2.5px] border-[#0A0A0A]
        rounded-xl
        px-3.5 py-2.5
        text-sm font-semibold text-[#0A0A0A]
        placeholder-[#0A0A0A]/40
        shadow-[2px_2px_0px_#0A0A0A]
        transition-all duration-120
        focus:outline-none focus:ring-2 focus:ring-[#A1F000] focus:shadow-[3px_4px_0px_#0A0A0A]
        disabled:opacity-50 disabled:bg-black/5
        ${className}
      `}
      {...props}
    />
  );
};

export const BrutalistTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <textarea
      className={`
        w-full
        bg-white
        border-[2.5px] border-[#0A0A0A]
        rounded-xl
        p-3.5
        text-sm font-medium text-[#0A0A0A]
        placeholder-[#0A0A0A]/40
        shadow-[2px_2px_0px_#0A0A0A]
        transition-all duration-120
        focus:outline-none focus:ring-2 focus:ring-[#A1F000] focus:shadow-[3px_4px_0px_#0A0A0A]
        disabled:opacity-50 disabled:bg-black/5
        ${className}
      `}
      {...props}
    />
  );
};
