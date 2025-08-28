"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isPast, isFuture, getDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { format as formatDate } from "date-fns";
import { getAvailableSlotsAction } from "@/actions/availability-actions";

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
  slotCount: number;
  totalSlots: number;
}

export function BookingCalendar({
  providerId,
  selectedDate,
  onSelectDate,
  selectedService,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DayAvailability>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Calculate date boundaries
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 30);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get the first day of the week for the month (for grid alignment)
  const firstDayOfWeek = getDay(calendarDays[0]);

  // Fetch availability for all days in the current month view (optimized with batching)
  useEffect(() => {
    const fetchMonthAvailability = async () => {
      if (!providerId) return;

      setIsLoading(true);
      setError(null);
      
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const newAvailabilityMap = new Map<string, DayAvailability>();
      
      try {
        // Collect dates to fetch
        const datesToFetch: string[] = [];
        let currentDate = new Date(monthStart);
        
        while (currentDate <= monthEnd) {
          const dateToCheck = new Date(currentDate);
          
          // Only fetch for dates that are today or in the future, up to maxDate
          if (dateToCheck >= today && dateToCheck <= maxDate) {
            datesToFetch.push(formatDate(dateToCheck, "yyyy-MM-dd"));
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Batch fetch dates in groups to avoid overwhelming the server
        const BATCH_SIZE = 7; // Fetch a week at a time
        const batches = [];
        
        for (let i = 0; i < datesToFetch.length; i += BATCH_SIZE) {
          const batch = datesToFetch.slice(i, i + BATCH_SIZE);
          batches.push(batch);
        }
        
        // Process batches sequentially to be server-friendly
        for (const batch of batches) {
          const batchPromises = batch.map(dateStr => 
            getAvailableSlotsAction(
              providerId,
              dateStr,
              selectedService?.duration || 60,
              { timezone, minimumNoticeHours: 2 }
            ).then(result => {
              if (result.success && result.data) {
                const availableSlots = result.data.slots?.filter((slot: any) => slot.available) || [];
                newAvailabilityMap.set(dateStr, {
                  date: dateStr,
                  hasAvailableSlots: availableSlots.length > 0,
                  slotCount: availableSlots.length,
                  totalSlots: result.data.slots?.length || 0,
                });
              } else {
                // No slots available for this date
                newAvailabilityMap.set(dateStr, {
                  date: dateStr,
                  hasAvailableSlots: false,
                  slotCount: 0,
                  totalSlots: 0,
                });
              }
            }).catch(err => {
              console.error(`Error fetching availability for ${dateStr}:`, err);
              // Mark as unavailable on error
              newAvailabilityMap.set(dateStr, {
                date: dateStr,
                hasAvailableSlots: false,
                slotCount: 0,
                totalSlots: 0,
              });
            })
          );
          
          // Wait for this batch to complete before starting the next
          await Promise.all(batchPromises);
        }
        
        setAvailabilityMap(newAvailabilityMap);
        
      } catch (err) {
        console.error("Error fetching month availability:", err);
        setError("Unable to load availability. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonthAvailability();
  }, [currentMonth, providerId, selectedService?.duration, timezone]);

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
    const dateToCheck = startOfDay(date);
    if (dateToCheck < today || dateToCheck > maxDate) return false;

    // Check availability
    const dateStr = formatDate(date, "yyyy-MM-dd");
    const dayAvailability = availabilityMap.get(dateStr);
    
    return dayAvailability?.hasAvailableSlots || false;
  };

  const getDayStatus = (date: Date): "past" | "unavailable" | "loading" | "limited" | "available" => {
    const dateStr = formatDate(date, "yyyy-MM-dd");
    const dayAvailability = availabilityMap.get(dateStr);
    const dateToCheck = startOfDay(date);
    
    if (dateToCheck < today) return "past";
    if (dateToCheck > maxDate) return "unavailable";
    if (isLoading && !dayAvailability) return "loading";
    if (!dayAvailability || !dayAvailability.hasAvailableSlots) return "unavailable";
    
    // Calculate limited availability threshold (less than 30% of total slots remaining)
    const percentageAvailable = dayAvailability.totalSlots > 0 
      ? (dayAvailability.slotCount / dayAvailability.totalSlots) * 100
      : 0;
    
    if (percentageAvailable <= 30 || dayAvailability.slotCount <= 3) return "limited";
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
                const isCurrentDay = isToday(date);

                return (
                  <motion.div
                    key={date.toISOString()}
                    variants={dayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                  >
                    {status === "loading" ? (
                      <Skeleton className="h-14 w-full rounded-lg" />
                    ) : (
                      <button
                        onClick={() => isClickable && onSelectDate(date)}
                        disabled={!isClickable}
                        aria-label={`${formatDate(date, "EEEE, MMMM d, yyyy")}${
                          dayAvailability?.hasAvailableSlots 
                            ? ` - ${dayAvailability.slotCount} slots available` 
                            : " - No slots available"
                        }`}
                        className={cn(
                          "relative h-14 w-full rounded-lg border-2 transition-all duration-200",
                          "flex flex-col items-center justify-center",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                          
                          // Base states with enhanced colors
                          status === "available" && [
                            "bg-white hover:bg-green-50 border-green-200 hover:border-green-400",
                            "cursor-pointer hover:shadow-sm"
                          ],
                          status === "limited" && [
                            "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-400",
                            "cursor-pointer hover:shadow-sm"
                          ],
                          status === "unavailable" && [
                            "bg-gray-50 text-gray-400 border-gray-200",
                            "cursor-not-allowed opacity-60"
                          ],
                          status === "past" && [
                            "bg-gray-50 text-gray-300 border-gray-100",
                            "cursor-not-allowed opacity-40"
                          ],
                          
                          // Selected state with stronger emphasis
                          isSelected && [
                            "bg-blue-600 text-white hover:bg-blue-700",
                            "border-blue-600 shadow-md ring-2 ring-blue-200"
                          ],
                          
                          // Today indicator with animated pulse
                          isCurrentDay && !isSelected && [
                            "border-blue-500 font-bold",
                            "ring-2 ring-blue-200 animate-pulse"
                          ]
                        )}
                      >
                        <span className={cn(
                          "text-base font-medium",
                          isSelected && "text-white",
                          status === "available" && !isSelected && "text-gray-900",
                          status === "limited" && !isSelected && "text-orange-700",
                          isCurrentDay && !isSelected && "text-blue-600"
                        )}>
                          {formatDate(date, "d")}
                        </span>
                        
                        {/* Enhanced availability indicator */}
                        {dayAvailability && dayAvailability.hasAvailableSlots && (
                          <div className="absolute bottom-1 left-0 right-0 px-1">
                            <div className={cn(
                              "h-1 rounded-full transition-all",
                              status === "available" && (isSelected ? "bg-white/80" : "bg-green-400"),
                              status === "limited" && (isSelected ? "bg-white/80" : "bg-orange-400")
                            )} 
                            style={{
                              width: `${Math.min(100, (dayAvailability.slotCount / Math.max(dayAvailability.totalSlots, 1)) * 100)}%`,
                              minWidth: "20%",
                              margin: "0 auto"
                            }}
                            />
                          </div>
                        )}

                        {/* Slot count badge for available days */}
                        {dayAvailability && dayAvailability.hasAvailableSlots && dayAvailability.slotCount > 0 && (
                          <span className={cn(
                            "absolute -top-1 -right-1 text-[10px] font-bold",
                            "bg-white border rounded-full h-4 w-4 flex items-center justify-center",
                            status === "available" && "border-green-400 text-green-600",
                            status === "limited" && "border-orange-400 text-orange-600",
                            isSelected && "bg-blue-600 border-blue-600 text-white"
                          )}>
                            {dayAvailability.slotCount}
                          </span>
                        )}

                        {/* Today badge */}
                        {isCurrentDay && (
                          <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-blue-600 uppercase">
                            Today
                          </span>
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Enhanced Legend */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Availability Guide</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded border-2 border-green-200 bg-white flex items-center justify-center">
                <span className="text-[10px] font-bold text-green-600">15</span>
              </div>
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded border-2 border-orange-200 bg-orange-50 flex items-center justify-center">
                <span className="text-[10px] font-bold text-orange-600">3</span>
              </div>
              <span className="text-gray-600">Limited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded border-2 border-gray-200 bg-gray-50 opacity-60" />
              <span className="text-gray-600">Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded border-2 border-blue-500 ring-2 ring-blue-200 bg-white flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">5</span>
              </div>
              <span className="text-gray-600">Today</span>
            </div>
          </div>
          
          {/* Availability summary */}
          {!isLoading && availabilityMap.size > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-gray-500">
                {Array.from(availabilityMap.values()).filter(d => d.hasAvailableSlots).length} days with availability
              </p>
              <p className="text-xs text-gray-500">
                {Array.from(availabilityMap.values()).reduce((sum, d) => sum + d.slotCount, 0)} total slots
              </p>
            </div>
          )}
        </div>

        {/* Selected Date Display with Availability Info */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  {formatDate(selectedDate, "EEEE, MMMM d, yyyy")}
                </p>
                {(() => {
                  const dateStr = formatDate(selectedDate, "yyyy-MM-dd");
                  const dayAvailability = availabilityMap.get(dateStr);
                  
                  if (dayAvailability && dayAvailability.hasAvailableSlots) {
                    return (
                      <p className="text-xs text-blue-700">
                        {dayAvailability.slotCount} time {dayAvailability.slotCount === 1 ? 'slot' : 'slots'} available
                        {selectedService && ` for ${selectedService.duration} minute session`}
                      </p>
                    );
                  }
                  
                  return (
                    <p className="text-xs text-orange-700">
                      No availability on this date
                    </p>
                  );
                })()}
              </div>
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}