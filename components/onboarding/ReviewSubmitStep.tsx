"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  FileText,
  MapPin,
  DollarSign,
  Calendar,
  Camera,
  Package,
  Clock,
  AlertCircle
} from "lucide-react";
import Image from "next/image";
import type { OnboardingData } from "@/app/become-a-provider/onboarding/page";

interface ReviewSubmitStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ReviewSubmitStep({
  data,
  updateData,
  errors,
}: ReviewSubmitStepProps) {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? "AM" : "PM";
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const getActiveScheduleSummary = (): string | Array<{ days: string; times: string }> => {
    const activeDays = Object.entries(data.weeklySchedule)
      .filter(([_, schedule]) => schedule.isActive)
      .map(([day, schedule]) => ({
        day: DAYS_OF_WEEK[parseInt(day)],
        times: `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`,
      }));

    if (activeDays.length === 0) {
      return "No availability set";
    }

    // Group consecutive days with same times
    const grouped: Array<{ days: string; times: string }> = [];
    
    for (let i = 0; i < activeDays.length; i++) {
      const currentDay = activeDays[i];
      const currentTimes = currentDay.times;
      const consecutiveDays = [currentDay.day];
      
      // Look ahead for consecutive days with same times
      let j = i + 1;
      while (j < activeDays.length && activeDays[j].times === currentTimes) {
        consecutiveDays.push(activeDays[j].day);
        j++;
      }
      
      // Format the days string
      const daysStr = consecutiveDays.length > 1
        ? `${consecutiveDays[0]}-${consecutiveDays[consecutiveDays.length - 1]}`
        : consecutiveDays[0];
        
      grouped.push({ days: daysStr, times: currentTimes });
      
      // Skip the processed days
      i = j - 1;
    }

    return grouped;
  };

  return (
    <div className="space-y-6">
      {/* Profile Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Preview</CardTitle>
          <CardDescription>
            Review your information before submitting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Basic Information</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-gray-600 min-w-[100px]">Name:</span>
                <span className="font-medium">{data.displayName || "Not set"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-600 min-w-[100px]">Tagline:</span>
                <span>{data.tagline || "Not set"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-600 min-w-[100px]">Bio:</span>
                <span className="line-clamp-2">{data.bio || "Not set"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-600 min-w-[100px]">Experience:</span>
                <span>{data.yearsExperience} year(s)</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Location</h3>
            </div>
            <div className="text-sm">
              {data.locationCity}, {data.locationState}
            </div>
          </div>

          <Separator />

          {/* Services Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Services ({data.services.length})</h3>
            </div>
            {data.services.length > 0 ? (
              <div className="space-y-2">
                {data.services.map((service, index) => (
                  <div key={index} className="flex justify-between items-start text-sm">
                    <div>
                      <div className="font-medium">{service.name}</div>
                      <div className="text-gray-600">
                        {formatDuration(service.duration)}
                      </div>
                    </div>
                    <Badge variant="secondary">${service.price}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No services added</p>
            )}
          </div>

          <Separator />

          {/* Pricing Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Pricing</h3>
            </div>
            <div className="text-sm">
              Base hourly rate: <span className="font-medium">${data.hourlyRate}/hour</span>
            </div>
          </div>

          <Separator />

          {/* Availability Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Availability</h3>
            </div>
            <div className="space-y-1 text-sm">
              {(() => {
                const summary = getActiveScheduleSummary();
                if (typeof summary === "string") {
                  return <p className="text-gray-600">{summary}</p>;
                } else {
                  return summary.map((schedule, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="font-medium min-w-[80px]">{schedule.days}:</span>
                      <span className="text-gray-600">{schedule.times}</span>
                    </div>
                  ));
                }
              })()}
            </div>
          </div>

          <Separator />

          {/* Media Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold">Profile Media</h3>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                {data.profileImageUrl ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span>Profile Photo</span>
              </div>
              <div className="flex items-center gap-2">
                {data.coverImageUrl ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span>Cover Image</span>
              </div>
              <div className="flex items-center gap-2">
                {data.galleryImages && data.galleryImages.length > 0 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{data.galleryImages.length} Gallery Images</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <span>No Gallery Images</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions</CardTitle>
          <CardDescription>
            Please review and accept our terms to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 max-h-48 overflow-y-auto">
            <h4 className="font-semibold mb-2">Provider Agreement</h4>
            <p className="mb-2">
              By joining our platform as a service provider, you agree to:
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Provide accurate and truthful information in your profile</li>
              <li>Deliver services as described and scheduled</li>
              <li>Maintain professional conduct with all customers</li>
              <li>Accept the platform&apos;s 15% commission on all bookings</li>
              <li>Respond to customer inquiries within 24 hours</li>
              <li>Maintain a minimum 4.0 star rating (subject to review)</li>
              <li>Comply with all local laws and regulations for your services</li>
              <li>Not circumvent the platform for direct bookings with customers met through the platform</li>
            </ul>
            <p className="mt-2">
              The platform reserves the right to suspend or terminate accounts that violate these terms.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={data.termsAccepted}
              onCheckedChange={(checked) => updateData({ termsAccepted: checked as boolean })}
              className={errors.terms ? "border-red-500" : ""}
            />
            <div className="space-y-1">
              <Label htmlFor="terms" className="cursor-pointer">
                I accept the terms and conditions <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-600">
                You must accept the terms to create your provider profile
              </p>
              {errors.terms && (
                <p className="text-sm text-red-500">{errors.terms}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>What happens next?</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Your profile will be created and published immediately</li>
            <li>• You&apos;ll be redirected to your provider dashboard</li>
            <li>• Next step: Set up Stripe Connect to receive payments (coming soon)</li>
            <li>• You can edit your profile anytime from the dashboard</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}