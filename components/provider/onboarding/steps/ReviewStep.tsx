/**
 * Review Step Component
 * 
 * Final review of all provider information before submission
 */

"use client";

import { useProviderOnboardingStore, OnboardingStep, ProviderService, WeeklyAvailability } from "@/lib/stores/provider-onboarding-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Edit, 
  MapPin, 
  Clock, 
  DollarSign,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  User,
  Briefcase
} from "lucide-react";
import Image from "next/image";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ReviewStep() {
  const {
    basicInfo,
    servicesInfo,
    availabilityInfo,
    locationInfo,
    paymentInfo,
    images,
    goToStep,
    completedSteps,
  } = useProviderOnboardingStore();

  const isComplete = (step: OnboardingStep) => completedSteps.includes(step);
  
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hour), parseInt(minute));
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please review all your information before submitting. You can click Edit to make changes to any section.
        </AlertDescription>
      </Alert>

      {/* Basic Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep(OnboardingStep.BASIC_INFO)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Image and Name */}
          <div className="flex items-start gap-4">
            {images.profileImageUrl ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={images.profileImageUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{basicInfo.displayName || "Not set"}</h3>
              <p className="text-gray-600">{basicInfo.tagline || "No tagline"}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {locationInfo.city}, {locationInfo.state}
                </span>
                {basicInfo.yearsOfExperience && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {basicInfo.yearsOfExperience} years experience
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Bio */}
          <div>
            <h4 className="font-medium mb-1">About</h4>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {basicInfo.bio || "No bio provided"}
            </p>
          </div>

          {/* Status */}
          <div className="flex justify-end">
            {isComplete(OnboardingStep.BASIC_INFO) ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary">Incomplete</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services & Pricing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Services & Pricing
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep(OnboardingStep.SERVICES)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {servicesInfo.services && servicesInfo.services.length > 0 ? (
            <div className="space-y-3">
              {servicesInfo.services.map((service: ProviderService) => (
                <div key={service.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{service.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {service.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{formatPrice(service.price)}</p>
                      <p className="text-sm text-gray-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {service.duration} min
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No services added</p>
          )}

          {/* Hourly Rate */}
          {basicInfo.hourlyRate && (
            <div className="pt-3 border-t">
              <span className="text-sm text-gray-600">Hourly Rate: </span>
              <span className="font-semibold">
                {formatPrice(basicInfo.hourlyRate)}/hour
              </span>
            </div>
          )}

          {/* Status */}
          <div className="flex justify-end">
            {isComplete(OnboardingStep.SERVICES) ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary">Incomplete</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Availability
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep(OnboardingStep.AVAILABILITY)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {availabilityInfo.weeklySchedule && availabilityInfo.weeklySchedule.map((day: WeeklyAvailability) => (
              <div
                key={day.dayOfWeek}
                className={`text-center p-2 rounded-lg ${
                  day.isActive ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                }`}
              >
                <p className="text-xs font-medium mb-1">
                  {DAYS[day.dayOfWeek]}
                </p>
                {day.isActive ? (
                  <div className="text-xs text-gray-600">
                    <p>{formatTime(day.startTime)}</p>
                    <p>-</p>
                    <p>{formatTime(day.endTime)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Closed</p>
                )}
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="flex justify-end">
            {isComplete(OnboardingStep.AVAILABILITY) ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary">Incomplete</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Setup */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Setup
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep(OnboardingStep.PAYMENT)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Stripe Account</span>
              {paymentInfo.stripeConnectAccountId ? (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not Connected</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Charges Enabled</span>
              {paymentInfo.stripeOnboardingComplete ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Payouts Enabled</span>
              {paymentInfo.stripeOnboardingComplete ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex justify-end mt-4">
            {isComplete(OnboardingStep.PAYMENT) ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary">Incomplete</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gallery Preview */}
      {images.galleryImages.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Gallery Preview</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToStep(OnboardingStep.ADDITIONAL)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {images.galleryImages.slice(0, 4).map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                  <Image
                    src={img}
                    alt={`Gallery ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            {images.galleryImages.length > 4 && (
              <p className="text-sm text-gray-500 mt-2">
                +{images.galleryImages.length - 4} more photos
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submission Readiness */}
      <Alert className={
        [OnboardingStep.BASIC_INFO, OnboardingStep.SERVICES, OnboardingStep.AVAILABILITY, OnboardingStep.PAYMENT]
          .every(step => completedSteps.includes(step))
          ? "bg-green-50 border-green-200"
          : "bg-yellow-50 border-yellow-200"
      }>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {[OnboardingStep.BASIC_INFO, OnboardingStep.SERVICES, OnboardingStep.AVAILABILITY, OnboardingStep.PAYMENT]
            .every(step => completedSteps.includes(step)) ? (
            <span className="text-green-800">
              All required information is complete. You're ready to submit your application!
            </span>
          ) : (
            <span className="text-yellow-800">
              Please complete all required sections before submitting your application.
            </span>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}