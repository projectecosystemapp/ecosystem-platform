/**
 * Basic Information Step Component
 * 
 * Collects provider's basic information including name, bio, location, and experience
 */

"use client";

import { useProviderOnboardingStore } from "@/lib/stores/provider-onboarding-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export default function BasicInfoStep() {
  const { basicInfo, locationInfo, updateBasicInfo, updateLocationInfo, stepValidation, currentStep } = useProviderOnboardingStore();
  const validation = stepValidation[currentStep];

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          This information will be displayed on your public provider profile.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Display Name */}
        <div>
          <Label htmlFor="displayName">
            Display Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="displayName"
            value={basicInfo.displayName || ''}
            onChange={(e) => updateBasicInfo({ displayName: e.target.value })}
            placeholder="John Smith"
            className={validation?.errors?.displayName ? "border-red-500" : ""}
            aria-describedby="displayName-error"
            required
          />
          {validation?.errors?.displayName && (
            <p id="displayName-error" className="text-sm text-red-500 mt-1">
              {validation.errors.displayName}
            </p>
          )}
        </div>

        {/* Tagline */}
        <div>
          <Label htmlFor="tagline">
            Professional Tagline <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tagline"
            value={basicInfo.tagline || ''}
            onChange={(e) => updateBasicInfo({ tagline: e.target.value })}
            placeholder="Experienced plumber specializing in residential repairs"
            maxLength={200}
            className={validation?.errors?.tagline ? "border-red-500" : ""}
            aria-describedby="tagline-error"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            {(basicInfo.tagline?.length || 0)}/200 characters
          </p>
          {validation?.errors?.tagline && (
            <p id="tagline-error" className="text-sm text-red-500 mt-1">
              {validation.errors.tagline}
            </p>
          )}
        </div>

        {/* Bio */}
        <div>
          <Label htmlFor="bio">
            Professional Bio <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="bio"
            value={basicInfo.bio || ''}
            onChange={(e) => updateBasicInfo({ bio: e.target.value })}
            placeholder="Tell potential customers about your experience, qualifications, and what makes you unique..."
            rows={5}
            maxLength={2000}
            className={validation?.errors?.bio ? "border-red-500" : ""}
            aria-describedby="bio-error"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            {(basicInfo.bio?.length || 0)}/2000 characters
          </p>
          {validation?.errors?.bio && (
            <p id="bio-error" className="text-sm text-red-500 mt-1">
              {validation.errors.bio}
            </p>
          )}
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="locationCity">
              City <span className="text-red-500">*</span>
            </Label>
            <Input
              id="locationCity"
              value={locationInfo.city || ''}
              onChange={(e) => updateLocationInfo({ city: e.target.value })}
              placeholder="San Francisco"
              className={validation?.errors?.locationCity ? "border-red-500" : ""}
              required
            />
            {validation?.errors?.locationCity && (
              <p className="text-sm text-red-500 mt-1">
                {validation.errors.locationCity}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="locationState">
              State/Province <span className="text-red-500">*</span>
            </Label>
            <Input
              id="locationState"
              value={locationInfo.state || ''}
              onChange={(e) => updateLocationInfo({ state: e.target.value })}
              placeholder="CA"
              className={validation?.errors?.locationState ? "border-red-500" : ""}
              required
            />
            {validation?.errors?.locationState && (
              <p className="text-sm text-red-500 mt-1">
                {validation.errors.locationState}
              </p>
            )}
          </div>
        </div>

        {/* Experience and Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="yearsOfExperience">Years of Experience</Label>
            <Input
              id="yearsOfExperience"
              type="number"
              min="0"
              max="100"
              value={basicInfo.yearsOfExperience || ""}
              onChange={(e) => updateBasicInfo({ 
                yearsOfExperience: e.target.value ? Number(e.target.value) : undefined 
              })}
              placeholder="5"
            />
          </div>
          
          <div>
            <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
            <Input
              id="hourlyRate"
              type="number"
              min="10"
              max="1000"
              value={basicInfo.hourlyRate ? basicInfo.hourlyRate / 100 : ""}
              onChange={(e) => updateBasicInfo({ 
                hourlyRate: e.target.value ? Number(e.target.value) * 100 : undefined 
              })}
              placeholder="75"
            />
          </div>
        </div>
      </div>
    </div>
  );
}