import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  showLabel = false,
  className = '',
  size = 'md',
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className={`flex items-center gap-2.5 w-full ${className}`}>
      <div
        className={`w-full bg-[#E8EBF0] rounded-full overflow-hidden ${heightClass}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-[#1D4E89] h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono-numbers font-medium text-[#4A5878] min-w-[32px] text-right shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  );
};
