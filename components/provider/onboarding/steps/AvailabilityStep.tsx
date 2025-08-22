/**
 * Availability Step Component
 * 
 * Allows providers to set their weekly availability schedule
 */

"use client";

import { useProviderOnboardingStore } from "@/lib/stores/provider-onboarding-store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const time = `${hour.toString().padStart(2, "0")}:${minute}`;
  const label = new Date(`2024-01-01 ${time}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { value: time, label };
});

export default function AvailabilityStep() {
  const { 
    availability, 
    updateAvailability, 
    setAvailabilityForAllDays,
    stepValidation, 
    currentStep 
  } = useProviderOnboardingStore();
  
  const validation = stepValidation[currentStep];

  const handleCopyToAll = (dayOfWeek: number) => {
    const daySchedule = availability.find(a => a.dayOfWeek === dayOfWeek);
    if (daySchedule) {
      setAvailabilityForAllDays({
        startTime: daySchedule.startTime,
        endTime: daySchedule.endTime,
        isActive: daySchedule.isActive,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Set your regular weekly availability. Customers will be able to book appointments during these times.
        </AlertDescription>
      </Alert>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayAvailability = availability.find(a => a.dayOfWeek === day.value);
          
          return (
            <Card key={day.value}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <Switch
                      id={`day-${day.value}`}
                      checked={dayAvailability?.isActive || false}
                      onCheckedChange={(checked) => 
                        updateAvailability(day.value, { isActive: checked })
                      }
                      aria-label={`Enable availability for ${day.label}`}
                    />
                    <Label 
                      htmlFor={`day-${day.value}`}
                      className="font-medium cursor-pointer"
                    >
                      {day.label}
                    </Label>
                  </div>

                  {/* Time Selection */}
                  {dayAvailability?.isActive && (
                    <>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-1">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Label className="sm:hidden text-sm">From:</Label>
                          <Select
                            value={dayAvailability.startTime}
                            onValueChange={(value) => 
                              updateAvailability(day.value, { startTime: value })
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time.value} value={time.value}>
                                  {time.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <span className="hidden sm:inline text-gray-500">to</span>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Label className="sm:hidden text-sm">To:</Label>
                          <Select
                            value={dayAvailability.endTime}
                            onValueChange={(value) => 
                              updateAvailability(day.value, { endTime: value })
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem 
                                  key={time.value} 
                                  value={time.value}
                                  disabled={time.value <= dayAvailability.startTime}
                                >
                                  {time.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Copy to All Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToAll(day.value)}
                        className="w-full sm:w-auto"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Copy to all days</span>
                        <span className="sm:hidden">Copy to all</span>
                      </Button>
                    </>
                  )}
                </div>

                {/* Validation Error for this day */}
                {validation?.errors?.[`day_${day.value}`] && (
                  <p className="text-sm text-red-500 mt-2">
                    {validation.errors[`day_${day.value}`]}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* General Validation Error */}
      {validation?.errors?.general && (
        <Alert variant="destructive">
          <AlertDescription>{validation.errors.general}</AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Set Monday-Friday 9-5
            [1, 2, 3, 4, 5].forEach(day => {
              updateAvailability(day, {
                isActive: true,
                startTime: "09:00",
                endTime: "17:00",
              });
            });
            [0, 6].forEach(day => {
              updateAvailability(day, { isActive: false });
            });
          }}
        >
          Mon-Fri 9-5
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Set all days same hours
            setAvailabilityForAllDays({
              isActive: true,
              startTime: "09:00",
              endTime: "17:00",
            });
          }}
        >
          All Days 9-5
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Clear all
            setAvailabilityForAllDays({
              isActive: false,
              startTime: "09:00",
              endTime: "17:00",
            });
          }}
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}