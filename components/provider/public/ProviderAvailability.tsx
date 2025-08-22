"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay, isToday, isPast } from "date-fns";

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ProviderAvailabilityProps {
  availability: AvailabilitySlot[];
  providerId: string;
}

export default function ProviderAvailability({
  availability,
  providerId,
}: ProviderAvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date()));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullDayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Generate time slots for a day
  const generateTimeSlots = (startTime: string, endTime: string) => {
    const slots = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin
        .toString()
        .padStart(2, "0")}`;
      slots.push(timeString);

      // Increment by 30 minutes
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }

    return slots;
  };

  // Get availability for selected date
  const getAvailabilityForDate = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dayAvailability = availability.find(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.isActive
    );
    return dayAvailability;
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    setCurrentWeek(addDays(currentWeek, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addDays(currentWeek, 7));
  };

  const selectedDayAvailability = getAvailabilityForDate(selectedDate);
  const timeSlots = selectedDayAvailability
    ? generateTimeSlots(
        selectedDayAvailability.startTime,
        selectedDayAvailability.endTime
      )
    : [];

  // Format time for display
  const formatTime = (time: string) => {
    const [hour, min] = time.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${min.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-green-600" />
              Availability
            </CardTitle>
            <CardDescription className="mt-1">
              Select a date and time to book your appointment
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Times shown in your local timezone</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Calendar Week View */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">
              {format(currentWeek, "MMMM yyyy")}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                disabled={isPast(addDays(currentWeek, 6))}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentWeek(startOfWeek(new Date()));
                  setSelectedDate(new Date());
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week Days */}
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, index) => {
              const date = addDays(currentWeek, index);
              const dayAvailability = getAvailabilityForDate(date);
              const isSelected = isSameDay(date, selectedDate);
              const isDateToday = isToday(date);
              const isDatePast = isPast(date) && !isDateToday;

              return (
                <motion.button
                  key={index}
                  whileHover={{ scale: isDatePast ? 1 : 1.05 }}
                  whileTap={{ scale: isDatePast ? 1 : 0.95 }}
                  onClick={() => !isDatePast && setSelectedDate(date)}
                  disabled={isDatePast}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : isDatePast
                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                      : dayAvailability
                      ? "bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300"
                      : "bg-gray-50 text-gray-500 border-gray-200",
                    isDateToday && !isSelected && "ring-2 ring-blue-500 ring-offset-2"
                  )}
                  aria-label={`Select ${format(date, "EEEE, MMMM d")}`}
                  aria-pressed={isSelected}
                >
                  <div className="text-xs font-medium mb-1">
                    {dayNames[index]}
                  </div>
                  <div className="text-lg font-bold">{format(date, "d")}</div>
                  {dayAvailability && !isDatePast && (
                    <div className="text-xs mt-1">
                      {isSelected ? "Available" : "Open"}
                    </div>
                  )}
                  {!dayAvailability && !isDatePast && (
                    <div className="text-xs mt-1 opacity-60">Closed</div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">
              Available times for {format(selectedDate, "EEEE, MMMM d")}
            </h3>
            {selectedDayAvailability && (
              <Badge variant="outline" className="text-green-700 border-green-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(selectedDayAvailability.startTime)} -{" "}
                {formatTime(selectedDayAvailability.endTime)}
              </Badge>
            )}
          </div>

          {timeSlots.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pr-4">
                {timeSlots.map((time, index) => (
                  <motion.div
                    key={time}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <Button
                      variant="outline"
                      className="w-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                      onClick={() => {
                        // Handle time slot selection
                        console.log("Selected time:", time);
                      }}
                    >
                      {formatTime(time)}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {isPast(selectedDate) && !isToday(selectedDate)
                  ? "This date has passed"
                  : "No availability on this date"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Please select another date
              </p>
            </div>
          )}
        </div>

        {/* Regular Schedule Summary */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Regular Weekly Schedule
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {fullDayNames.map((day, index) => {
              const daySlot = availability.find(
                (slot) => slot.dayOfWeek === index && slot.isActive
              );
              return (
                <div
                  key={day}
                  className={cn(
                    "text-xs p-2 rounded border",
                    daySlot
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  )}
                >
                  <div className="font-medium">{day}</div>
                  <div className="mt-1">
                    {daySlot
                      ? `${formatTime(daySlot.startTime)} - ${formatTime(
                          daySlot.endTime
                        )}`
                      : "Closed"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}