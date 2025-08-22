/**
 * Onboarding Progress Indicator
 * 
 * Business Context:
 * - Visual progress indicator for the onboarding flow
 * - Shows completed, current, and upcoming steps
 * - Allows navigation to previously completed steps
 * 
 * Technical Decisions:
 * - Fully accessible with ARIA labels
 * - Responsive design with mobile optimization
 * - Smooth transitions and animations
 * - Keyboard navigation support
 */

"use client";

import { motion } from "framer-motion";
import { Check, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useProviderOnboardingStore,
  OnboardingStep,
  useOnboardingProgress,
} from "@/lib/stores/provider-onboarding-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  onStepClick?: (step: OnboardingStep) => void;
}

const STEP_LABELS = {
  [OnboardingStep.BASIC_INFO]: "Basic Info",
  [OnboardingStep.LOCATION]: "Location",
  [OnboardingStep.SERVICES]: "Services",
  [OnboardingStep.AVAILABILITY]: "Availability",
  [OnboardingStep.PAYMENT]: "Payment",
  [OnboardingStep.ADDITIONAL]: "Images",
  [OnboardingStep.REVIEW]: "Review",
};

const STEP_DESCRIPTIONS = {
  [OnboardingStep.BASIC_INFO]: "Personal and business information",
  [OnboardingStep.LOCATION]: "Service location details",
  [OnboardingStep.SERVICES]: "Services you offer and pricing",
  [OnboardingStep.AVAILABILITY]: "Your weekly schedule",
  [OnboardingStep.PAYMENT]: "Payment account setup",
  [OnboardingStep.ADDITIONAL]: "Profile and gallery photos",
  [OnboardingStep.REVIEW]: "Review and submit your profile",
};

export default function OnboardingProgress({
  currentStep,
  onStepClick,
}: OnboardingProgressProps) {
  const { completedSteps } = useProviderOnboardingStore();
  const progressPercentage = useOnboardingProgress();

  // Check if user can navigate to a step
  const canNavigateToStep = (step: OnboardingStep) => {
    // Can navigate to completed steps or current step
    return completedSteps.includes(step) || step === currentStep || step < currentStep;
  };

  const getStepStatus = (step: OnboardingStep) => {
    if (completedSteps.includes(step)) return "completed";
    if (step === currentStep) return "current";
    if (canNavigateToStep(step)) return "available";
    return "locked";
  };

  const handleStepClick = (step: OnboardingStep) => {
    if (onStepClick && canNavigateToStep(step)) {
      onStepClick(step);
    }
  };

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm font-medium text-gray-700">
            {progressPercentage}%
          </span>
        </div>
        <Progress 
          value={progressPercentage} 
          className="h-2 bg-gray-200"
          aria-label={`Onboarding progress: ${progressPercentage}% complete`}
        />
      </div>

      {/* Step Indicators */}
      <nav aria-label="Onboarding progress">
        <ol className="flex items-center justify-between">
          {Object.entries(STEP_LABELS).map(([stepKey, label], index) => {
            const step = Number(stepKey) as OnboardingStep;
            const status = getStepStatus(step);
            const isClickable = canNavigateToStep(step);

            return (
              <li key={step} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  {/* Connection Line */}
                  {index > 0 && (
                    <div
                      className={cn(
                        "absolute top-5 -left-1/2 right-1/2 h-0.5 -z-10",
                        status === "completed" || 
                        getStepStatus((Number(stepKey) - 1) as OnboardingStep) === "completed"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      )}
                      aria-hidden="true"
                    />
                  )}

                  {/* Step Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "relative flex flex-col items-center p-2 rounded-lg transition-all",
                            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            isClickable && "cursor-pointer hover:bg-gray-100",
                            !isClickable && "cursor-not-allowed opacity-50"
                          )}
                          onClick={() => handleStepClick(step)}
                          disabled={!isClickable}
                          aria-current={status === "current" ? "step" : undefined}
                          aria-label={`Step ${step}: ${label} - ${STEP_DESCRIPTIONS[step]}`}
                        >
                          {/* Step Icon */}
                          <motion.div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors",
                              status === "completed" && "bg-green-500 text-white",
                              status === "current" && "bg-blue-600 text-white ring-4 ring-blue-100",
                              status === "available" && "bg-white border-2 border-gray-300 text-gray-600",
                              status === "locked" && "bg-gray-100 text-gray-400"
                            )}
                            initial={false}
                            animate={{
                              scale: status === "current" ? 1.1 : 1,
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            {status === "completed" ? (
                              <Check className="w-5 h-5" aria-hidden="true" />
                            ) : status === "locked" ? (
                              <Lock className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <span>{step}</span>
                            )}
                          </motion.div>

                          {/* Step Label */}
                          <span 
                            className={cn(
                              "mt-2 text-xs font-medium",
                              status === "current" && "text-blue-600",
                              status === "completed" && "text-green-600",
                              status === "available" && "text-gray-700",
                              status === "locked" && "text-gray-400"
                            )}
                          >
                            {label}
                          </span>

                          {/* Mobile: Hide label on small screens except current */}
                          <span className="sr-only sm:not-sr-only">
                            {status === "current" && (
                              <span className="block text-xs text-gray-500 mt-1">
                                Current Step
                              </span>
                            )}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-gray-500">
                          {STEP_DESCRIPTIONS[step]}
                        </p>
                        {status === "locked" && (
                          <p className="text-xs text-yellow-600 mt-1">
                            Complete previous steps to unlock
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: Current Step Info */}
      <div className="mt-4 sm:hidden text-center">
        <p className="text-sm font-medium text-gray-900">
          Step {currentStep} of {Object.keys(STEP_LABELS).length}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {STEP_LABELS[currentStep]}
        </p>
      </div>
    </div>
  );
}