import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  // Brand tokens: Min control height 44px, 10px radius, 3px coral focus ring (#FF7A66).
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[#FF7A66] focus-visible:outline-offset-2';

  const sizeStyles = {
    sm: 'min-h-[38px] px-3.5 py-1.5 text-xs rounded-[10px] gap-1.5',
    md: 'min-h-[44px] px-4 py-2.5 text-sm rounded-[10px] gap-2',
    lg: 'min-h-[48px] px-5 py-3 text-base rounded-[10px] gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#122654] text-white hover:bg-[#0B1A3B] border border-[#122654] active:bg-[#08152e]',
    secondary:
      'bg-[#EAF5FC] text-[#122654] hover:bg-[#d8e8f6] border border-transparent font-semibold',
    outline:
      'bg-white text-[#122654] border border-[#D3DCEE] hover:bg-[#F5F8FD]',
    ghost:
      'bg-transparent text-[#4A5878] hover:text-[#122654] hover:bg-[#F5F8FD] border border-transparent',
    danger:
      'bg-[#FDECEA] text-[#B42318] border border-[#B42318]/20 hover:bg-[#fbdad7]',
    ai:
      'bg-[#FFF1EE] text-[#A23A27] border border-[#FF7A66]/30 hover:bg-[#FFE3DE] font-semibold',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
