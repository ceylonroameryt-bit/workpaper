import React from 'react';

interface BlyntLogoProps {
  variant?: 'full' | 'mark' | 'text';
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  className?: string;
}

/**
 * The official Blynt logo (brand kit v1): always inside its white rectangle, with clear space X
 * on every side (X = 32% of the mark height) and corner radius X / 5.
 */
function Rectangle({ height, children, className = '' }: { height: number; children: React.ReactNode; className?: string }) {
  const x = height * 0.32;
  return (
    <span className={`inline-flex shrink-0 bg-white ${className}`} style={{ padding: x, borderRadius: x / 5 }}>
      {children}
    </span>
  );
}

/** The symbol alone, for small spaces. */
export const BlyntMark: React.FC<{ size?: number; className?: string; theme?: 'dark' | 'light' }> = ({ size = 28, className = '' }) => (
  <Rectangle height={size} className={className}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/blynt-symbol.svg" alt="Blynt" width={Math.round(size * (740 / 924))} height={size} />
  </Rectangle>
);

export const BlyntLogo: React.FC<BlyntLogoProps> = ({ variant = 'full', size = 'md', theme = 'dark', className = '' }) => {
  const h = size === 'sm' ? 20 : size === 'lg' ? 32 : 24;
  if (variant === 'mark') return <BlyntMark size={h} className={className} />;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <Rectangle height={h}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/blynt-horizontal.svg" alt="Blynt" width={Math.round(h * (2609 / 924))} height={h} />
      </Rectangle>
      {variant === 'full' && (
        <span
          className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
            theme === 'dark' ? 'bg-white/10 text-white' : 'bg-[#EEF2F9] text-[#122654]'
          }`}
        >
          Workpapers
        </span>
      )}
    </div>
  );
};

export default BlyntLogo;
