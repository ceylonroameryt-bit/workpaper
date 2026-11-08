'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Focus first interactive control inside dialog
      setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      }, 50);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
        if (previouslyFocusedElementRef.current) {
          previouslyFocusedElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const titleId = `dialog-title-${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1A3B]/70 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${maxWidthClasses[maxWidth]} bg-white rounded-xl border border-[#E3E7EF] shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95`}
      >
        {/* Dialog Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E7EF] bg-[#F5F8FD]">
          <h2 id={titleId} className="text-base font-semibold text-[#122654]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#4A5878] hover:text-[#122654] hover:bg-[#E3E7EF] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[#FF7A66]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
};
