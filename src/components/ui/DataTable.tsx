import React from 'react';

interface DataTableProps {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  children,
  headerAction,
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[#E3E7EF] rounded-[14px] overflow-hidden ${className}`}
    >
      {(title || headerAction) && (
        <div className="px-5 py-4 border-b border-[#E3E7EF] flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-[#122654]">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-[#4A5878] mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="overflow-x-auto w-full">{children}</div>
    </div>
  );
};
