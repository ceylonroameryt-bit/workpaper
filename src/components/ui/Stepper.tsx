import React from 'react';
import { Check } from 'lucide-react';

export interface Step {
  id: number | string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number; // 1-indexed
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <li
              key={step.id}
              className={`relative flex items-center ${
                index !== steps.length - 1 ? 'w-full' : ''
              }`}
            >
              <div
                onClick={() => isComplete && onStepClick && onStepClick(stepNumber)}
                className={`flex items-center gap-3 group select-none ${
                  isComplete && onStepClick ? 'cursor-pointer' : ''
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    isComplete
                      ? 'bg-[#E6F4EF] text-[#0B6B52] border border-transparent'
                      : isCurrent
                      ? 'bg-[#1D4E89] text-white ring-4 ring-[#EAF5FC]'
                      : 'bg-[#F5F8FD] text-[#4A5878] border border-[#D3DCEE]'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNumber}
                </span>

                <div className="flex flex-col">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isCurrent
                        ? 'text-[#1D4E89]'
                        : isComplete
                        ? 'text-[#122654]'
                        : 'text-[#4A5878]'
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="text-[11px] text-[#4A5878] hidden sm:inline">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>

              {index !== steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors ${
                    stepNumber < currentStep ? 'bg-[#0B6B52]' : 'bg-[#E3E7EF]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
