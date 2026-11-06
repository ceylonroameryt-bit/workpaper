import React from 'react';

interface TileProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isMonoNumber?: boolean;
}

export const Tile: React.FC<TileProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  onClick,
  className = '',
  isMonoNumber = true,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E3E7EF] rounded-[14px] p-5 flex flex-col justify-between transition-all ${
        onClick ? 'cursor-pointer hover:border-[#1D4E89]/40' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#4A5878]">
          {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {icon && <span className="text-[#4A5878]">{icon}</span>}
        </div>
      </div>

      <div
        className={`text-2xl font-bold text-[#122654] tracking-tight ${
          isMonoNumber ? 'font-mono-numbers' : ''
        }`}
      >
        {value}
      </div>

      {subtitle && (
        <div className="text-xs text-[#4A5878] mt-2 flex items-center gap-1.5">
          {subtitle}
        </div>
      )}
    </div>
  );
};
