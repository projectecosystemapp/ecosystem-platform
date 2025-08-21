"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, MapPin, Calendar, FileText } from "lucide-react";
import type { OnboardingData } from "@/app/become-a-provider/onboarding/page";

interface BasicInformationStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export default function BasicInformationStep({
  data,
  updateData,
  errors,
}: BasicInformationStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Tell customers about yourself and your expertise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="displayName"
              value={data.displayName}
              onChange={(e) => updateData({ displayName: e.target.value })}
              placeholder="John Smith Photography"
              className={errors.displayName ? "border-red-500" : ""}
            />
            {errors.displayName && (
              <p className="text-sm text-red-500">{errors.displayName}</p>
            )}
            <p className="text-sm text-gray-600">
              This is how customers will see your business name
            </p>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <Label htmlFor="tagline">
              Tagline <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tagline"
              value={data.tagline}
              onChange={(e) => updateData({ tagline: e.target.value })}
              placeholder="Professional photography for all occasions"
              maxLength={80}
              className={errors.tagline ? "border-red-500" : ""}
            />
            {errors.tagline && (
              <p className="text-sm text-red-500">{errors.tagline}</p>
            )}
            <p className="text-sm text-gray-600">
              A short description that appears under your name ({data.tagline.length}/80)
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">
              Bio <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="bio"
              value={data.bio}
              onChange={(e) => updateData({ bio: e.target.value })}
              placeholder="Tell customers about your experience, approach, and what makes you unique..."
              rows={6}
              className={errors.bio ? "border-red-500" : ""}
            />
            {errors.bio && (
              <p className="text-sm text-red-500">{errors.bio}</p>
            )}
            <p className="text-sm text-gray-600">
              Describe your services and experience in detail (minimum 100 characters)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location
          </CardTitle>
          <CardDescription>
            Where do you provide services?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="locationCity">
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="locationCity"
                value={data.locationCity}
                onChange={(e) => updateData({ locationCity: e.target.value })}
                placeholder="San Francisco"
                className={errors.locationCity ? "border-red-500" : ""}
              />
              {errors.locationCity && (
                <p className="text-sm text-red-500">{errors.locationCity}</p>
              )}
            </div>

            {/* State */}
            <div className="space-y-2">
              <Label htmlFor="locationState">
                State <span className="text-red-500">*</span>
              </Label>
              <Select
                value={data.locationState}
                onValueChange={(value) => updateData({ locationState: value })}
              >
                <SelectTrigger 
                  id="locationState"
                  className={errors.locationState ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.locationState && (
                <p className="text-sm text-red-500">{errors.locationState}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Experience
          </CardTitle>
          <CardDescription>
            How long have you been providing this service?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="yearsExperience">Years of Experience</Label>
            <Select
              value={data.yearsExperience.toString()}
              onValueChange={(value) => updateData({ yearsExperience: parseInt(value) })}
            >
              <SelectTrigger id="yearsExperience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Less than 1 year</SelectItem>
                <SelectItem value="2">1-2 years</SelectItem>
                <SelectItem value="3">3-5 years</SelectItem>
                <SelectItem value="5">5-10 years</SelectItem>
                <SelectItem value="10">10+ years</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">
              This helps build trust with potential customers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          <strong>Tips for a great profile:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Use your real name or business name that customers will recognize</li>
            <li>• Write a compelling bio that highlights your unique value proposition</li>
            <li>• Be specific about your location to attract local customers</li>
            <li>• Honest experience levels build trust with customers</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}