"use client";

import { useState, useEffect } from "react";
import { Provider } from "@/db/schema/providers-schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getProviderAvailabilityAction, setProviderAvailabilityAction } from "@/actions/providers-actions";
import { Calendar, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TimeSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilitySectionProps {
  provider: Provider;
  onUpdate: (provider: Provider) => void;
  onSaveStart: () => void;
  onSaveError: (error: string) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Default business hours
const DEFAULT_HOURS = {
  startTime: "09:00",
  endTime: "17:00",
};

export function AvailabilitySection({
  provider,
  onUpdate,
  onSaveStart,
  onSaveError,
}: AvailabilitySectionProps) {
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load availability on mount
  useEffect(() => {
    loadAvailability();
  }, [provider.id]);

  const loadAvailability = async () => {
    try {
      const result = await getProviderAvailabilityAction(provider.id);
      
      if (result.isSuccess && result.data) {
        // Convert to TimeSlot array
        const slots: TimeSlot[] = DAYS_OF_WEEK.map(day => {
          const existing = result.data?.find(a => a.dayOfWeek === day.value);
          if (existing) {
            return {
              dayOfWeek: day.value,
              startTime: existing.startTime,
              endTime: existing.endTime,
              isActive: existing.isActive,
            };
          }
          // Default slot if not exists
          return {
            dayOfWeek: day.value,
            startTime: DEFAULT_HOURS.startTime,
            endTime: DEFAULT_HOURS.endTime,
            isActive: false,
          };
        });
        setAvailability(slots);
      } else {
        // Initialize with default slots
        const defaultSlots: TimeSlot[] = DAYS_OF_WEEK.map(day => ({
          dayOfWeek: day.value,
          startTime: DEFAULT_HOURS.startTime,
          endTime: DEFAULT_HOURS.endTime,
          isActive: day.value >= 1 && day.value <= 5, // Monday-Friday default
        }));
        setAvailability(defaultSlots);
      }
    } catch (error) {
      toast.error("Failed to load availability");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle day toggle
  const handleDayToggle = (dayOfWeek: number, checked: boolean) => {
    setAvailability(prev =>
      prev.map(slot =>
        slot.dayOfWeek === dayOfWeek
          ? { ...slot, isActive: checked }
          : slot
      )
    );
    setHasChanges(true);
  };

  // Handle time change
  const handleTimeChange = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability(prev =>
      prev.map(slot =>
        slot.dayOfWeek === dayOfWeek
          ? { ...slot, [field]: value }
          : slot
      )
    );
    setHasChanges(true);
  };

  // Apply time to all days
  const applyToAllDays = (sourceDay: number) => {
    const sourceSlot = availability.find(s => s.dayOfWeek === sourceDay);
    if (!sourceSlot) return;

    setAvailability(prev =>
      prev.map(slot => ({
        ...slot,
        startTime: sourceSlot.startTime,
        endTime: sourceSlot.endTime,
      }))
    );
    setHasChanges(true);
    toast.success("Applied time to all days");
  };

  // Apply weekday hours to weekend
  const applyWeekdayHours = () => {
    const mondaySlot = availability.find(s => s.dayOfWeek === 1);
    if (!mondaySlot) return;

    setAvailability(prev =>
      prev.map(slot => {
        if (slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5) {
          return {
            ...slot,
            startTime: mondaySlot.startTime,
            endTime: mondaySlot.endTime,
            isActive: true,
          };
        }
        return slot;
      })
    );
    setHasChanges(true);
    toast.success("Applied weekday hours");
  };

  // Save availability
  const handleSave = async () => {
    onSaveStart();

    try {
      // Only send active slots
      const activeSlots = availability
        .filter(slot => slot.isActive)
        .map(slot => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }));

      const result = await setProviderAvailabilityAction(provider.id, activeSlots);

      if (result.isSuccess) {
        toast.success("Availability updated successfully");
        setHasChanges(false);
        // Update provider to trigger parent component update
        onUpdate(provider);
      } else {
        onSaveError(result.message || "Failed to update availability");
      }
    } catch (error) {
      onSaveError("An unexpected error occurred");
    }
  };

  // Validate time range
  const isValidTimeRange = (startTime: string, endTime: string) => {
    return startTime < endTime;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Weekly Availability</h3>
        <p className="text-sm text-muted-foreground">
          Set your regular working hours for each day of the week
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={applyWeekdayHours}
        >
          Apply Weekday Hours (Mon-Fri)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAvailability(prev =>
              prev.map(slot => ({ ...slot, isActive: true }))
            );
            setHasChanges(true);
          }}
        >
          Enable All Days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAvailability(prev =>
              prev.map(slot => ({ ...slot, isActive: false }))
            );
            setHasChanges(true);
          }}
        >
          Disable All Days
        </Button>
      </div>

      {/* Days Schedule */}
      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day) => {
          const slot = availability.find(s => s.dayOfWeek === day.value);
          if (!slot) return null;

          const isValid = isValidTimeRange(slot.startTime, slot.endTime);

          return (
            <Card
              key={day.value}
              className={cn(
                "transition-all",
                !slot.isActive && "opacity-60"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 sm:w-40">
                    <Switch
                      id={`day-${day.value}`}
                      checked={slot.isActive}
                      onCheckedChange={(checked) =>
                        handleDayToggle(day.value, checked)
                      }
                      aria-label={`Enable ${day.label}`}
                    />
                    <Label
                      htmlFor={`day-${day.value}`}
                      className="font-medium"
                    >
                      {day.label}
                    </Label>
                  </div>

                  {/* Time Range */}
                  <div className="flex flex-1 items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          handleTimeChange(day.value, "startTime", e.target.value)
                        }
                        disabled={!slot.isActive}
                        className="w-32"
                        aria-label={`${day.label} start time`}
                      />
                    </div>
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        handleTimeChange(day.value, "endTime", e.target.value)
                      }
                      disabled={!slot.isActive}
                      className="w-32"
                      aria-label={`${day.label} end time`}
                    />
                    
                    {/* Apply to All Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyToAllDays(day.value)}
                      disabled={!slot.isActive}
                      className="ml-auto"
                    >
                      Apply to all
                    </Button>
                  </div>

                  {/* Validation Error */}
                  {slot.isActive && !isValid && (
                    <span className="text-sm text-destructive">
                      End time must be after start time
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Availability Summary</p>
              <p className="text-sm text-muted-foreground">
                You are available {availability.filter(s => s.isActive).length} days per week
              </p>
              {availability.some(s => s.isActive) && (
                <div className="mt-2 space-y-1">
                  {availability
                    .filter(s => s.isActive)
                    .map(slot => {
                      const day = DAYS_OF_WEEK.find(d => d.value === slot.dayOfWeek);
                      return (
                        <p key={slot.dayOfWeek} className="text-xs text-muted-foreground">
                          {day?.label}: {slot.startTime} - {slot.endTime}
                        </p>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t pt-6">
        <p className="text-sm text-muted-foreground">
          {hasChanges
            ? "You have unsaved changes"
            : "Your availability is up to date"}
        </p>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || availability.every(s => !s.isActive)}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Availability
        </Button>
      </div>
    </div>
  );
}