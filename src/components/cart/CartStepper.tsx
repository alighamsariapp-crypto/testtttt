import React from 'react';
import { Check } from 'lucide-react';

interface CartStepperProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

export const CartStepper: React.FC<CartStepperProps> = ({ currentStep, onStepClick }) => {
  const steps = [
    { id: 1, label: 'سبد خرید' },
    { id: 2, label: 'اطلاعات ارسال' },
    { id: 3, label: 'پرداخت' },
  ];

  return (
    <div className="w-full max-w-xl mx-auto py-4 px-2 select-none">
      <div className="relative flex items-center justify-between">
        
        {/* Connecting Lines Behind */}
        <div className="absolute top-4 left-6 right-6 h-[2px] bg-slate-200 -z-0">
          {/* Step 1 to 2 line */}
          <div
            className={`absolute top-0 right-0 h-full transition-all duration-300 ${
              currentStep >= 2 ? 'bg-blue-600 w-1/2' : 'w-0'
            }`}
          />
          {/* Step 2 to 3 line */}
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-300 ${
              currentStep >= 3 ? 'bg-blue-600 w-1/2' : 'w-0'
            }`}
          />
        </div>

        {/* Step Circles */}
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <div
              key={step.id}
              onClick={() => {
                if (onStepClick && step.id <= currentStep) {
                  onStepClick(step.id as 1 | 2 | 3);
                }
              }}
              className={`flex flex-col items-center gap-2 relative z-10 cursor-pointer ${
                step.id <= currentStep ? 'opacity-100' : 'opacity-70'
              }`}
            >
              {/* Circle */}
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-xs ${
                  isCompleted
                    ? 'bg-blue-600 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[11px] sm:text-xs font-bold transition-colors ${
                  isActive ? 'text-blue-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}

      </div>
    </div>
  );
};
