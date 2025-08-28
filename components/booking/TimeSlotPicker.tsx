"use client";

import { useState, useEffect, useMemo } from "react";
import { format, parse, isAfter, addMinutes } from "date-fns";
import { Clock, Sunrise, Sun, Sunset, Moon, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useProviderAvailability } from "@/hooks/api/useProviders";
import { format as formatDate } from "date-fns";
import { getAvailableSlotsAction } from "@/actions/availability-actions";

interface TimeSlotPickerProps {
  providerId: string;
  selectedDate: Date | undefined;
  selectedTime: string | undefined;
  onSelectTime: (time: string) => void;
  serviceDuration?: number;
  timezone?: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  displayTime?: string;
  period?: "morning" | "afternoon" | "evening" | "night";
}

export function TimeSlotPicker({
  providerId,
  selectedDate,
  selectedTime,
  onSelectTime,
  serviceDuration = 60,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: TimeSlotPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  // Categorize time slots by period
  const categorizeTimeSlot = (time: string): "morning" | "afternoon" | "evening" | "night" => {
    const hour = parseInt(time.split(":")[0]);
    if (hour < 6) return "night";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  };

  // Format time for display
  const formatTimeDisplay = (time: string): string => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Fetch available time slots
  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!selectedDate || !providerId) {
        setTimeSlots([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getAvailableSlotsAction(
          providerId,
          format(selectedDate, 'yyyy-MM-dd'),
          serviceDuration || 60,
          { 
            timezone,
            minimumNoticeHours: 2
          }
        );

        if (result.success && result.data) {
          const slots: TimeSlot[] = (result.data.slots || []).map((slot: any) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            available: slot.available,
            displayTime: formatTimeDisplay(slot.startTime),
            period: categorizeTimeSlot(slot.startTime),
          }));

          setTimeSlots(slots);

          // Auto-select period based on first available slot
          const firstAvailable = slots.find(s => s.available);
          if (firstAvailable && firstAvailable.period) {
            setSelectedPeriod(firstAvailable.period);
          }
        } else {
          setTimeSlots([]);
          setError("No time slots available for this date");
        }
      } catch (err) {
        setError("Unable to load time slots");
        console.error("Error fetching time slots:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeSlots();
  }, [selectedDate, providerId, serviceDuration, timezone]);

  // Group slots by period
  const slotsByPeriod = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    timeSlots.forEach(slot => {
      if (slot.period) {
        groups[slot.period].push(slot);
      }
    });

    return groups;
  }, [timeSlots]);

  // Calculate available slots count by period
  const availableCountByPeriod = useMemo(() => {
    const counts: Record<string, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
      all: 0,
    };

    timeSlots.forEach(slot => {
      if (slot.available) {
        counts.all++;
        if (slot.period) {
          counts[slot.period]++;
        }
      }
    });

    return counts;
  }, [timeSlots]);

  // Get filtered slots based on selected period
  const filteredSlots = selectedPeriod === "all" 
    ? timeSlots 
    : slotsByPeriod[selectedPeriod] || [];

  const periodIcons = {
    morning: <Sunrise className="h-4 w-4" />,
    afternoon: <Sun className="h-4 w-4" />,
    evening: <Sunset className="h-4 w-4" />,
    night: <Moon className="h-4 w-4" />,
    all: <Clock className="h-4 w-4" />,
  };

  const periodLabels = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    all: "All Times",
  };

  const slotVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  };

  if (!selectedDate) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Please select a date first</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Select Time
          </h3>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {availableCountByPeriod.all} slots available
            </Badge>
          )}
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-10 flex-1" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
        )}

        {/* Time Period Tabs */}
        {!isLoading && timeSlots.length > 0 && (
          <>
            <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <TabsList className="grid grid-cols-5 w-full">
                {["all", "morning", "afternoon", "evening", "night"].map((period) => {
                  const count = availableCountByPeriod[period];
                  const hasSlots = period === "all" ? timeSlots.length > 0 : slotsByPeriod[period].length > 0;
                  
                  return (
                    <TabsTrigger
                      key={period}
                      value={period}
                      disabled={!hasSlots}
                      className="relative"
                    >
                      <div className="flex items-center gap-1">
                        {periodIcons[period as keyof typeof periodIcons]}
                        <span className="hidden sm:inline text-xs">
                          {periodLabels[period as keyof typeof periodLabels]}
                        </span>
                      </div>
                      {count > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                        >
                          {count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={selectedPeriod} className="mt-4">
                <ScrollArea className="h-[280px] pr-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <AnimatePresence mode="popLayout">
                      {filteredSlots.map((slot) => {
                        const isSelected = selectedTime === slot.startTime;
                        const isAvailable = slot.available;
                        
                        return (
                          <motion.div
                            key={slot.startTime}
                            variants={slotVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            transition={{ duration: 0.2 }}
                          >
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => isAvailable && onSelectTime(slot.startTime)}
                              disabled={!isAvailable}
                              className={cn(
                                "w-full h-12 relative transition-all duration-200",
                                isSelected && "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
                                !isSelected && isAvailable && "hover:bg-blue-50 hover:border-blue-300",
                                !isAvailable && "opacity-50 cursor-not-allowed bg-gray-50"
                              )}
                            >
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-sm font-medium",
                                  isSelected && "text-white"
                                )}>
                                  {slot.displayTime}
                                </span>
                                {serviceDuration && serviceDuration !== 60 && (
                                  <span className={cn(
                                    "text-[10px]",
                                    isSelected ? "text-white/80" : "text-gray-500"
                                  )}>
                                    {serviceDuration} min
                                  </span>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-white" />
                              )}
                              {!isAvailable && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-[1px] w-full bg-gray-400 rotate-[-20deg]" />
                                </div>
                              )}
                            </Button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {filteredSlots.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No time slots available</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Selected Time Display */}
            {selectedTime && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-blue-50 rounded-lg border border-blue-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-900">
                      <span className="font-medium">Selected time:</span>{" "}
                      {formatTimeDisplay(selectedTime)}
                    </p>
                  </div>
                  {serviceDuration && (
                    <Badge variant="secondary" className="text-xs">
                      {serviceDuration} min session
                    </Badge>
                  )}
                </div>
                {serviceDuration && (
                  <p className="text-xs text-blue-700 mt-1">
                    Ends at {formatTimeDisplay(
                      format(
                        addMinutes(
                          parse(selectedTime, "HH:mm", new Date()),
                          serviceDuration
                        ),
                        "HH:mm"
                      )
                    )}
                  </p>
                )}
              </motion.div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && timeSlots.length === 0 && !error && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No available time slots for this date</p>
            <p className="text-xs text-gray-400 mt-1">Please select another date</p>
          </div>
        )}

        {/* Timezone Display */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t">
          Times shown in {timezone}
        </div>
      </div>
    </Card>
  );
}