import React from 'react';

interface TableShellProps {
  title?: string;
  countLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const TableShell: React.FC<TableShellProps> = ({
  title,
  countLabel,
  actions,
  children,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-white
        border-[3px] border-[#0A0A0A]
        rounded-2xl
        shadow-[5px_6px_0px_#0A0A0A]
        overflow-hidden
        ${className}
      `}
    >
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b-[2.5px] border-[#0A0A0A] bg-[#F9F8F4]">
          <div className="flex items-center gap-3">
            {title && (
              <h3 className="text-base font-black tracking-tight text-[#0A0A0A]">
                {title}
              </h3>
            )}
            {countLabel && (
              <span className="font-mono text-xs font-bold text-[#0A0A0A]/60 bg-white px-2 py-0.5 rounded border border-[#0A0A0A]">
                {countLabel}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
};
