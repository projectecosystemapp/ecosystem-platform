/**
 * Onboarding Navigation Component
 * 
 * Business Context:
 * - Navigation controls for the onboarding wizard
 * - Handles step transitions and form submission
 * - Provides save & exit functionality
 * 
 * Technical Decisions:
 * - Keyboard navigation support (Arrow keys, Tab, Enter)
 * - Loading states and disabled states
 * - Mobile-responsive button layout
 * - Accessibility with ARIA labels
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Check, 
  Loader2,
  X,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  useProviderOnboardingStore,
  OnboardingStep,
  useStepNavigation,
  useCanSubmitForm,
} from "@/lib/stores/provider-onboarding-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OnboardingNavigationProps {
  onSubmit: () => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

export default function OnboardingNavigation({
  onSubmit,
  isSubmitting = false,
  className,
}: OnboardingNavigationProps) {
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    currentStep,
    validateStep,
    goToNextStep,
    goToPreviousStep,
    stepValidation,
  } = useProviderOnboardingStore();

  const canSubmit = useCanSubmitForm();

  const isLastStep = currentStep === OnboardingStep.REVIEW;
  const isFirstStep = currentStep === OnboardingStep.BASIC_INFO;

  // Handle next step navigation
  const handleNext = async () => {
    const isValid = validateStep(currentStep);
    
    if (!isValid) {
      // Show specific error messages based on validation errors
      const currentStepValidation = stepValidation[currentStep];
      const errors = currentStepValidation?.errors || {};
      const errorMessages = Object.values(errors).filter((msg): msg is string => typeof msg === 'string');
      
      if (errorMessages.length > 0) {
        toast.error(errorMessages[0], {
          description: errorMessages.length > 1 
            ? `And ${errorMessages.length - 1} more issue${errorMessages.length > 2 ? 's' : ''}`
            : undefined,
        });
      } else {
        toast.error("Please complete all required fields");
      }
      return;
    }

    goToNextStep();
    
    // Announce step change for screen readers
    const stepName = getStepName(currentStep + 1);
    announceForScreenReader(`Moving to ${stepName}`);
  };

  // Handle previous step navigation
  const handlePrevious = () => {
    goToPreviousStep();
    
    // Announce step change for screen readers
    const stepName = getStepName(currentStep - 1);
    announceForScreenReader(`Returning to ${stepName}`);
  };

  // Handle save and exit
  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      // Progress is automatically saved by the store on each update
      toast.success("Progress saved successfully");
      router.push("/dashboard");
    } catch (error) {
      toast.error("Failed to save progress");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
      setShowExitDialog(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Arrow key navigation
    if (e.key === "ArrowLeft" && !isFirstStep) {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === "ArrowRight" && !isLastStep) {
      e.preventDefault();
      handleNext();
    }
    
    // Enter to submit on last step
    if (e.key === "Enter" && isLastStep && canSubmit && !isSubmitting) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Helper function to get step name
  const getStepName = (step: number): string => {
    const stepNames = {
      [OnboardingStep.BASIC_INFO]: "Basic Information",
      [OnboardingStep.LOCATION]: "Location",
      [OnboardingStep.SERVICES]: "Services & Pricing",
      [OnboardingStep.AVAILABILITY]: "Availability",
      [OnboardingStep.PAYMENT]: "Payment Setup",
      [OnboardingStep.ADDITIONAL]: "Additional Info",
      [OnboardingStep.REVIEW]: "Review & Submit",
    };
    return stepNames[step as OnboardingStep] || `Step ${step}`;
  };

  // Announce for screen readers
  const announceForScreenReader = (message: string) => {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.className = "sr-only";
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  return (
    <>
      <nav
        className={cn(
          "flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-white border-t",
          className
        )}
        onKeyDown={handleKeyDown}
        aria-label="Onboarding navigation"
      >
        {/* Left Section: Previous/Save & Exit */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isFirstStep ? (
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep || isSubmitting}
              className="flex items-center gap-2"
              aria-label="Go to previous step"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Back</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowExitDialog(true)}
              disabled={isSubmitting || isSaving}
              className="flex items-center gap-2"
              aria-label="Save progress and exit"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Exit</span>
            </Button>
          )}

          {/* Save Progress (not on first or last step) */}
          {!isFirstStep && !isLastStep && (
            <Button
              variant="ghost"
              onClick={() => {
                // Progress is automatically saved by the store on each update
                toast.success("Progress saved");
              }}
              disabled={isSubmitting || isSaving}
              className="flex items-center gap-2"
              aria-label="Save current progress"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}
        </div>

        {/* Center: Step Info (Mobile Only) */}
        <div className="sm:hidden text-center">
          <span className="text-sm text-gray-600">
            Step {currentStep} of 6
          </span>
        </div>

        {/* Right Section: Next/Submit */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isLastStep ? (
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2"
              aria-label="Go to next step"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full sm:w-auto"
            >
              <Button
                onClick={onSubmit}
                disabled={!canSubmit || isSubmitting}
                size="lg"
                className={cn(
                  "w-full sm:w-auto flex items-center justify-center gap-2",
                  canSubmit && !isSubmitting && "bg-green-600 hover:bg-green-700"
                )}
                aria-label="Submit provider application"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Submit Application</span>
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </nav>

      {/* Validation Status (Screen Reader Only) */}
      {stepValidation[currentStep] && !stepValidation[currentStep].isValid && (
        <div className="sr-only" role="alert">
          <p>
            This step has validation errors. 
            {Object.values(stepValidation[currentStep].errors).join(". ")}
          </p>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save and Exit?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be saved and you can continue where you left off.
              Are you sure you want to exit the onboarding process?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              Continue Onboarding
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSaveAndExit}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save & Exit</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}