"use client";

import { useState, useCallback } from "react";
import { Provider } from "@/db/schema/providers-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProviderProfileAction } from "@/actions/providers-actions";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, MapPin, DollarSign, Award } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

// Validation schema
const basicInfoSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters").max(100),
  tagline: z.string().max(150, "Tagline must be 150 characters or less").optional(),
  bio: z.string().max(1000, "Bio must be 1000 characters or less").optional(),
  locationCity: z.string().max(100).optional(),
  locationState: z.string().max(100).optional(),
  locationCountry: z.string().default("US"),
  hourlyRate: z.coerce
    .number()
    .min(0, "Rate must be positive")
    .max(10000, "Rate seems too high")
    .optional(),
  yearsExperience: z.coerce
    .number()
    .int()
    .min(0, "Experience must be positive")
    .max(100, "Experience seems too high")
    .optional(),
});

type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

interface BasicInfoSectionProps {
  provider: Provider;
  onUpdate: (provider: Provider) => void;
  onSaveStart: () => void;
  onSaveError: (error: string) => void;
}

// US States for select dropdown
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

export function BasicInfoSection({
  provider,
  onUpdate,
  onSaveStart,
  onSaveError,
}: BasicInfoSectionProps) {
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const form = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      displayName: provider.displayName,
      tagline: provider.tagline || "",
      bio: provider.bio || "",
      locationCity: provider.locationCity || "",
      locationState: provider.locationState || "",
      locationCountry: provider.locationCountry || "US",
      hourlyRate: provider.hourlyRate ? parseFloat(provider.hourlyRate) : undefined,
      yearsExperience: provider.yearsExperience || undefined,
    },
  });

  // Auto-save with debounce
  const debouncedSave = useDebouncedCallback(
    async (data: BasicInfoFormData) => {
      setIsAutoSaving(true);
      onSaveStart();

      try {
        const result = await updateProviderProfileAction(provider.id, {
          displayName: data.displayName,
          tagline: data.tagline || null,
          bio: data.bio || null,
          locationCity: data.locationCity || null,
          locationState: data.locationState || null,
          locationCountry: data.locationCountry,
          hourlyRate: data.hourlyRate?.toString() || null,
          yearsExperience: data.yearsExperience || null,
        });

        if (result.isSuccess && result.data) {
          onUpdate(result.data);
          toast.success("Basic info updated");
        } else {
          onSaveError(result.message || "Failed to update profile");
        }
      } catch (error) {
        onSaveError("An unexpected error occurred");
      } finally {
        setIsAutoSaving(false);
      }
    },
    2000 // 2 second debounce
  );

  // Handle form field changes
  const handleFieldChange = useCallback(
    (data: BasicInfoFormData) => {
      if (form.formState.isValid) {
        debouncedSave(data);
      }
    },
    [debouncedSave, form.formState.isValid]
  );

  // Manual save
  const onSubmit = async (data: BasicInfoFormData) => {
    onSaveStart();

    try {
      const result = await updateProviderProfileAction(provider.id, {
        displayName: data.displayName,
        tagline: data.tagline || null,
        bio: data.bio || null,
        locationCity: data.locationCity || null,
        locationState: data.locationState || null,
        locationCountry: data.locationCountry,
        hourlyRate: data.hourlyRate?.toString() || null,
        yearsExperience: data.yearsExperience || null,
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        toast.success("Profile updated successfully");
      } else {
        onSaveError(result.message || "Failed to update profile");
      }
    } catch (error) {
      onSaveError("An unexpected error occurred");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          {/* Display Name */}
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="John Smith"
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange(form.getValues());
                    }}
                  />
                </FormControl>
                <FormDescription>
                  This is how customers will see your name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tagline */}
          <FormField
            control={form.control}
            name="tagline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tagline</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Professional service provider with 10+ years experience"
                    maxLength={150}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange(form.getValues());
                    }}
                  />
                </FormControl>
                <FormDescription>
                  A short description that appears below your name ({field.value?.length || 0}/150)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Bio */}
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Tell customers about yourself, your experience, and what makes you unique..."
                    rows={6}
                    maxLength={1000}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange(form.getValues());
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Detailed description about you and your services ({field.value?.length || 0}/1000)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="locationCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="San Francisco"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange(form.getValues());
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleFieldChange(form.getValues());
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Pricing & Experience */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Hourly Rate
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="75.00"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange(form.getValues());
                        }}
                      />
                    </FormControl>
                    <FormDescription>Your base hourly rate in USD</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yearsExperience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Years of Experience
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="5"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange(form.getValues());
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      How many years you've been in this field
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Save Button (for manual save) */}
        <div className="flex items-center justify-between border-t pt-6">
          <p className="text-sm text-muted-foreground">
            {isAutoSaving ? "Auto-saving..." : "Changes auto-save as you type"}
          </p>
          <Button type="submit" disabled={isAutoSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}