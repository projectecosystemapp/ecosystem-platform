"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Clock, Globe, AlertCircle } from "lucide-react";
import type { OnboardingData } from "@/app/become-a-provider/onboarding/page";

interface AvailabilityStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
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

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const time = `${hour.toString().padStart(2, "0")}:${minute}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour < 12 ? "AM" : "PM";
  const display = `${displayHour}:${minute} ${period}`;
  return { value: time, label: display };
});

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time (AZ)" },
  { value: "America/Anchorage", label: "Alaska Time (AK)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

export default function AvailabilityStep({
  data,
  updateData,
  errors,
}: AvailabilityStepProps) {
  const updateDaySchedule = (day: number, field: string, value: any) => {
    const updatedSchedule = {
      ...data.weeklySchedule,
      [day]: {
        ...data.weeklySchedule[day],
        [field]: value,
      },
    };
    updateData({ weeklySchedule: updatedSchedule });
  };

  const applyToAllWeekdays = () => {
    const mondaySchedule = data.weeklySchedule[1];
    const updatedSchedule = { ...data.weeklySchedule };
    
    // Apply Monday's schedule to Tuesday through Friday
    for (let day = 2; day <= 5; day++) {
      updatedSchedule[day] = { ...mondaySchedule };
    }
    
    updateData({ weeklySchedule: updatedSchedule });
  };

  const applyToAllDays = () => {
    const mondaySchedule = data.weeklySchedule[1];
    const updatedSchedule = { ...data.weeklySchedule };
    
    // Apply Monday's schedule to all days
    for (let day = 0; day < 7; day++) {
      updatedSchedule[day] = { ...mondaySchedule };
    }
    
    updateData({ weeklySchedule: updatedSchedule });
  };

  const hasActiveDay = Object.values(data.weeklySchedule).some(day => day.isActive);

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Availability
          </CardTitle>
          <CardDescription>
            Set your regular working hours for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pb-4 border-b">
            <button
              type="button"
              onClick={applyToAllWeekdays}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Apply Monday to weekdays
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={applyToAllDays}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Apply Monday to all days
            </button>
          </div>

          {/* Day Schedule */}
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = data.weeklySchedule[day.value];
              return (
                <div
                  key={day.value}
                  className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border ${
                    daySchedule.isActive ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <Switch
                      checked={daySchedule.isActive}
                      onCheckedChange={(checked) =>
                        updateDaySchedule(day.value, "isActive", checked)
                      }
                      aria-label={`Toggle ${day.label}`}
                    />
                    <Label className="font-medium">{day.label}</Label>
                  </div>

                  {daySchedule.isActive ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Select
                        value={daySchedule.startTime}
                        onValueChange={(value) =>
                          updateDaySchedule(day.value, "startTime", value)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot) => (
                            <SelectItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-gray-500">to</span>

                      <Select
                        value={daySchedule.endTime}
                        onValueChange={(value) =>
                          updateDaySchedule(day.value, "endTime", value)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot) => (
                            <SelectItem
                              key={slot.value}
                              value={slot.value}
                              disabled={slot.value <= daySchedule.startTime}
                            >
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex-1 text-gray-500 text-sm">
                      Not available
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {errors.availability && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.availability}</AlertDescription>
            </Alert>
          )}

          {!hasActiveDay && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You must set availability for at least one day to accept bookings
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Timezone
          </CardTitle>
          <CardDescription>
            Your availability will be shown to customers in their local time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="timezone">Your Timezone</Label>
            <Select
              value={data.timezone}
              onValueChange={(value) => updateData({ timezone: value })}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">
              Customers will see available times converted to their timezone
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Availability Tips */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <strong>Availability Tips:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Start with a conservative schedule - you can always add more hours later</li>
            <li>• Consider travel time between appointments when setting your hours</li>
            <li>• You can block specific dates for vacations or appointments later</li>
            <li>• Customers prefer providers with consistent, predictable availability</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}