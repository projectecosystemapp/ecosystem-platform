/**
 * Provider Onboarding Wizard
 * 
 * Business Context:
 * - Main container for the provider onboarding flow
 * - Manages state through zustand store
 * - Handles form submission and API calls
 * - Provides responsive, accessible multi-step form
 * 
 * Technical Decisions:
 * - Uses provider-onboarding-store for state management
 * - Implements smooth transitions with Framer Motion
 * - Full keyboard navigation support
 * - Mobile-first responsive design
 * 
 * @see /lib/stores/provider-onboarding-store.ts
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  useProviderOnboardingStore,
  OnboardingStep,
  useCurrentStepValidation,
  useCanSubmitForm,
  useOnboardingProgress,
} from "@/lib/stores/provider-onboarding-store";
import { createProviderAction } from "@/actions/providers-actions";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import OnboardingProgress from "./OnboardingProgress";
import OnboardingNavigation from "./OnboardingNavigation";

// Import step components - these will be created separately
import BasicInfoStep from "./steps/BasicInfoStep";
import ServicesStep from "./steps/ServicesStep";
import AvailabilityStep from "./steps/AvailabilityStep";
import ImagesStep from "./steps/ImagesStep";
import StripeSetupStep from "./steps/StripeSetupStep";
import ReviewStep from "./steps/ReviewStep";

// Step configuration
const STEP_CONFIG = {
  [OnboardingStep.BASIC_INFO]: {
    title: "Basic Information",
    description: "Tell us about yourself and your expertise",
    component: BasicInfoStep,
  },
  [OnboardingStep.LOCATION]: {
    title: "Location",
    description: "Where do you provide services",
    component: BasicInfoStep,
  },
  [OnboardingStep.SERVICES]: {
    title: "Services & Pricing",
    description: "Define what services you offer and their pricing",
    component: ServicesStep,
  },
  [OnboardingStep.AVAILABILITY]: {
    title: "Availability",
    description: "Set your weekly availability schedule",
    component: AvailabilityStep,
  },
  [OnboardingStep.PAYMENT]: {
    title: "Payment Setup",
    description: "Connect your Stripe account to receive payments",
    component: StripeSetupStep,
  },
  [OnboardingStep.ADDITIONAL]: {
    title: "Profile Media",
    description: "Add photos to make your profile stand out",
    component: ImagesStep,
  },
  [OnboardingStep.REVIEW]: {
    title: "Review & Submit",
    description: "Review your information and submit your profile",
    component: ReviewStep,
  },
};

export default function OnboardingWizard() {
  const router = useRouter();
  const { userId, isSignedIn, isLoaded } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  
  // Store hooks
  const {
    currentStep,
    isSubmitting,
    submitError,
    setSubmitting,
    setSubmitError,
    validateStep,
    goToStep,
    basicInfo,
    locationInfo,
    servicesInfo,
    availabilityInfo,
    paymentInfo,
    additionalInfo,
  } = useProviderOnboardingStore();
  
  const currentStepValidation = useCurrentStepValidation();
  const canSubmit = useCanSubmitForm();
  const progressPercentage = useOnboardingProgress();

  // Check if user is signed in and redirect if not
  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        router.push("/login?redirectUrl=/become-a-provider");
      } else {
        setIsChecking(false);
      }
    }
  }, [isSignedIn, isLoaded, router]);

  // Check for existing provider profile
  useEffect(() => {
    if (userId && isSignedIn) {
      fetch("/api/providers/check-existing", {
        method: "GET",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.hasProfile) {
            toast.info("You already have a provider profile");
            router.push("/dashboard/provider");
          }
        })
        .catch((error) => {
          console.error("Error checking existing profile:", error);
        });
    }
  }, [userId, isSignedIn, router]);

  // Handle step validation before navigation
  const handleStepChange = async (newStep: OnboardingStep) => {
    // If moving forward, validate current step
    if (newStep > currentStep) {
      const isValid = validateStep(currentStep);
      if (!isValid) {
        toast.error("Please complete all required fields before proceeding");
        return;
      }
      // Step completion is tracked automatically by the store
    }
    
    goToStep(newStep);
  };

  // Handle final submission
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Validate all steps
      const stepsToValidate = [
        OnboardingStep.BASIC_INFO,
        OnboardingStep.SERVICES,
        OnboardingStep.AVAILABILITY,
        OnboardingStep.PAYMENT,
      ];

      for (const step of stepsToValidate) {
        const isValid = validateStep(step);
        if (!isValid) {
          goToStep(step);
          throw new Error(`Please complete step ${step} before submitting`);
        }
      }

      // Create provider profile
      const providerData = {
        displayName: basicInfo.displayName || '',
        tagline: basicInfo.tagline,
        bio: basicInfo.bio,
        locationCity: locationInfo.city,
        locationState: locationInfo.state,
        locationCountry: locationInfo.country,
        yearsExperience: basicInfo.yearsOfExperience,
        hourlyRate: basicInfo.hourlyRate,
        services: (servicesInfo.services || []).map((service) => ({
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price,
        })),
      };

      const result = await createProviderAction(providerData);

      if (!result.isSuccess) {
        throw new Error(result.message || "Failed to create provider profile");
      }

      // TODO: Set availability schedule
      // TODO: Upload images if provided
      // TODO: Complete Stripe Connect onboarding

      toast.success("Provider profile created successfully!");
      
      // Clear the form data from localStorage
      localStorage.removeItem("provider-onboarding-storage");
      
      // Redirect to provider dashboard
      router.push("/dashboard/provider?welcome=true");
    } catch (error) {
      console.error("Submission error:", error);
      setSubmitError(error instanceof Error ? error.message : "An error occurred");
      toast.error(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = STEP_CONFIG[currentStep].component;
  const stepConfig = STEP_CONFIG[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Progress Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <OnboardingProgress
            currentStep={currentStep}
            onStepClick={handleStepChange}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {stepConfig.title}
          </h1>
          <p className="text-lg text-gray-600">
            {stepConfig.description}
          </p>
        </div>

        {/* Error Alert */}
        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <Card className="mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="p-6 sm:p-8"
            >
              <CurrentStepComponent />
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Navigation */}
        <OnboardingNavigation
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </main>

      {/* Keyboard Navigation Instructions */}
      <div className="sr-only" role="status" aria-live="polite">
        Use Tab to navigate between fields, Enter to submit, and arrow keys to navigate between steps
      </div>
    </div>
  );
}