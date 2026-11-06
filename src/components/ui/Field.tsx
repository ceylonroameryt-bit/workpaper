import React from 'react';

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold uppercase tracking-wider text-[#4A5878] flex items-center gap-1"
        >
          <span>{label}</span>
          {required && <span className="text-[#6B4700]">*</span>}
        </label>
      )}

      {children}

      {hint && !error && (
        <span className="text-xs text-[#4A5878] mt-0.5">{hint}</span>
      )}

      {error && (
        <span className="text-xs text-[#6B4700] font-medium mt-0.5 flex items-center gap-1" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, prefixIcon, suffixIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {prefixIcon && (
          <div className="absolute left-3.5 text-[#4A5878] pointer-events-none flex items-center">
            {prefixIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full min-h-[44px] px-3.5 py-2.5 bg-white border ${
            error ? 'border-[#6B4700]' : 'border-[#D3DCEE]'
          } rounded-[10px] text-sm text-[#122654] placeholder:text-[#4A5878]/60 transition-colors focus-visible:outline-2 focus-visible:outline-[#1D4E89] focus-visible:outline-offset-2 disabled:bg-[#F5F8FD] disabled:text-[#4A5878] ${
            prefixIcon ? 'pl-10' : ''
          } ${suffixIcon ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {suffixIcon && (
          <div className="absolute right-3.5 text-[#4A5878] pointer-events-none flex items-center">
            {suffixIcon}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full min-h-[44px] px-3.5 py-2.5 bg-white border ${
          error ? 'border-[#6B4700]' : 'border-[#D3DCEE]'
        } rounded-[10px] text-sm text-[#122654] transition-colors focus-visible:outline-2 focus-visible:outline-[#1D4E89] focus-visible:outline-offset-2 disabled:bg-[#F5F8FD] ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';
