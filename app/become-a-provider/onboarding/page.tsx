"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight,
  Check,
  Loader2 
} from "lucide-react";

// Import step components
import BasicInformationStep from "@/components/onboarding/BasicInformationStep";
import ServicesPricingStep from "@/components/onboarding/ServicesPricingStep";
import AvailabilityStep from "@/components/onboarding/AvailabilityStep";
import ProfileMediaStep from "@/components/onboarding/ProfileMediaStep";
import ReviewSubmitStep from "@/components/onboarding/ReviewSubmitStep";

// Import actions
import { createProviderAction, updateProviderAction, updateProviderImagesAction } from "@/actions/providers-actions";
import { setWeeklyScheduleAction } from "@/actions/availability-actions";

export type OnboardingData = {
  // Basic Information
  displayName: string;
  tagline: string;
  bio: string;
  locationCity: string;
  locationState: string;
  yearsExperience: number;
  
  // Services & Pricing
  services: Array<{
    name: string;
    description: string;
    duration: number;
    price: number;
  }>;
  hourlyRate: number;
  currency: string;
  
  // Availability
  weeklySchedule: {
    [key: number]: {
      startTime: string;
      endTime: string;
      isActive: boolean;
    };
  };
  timezone: string;
  
  // Profile Media
  profileImageUrl?: string;
  coverImageUrl?: string;
  galleryImages?: string[];
  
  // Terms
  termsAccepted: boolean;
};

const STEPS = [
  { id: 1, title: "Basic Information", description: "Tell us about yourself" },
  { id: 2, title: "Services & Pricing", description: "What do you offer?" },
  { id: 3, title: "Availability", description: "When can customers book you?" },
  { id: 4, title: "Profile Media", description: "Add photos to your profile" },
  { id: 5, title: "Review & Submit", description: "Review your profile" },
];

const INITIAL_DATA: OnboardingData = {
  displayName: "",
  tagline: "",
  bio: "",
  locationCity: "",
  locationState: "",
  yearsExperience: 1,
  services: [],
  hourlyRate: 50,
  currency: "usd",
  weeklySchedule: {
    0: { startTime: "09:00", endTime: "17:00", isActive: false }, // Sunday
    1: { startTime: "09:00", endTime: "17:00", isActive: true },  // Monday
    2: { startTime: "09:00", endTime: "17:00", isActive: true },  // Tuesday
    3: { startTime: "09:00", endTime: "17:00", isActive: true },  // Wednesday
    4: { startTime: "09:00", endTime: "17:00", isActive: true },  // Thursday
    5: { startTime: "09:00", endTime: "17:00", isActive: true },  // Friday
    6: { startTime: "09:00", endTime: "17:00", isActive: false }, // Saturday
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  termsAccepted: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load saved progress from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("providerOnboardingData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData({ ...INITIAL_DATA, ...parsed });
      } catch (error) {
        console.error("Failed to load saved progress:", error);
      }
    }
  }, []);

  // Save progress to localStorage whenever form data changes
  useEffect(() => {
    localStorage.setItem("providerOnboardingData", JSON.stringify(formData));
  }, [formData]);

  // Redirect if not signed in
  useEffect(() => {
    if (!isSignedIn) {
      router.push("/login?redirectUrl=/become-a-provider/onboarding");
    }
  }, [isSignedIn, router]);

  const updateFormData = (updates: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear relevant errors
    const updatedKeys = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedKeys.forEach(key => delete newErrors[key]);
      return newErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.displayName) newErrors.displayName = "Display name is required";
        if (!formData.tagline) newErrors.tagline = "Tagline is required";
        if (!formData.bio) newErrors.bio = "Bio is required";
        if (!formData.locationCity) newErrors.locationCity = "City is required";
        if (!formData.locationState) newErrors.locationState = "State is required";
        break;
      
      case 2:
        if (formData.services.length === 0) {
          newErrors.services = "Add at least one service";
        }
        if (formData.hourlyRate <= 0) {
          newErrors.hourlyRate = "Hourly rate must be greater than 0";
        }
        break;
      
      case 3:
        const hasActiveDay = Object.values(formData.weeklySchedule).some(day => day.isActive);
        if (!hasActiveDay) {
          newErrors.availability = "Set availability for at least one day";
        }
        break;
      
      case 4:
        // Profile media is optional, so no validation needed
        break;
      
      case 5:
        if (!formData.termsAccepted) {
          newErrors.terms = "You must accept the terms to continue";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Create provider profile
      const providerResult = await createProviderAction({
        displayName: formData.displayName,
        tagline: formData.tagline,
        bio: formData.bio,
        locationCity: formData.locationCity,
        locationState: formData.locationState,
        hourlyRate: formData.hourlyRate,
        services: formData.services,
      });

      if (!providerResult.isSuccess || !providerResult.data) {
        throw new Error(providerResult.message);
      }

      const providerId = providerResult.data.id;

      // Set availability schedule (convert object to array)
      const scheduleArray = Object.entries(formData.weeklySchedule).map(([day, schedule]) => ({
        ...schedule,
        dayOfWeek: parseInt(day)
      }));
      const availabilityResult = await setWeeklyScheduleAction(providerId, scheduleArray);
      
      if (!availabilityResult.success) {
        console.error("Failed to set availability:", availabilityResult.error || "Unknown error");
      }

      // Update images if provided
      if (formData.profileImageUrl) {
        await updateProviderImagesAction("profile", formData.profileImageUrl);
      }
      if (formData.coverImageUrl) {
        await updateProviderImagesAction("cover", formData.coverImageUrl);
      }
      if (formData.galleryImages && formData.galleryImages.length > 0) {
        await updateProviderImagesAction("gallery", formData.galleryImages);
      }

      // Clear saved progress
      localStorage.removeItem("providerOnboardingData");

      // Show success message
      toast.success("Profile created successfully!");

      // Redirect to provider dashboard
      router.push("/dashboard/provider?welcome=true");
    } catch (error) {
      console.error("Failed to create provider profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Provider Onboarding</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Are you sure you want to exit? Your progress will be saved.")) {
                  router.push("/");
                }
              }}
            >
              Save & Exit
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center ${
                  step.id < currentStep ? "text-green-600" : 
                  step.id === currentStep ? "text-blue-600" : 
                  "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step.id < currentStep 
                      ? "bg-green-600 border-green-600 text-white" 
                      : step.id === currentStep
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                {step.id < STEPS.length && (
                  <div
                    className={`hidden sm:block w-full h-0.5 ${
                      step.id < currentStep ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <BasicInformationStep
                data={formData}
                updateData={updateFormData}
                errors={errors}
              />
            )}
            {currentStep === 2 && (
              <ServicesPricingStep
                data={formData}
                updateData={updateFormData}
                errors={errors}
              />
            )}
            {currentStep === 3 && (
              <AvailabilityStep
                data={formData}
                updateData={updateFormData}
                errors={errors}
              />
            )}
            {currentStep === 4 && (
              <ProfileMediaStep
                data={formData}
                updateData={updateFormData}
                errors={errors}
              />
            )}
            {currentStep === 5 && (
              <ReviewSubmitStep
                data={formData}
                updateData={updateFormData}
                errors={errors}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                <>
                  Submit Application
                  <Check className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}