"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isPast, isFuture, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useProviderAvailability } from "@/hooks/api/useProviders";
import { format as formatDate } from "date-fns";

interface BookingCalendarProps {
  providerId: string;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  selectedService?: {
    duration: number;
    name: string;
    price: number;
  };
  timezone?: string;
}

interface DayAvailability {
  date: string;
  hasAvailableSlots: boolean;
  slotCount?: number;
}

export function BookingCalendar({
  providerId,
  selectedDate,
  onSelectDate,
  selectedService,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  
  // Calculate date boundaries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = addDays(today, 30);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get the first day of the week for the month (for grid alignment)
  const firstDayOfWeek = getDay(calendarDays[0]);

  // Use availability API hook
  const {
    availability,
    isLoading,
    error,
    refreshAvailability,
  } = useProviderAvailability(providerId, {
    startDate: startOfMonth(currentMonth).toISOString(),
    endDate: endOfMonth(currentMonth).toISOString(),
    slotDuration: selectedService?.duration || 60,
    timezone,
  });

  // Create availability map from API data
  const availabilityMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    
    if (availability?.availability) {
      availability.availability.forEach((dayData) => {
        const availableSlots = dayData.slots.filter(slot => slot.available);
        map.set(dayData.date, {
          date: dayData.date,
          hasAvailableSlots: availableSlots.length > 0,
          slotCount: availableSlots.length,
        });
      });
    }
    
    return map;
  }, [availability]);

  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    
    // Don't go before current month
    if (newMonth >= startOfMonth(today)) {
      setCurrentMonth(newMonth);
    }
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    
    // Don't go beyond 30 days from today
    if (startOfMonth(newMonth) <= maxDate) {
      setCurrentMonth(newMonth);
    }
  };

  const isDaySelectable = (date: Date) => {
    // Check if date is within allowed range
    if (date < today || date > maxDate) return false;

    // Check availability
    const dateStr = formatDate(date, "yyyy-MM-dd");
    const dayAvailability = availabilityMap.get(dateStr);
    
    return dayAvailability?.hasAvailableSlots || false;
  };

  const getDayStatus = (date: Date) => {
    const dateStr = formatDate(date, "yyyy-MM-dd");
    const dayAvailability = availabilityMap.get(dateStr);
    
    if (date < today) return "past";
    if (date > maxDate) return "unavailable";
    if (!dayAvailability && isLoading) return "loading";
    if (!dayAvailability || !dayAvailability.hasAvailableSlots) return "unavailable";
    if (dayAvailability.slotCount && dayAvailability.slotCount <= 2) return "limited";
    return "available";
  };

  const dayVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            Select Date
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousMonth}
              disabled={startOfMonth(currentMonth) <= startOfMonth(today)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              disabled={startOfMonth(currentMonth) >= startOfMonth(maxDate)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Calendar Grid */}
        <div className="space-y-3">
          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for alignment */}
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}

            {/* Calendar Days */}
            <AnimatePresence mode="wait">
              {calendarDays.map((date) => {
                const status = getDayStatus(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isClickable = isDaySelectable(date);
                const dayAvailability = availabilityMap.get(formatDate(date, "yyyy-MM-dd"));

                return (
                  <motion.div
                    key={date.toISOString()}
                    variants={dayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                  >
                    {isLoading ? (
                      <Skeleton className="h-12 w-full rounded-lg" />
                    ) : (
                      <button
                        onClick={() => isClickable && onSelectDate(date)}
                        disabled={!isClickable}
                        className={cn(
                          "relative h-12 w-full rounded-lg border transition-all duration-200",
                          "flex flex-col items-center justify-center text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                          
                          // Base states
                          status === "available" && "hover:bg-blue-50 hover:border-blue-300 cursor-pointer",
                          status === "limited" && "hover:bg-orange-50 hover:border-orange-300 cursor-pointer",
                          status === "unavailable" && "bg-gray-50 text-gray-400 cursor-not-allowed",
                          status === "past" && "bg-gray-50 text-gray-300 cursor-not-allowed",
                          
                          // Selected state
                          isSelected && "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
                          
                          // Today indicator
                          isToday(date) && !isSelected && "border-blue-500 border-2 font-semibold"
                        )}
                      >
                        <span className={cn(
                          "text-sm",
                          isSelected && "text-white"
                        )}>
                          {formatDate(date, "d")}
                        </span>
                        
                        {/* Availability indicator */}
                        {!isLoading && dayAvailability && dayAvailability.hasAvailableSlots && (
                          <div className={cn(
                            "absolute bottom-1 left-1/2 transform -translate-x-1/2",
                            "flex gap-0.5"
                          )}>
                            {dayAvailability.slotCount && dayAvailability.slotCount <= 2 ? (
                              <div className={cn(
                                "h-1 w-1 rounded-full",
                                isSelected ? "bg-white/70" : "bg-orange-400"
                              )} />
                            ) : (
                              <>
                                {[...Array(Math.min(3, dayAvailability.slotCount || 0))].map((_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "h-1 w-1 rounded-full",
                                      isSelected ? "bg-white/70" : "bg-green-400"
                                    )}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            <span>Limited slots</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-gray-300" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border-2 border-blue-500" />
            <span>Today</span>
          </div>
        </div>

        {/* Selected Date Display */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-blue-50 rounded-lg border border-blue-200"
          >
            <p className="text-sm text-blue-900">
              <span className="font-medium">Selected:</span>{" "}
              {formatDate(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
          </motion.div>
        )}
      </div>
    </Card>
  );
}