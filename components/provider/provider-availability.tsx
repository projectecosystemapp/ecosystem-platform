"use client";

import { Calendar, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Availability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ProviderAvailabilityProps {
  availability: Availability[];
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function ProviderAvailability({ availability }: ProviderAvailabilityProps) {
  // Group availability by day
  const availabilityByDay = DAYS_OF_WEEK.map((day, index) => {
    const daySlots = availability.filter((slot) => slot.dayOfWeek === index && slot.isActive);
    return {
      day,
      dayIndex: index,
      slots: daySlots,
      isAvailable: daySlots.length > 0,
    };
  });

  // Format time from 24h to 12h format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Get current day for highlighting
  const currentDay = new Date().getDay();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-lg">Weekly Availability</h3>
      </div>

      <div className="space-y-2">
        {availabilityByDay.map(({ day, dayIndex, slots, isAvailable }) => (
          <div
            key={day}
            className={cn(
              "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
              dayIndex === currentDay ? "bg-blue-50" : "hover:bg-gray-50",
              !isAvailable && "opacity-60"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  dayIndex === currentDay ? "text-blue-600" : "text-gray-700"
                )}
              >
                {day.slice(0, 3)}
              </span>
              {dayIndex === currentDay && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  Today
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {isAvailable ? (
                slots.map((slot, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 text-xs text-gray-600"
                  >
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-gray-400">Unavailable</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-500 text-center">
          Times shown in your local timezone
        </p>
      </div>
    </Card>
  );
}