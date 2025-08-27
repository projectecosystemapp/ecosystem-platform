"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { format, addMinutes, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";

interface ServiceBookingFormProps {
  provider: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
  };
  service: {
    name: string;
    description: string;
    price: number;
    duration: number; // in minutes
  };
  formData: any;
  onUpdate: (data: any) => void;
}

export function ServiceBookingForm({ 
  provider, 
  service, 
  formData, 
  onUpdate 
}: ServiceBookingFormProps) {
  const [activeSection, setActiveSection] = useState<"date" | "time" | "notes">("date");
  
  // Update base amount when service changes
  useEffect(() => {
    onUpdate({ 
      ...formData, 
      baseAmount: service.price,
      serviceDuration: service.duration 
    });
  }, [service.price, service.duration]);

  const handleDateSelect = (date: Date | undefined) => {
    onUpdate({ 
      ...formData, 
      selectedDate: date,
      selectedTime: undefined // Reset time when date changes
    });
    if (date) {
      setActiveSection("time");
    }
  };

  const handleTimeSelect = (time: string | undefined) => {
    onUpdate({ 
      ...formData, 
      selectedTime: time 
    });
    if (time) {
      setActiveSection("notes");
    }
  };

  const handleNotesChange = (notes: string) => {
    onUpdate({ 
      ...formData, 
      notes 
    });
  };

  // Calculate end time if both date and time are selected
  const getEndTime = () => {
    if (formData.selectedTime && service.duration) {
      const startTime = parse(formData.selectedTime, "HH:mm", new Date());
      const endTime = addMinutes(startTime, service.duration);
      return format(endTime, "HH:mm");
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Service Summary */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
            <AvatarImage src={provider.profileImageUrl} alt={provider.displayName} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration} min
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <User className="h-3 w-3" />
                    {provider.displayName}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">
                  ${service.price}
                </p>
                <p className="text-xs text-gray-500">per session</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Date Selection */}
      <Card className={cn(
        "p-6 transition-all duration-200",
        activeSection === "date" 
          ? "ring-2 ring-blue-500 ring-offset-2" 
          : "hover:shadow-md"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <Label className="text-base font-semibold">Select Date</Label>
          </div>
          {formData.selectedDate && (
            <Badge variant="outline" className="text-xs">
              {format(formData.selectedDate, "MMM d, yyyy")}
            </Badge>
          )}
        </div>
        <BookingCalendar
          providerId={provider.id}
          selectedDate={formData.selectedDate}
          onSelectDate={handleDateSelect}
          selectedService={{
            name: service.name,
            duration: service.duration,
            price: service.price,
          }}
        />
      </Card>

      {/* Time Selection */}
      {formData.selectedDate && (
        <Card className={cn(
          "p-6 transition-all duration-200",
          activeSection === "time" 
            ? "ring-2 ring-blue-500 ring-offset-2" 
            : "hover:shadow-md"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <Label className="text-base font-semibold">Select Time</Label>
            </div>
            {formData.selectedTime && (
              <Badge variant="outline" className="text-xs">
                {formData.selectedTime} - {getEndTime()}
              </Badge>
            )}
          </div>
          <TimeSlotPicker
            providerId={provider.id}
            selectedDate={formData.selectedDate}
            selectedTime={formData.selectedTime}
            onSelectTime={handleTimeSelect}
            serviceDuration={service.duration}
          />
        </Card>
      )}

      {/* Additional Notes */}
      {formData.selectedDate && formData.selectedTime && (
        <Card className={cn(
          "p-6 transition-all duration-200",
          activeSection === "notes" 
            ? "ring-2 ring-blue-500 ring-offset-2" 
            : "hover:shadow-md"
        )}>
          <Label htmlFor="notes" className="text-base font-semibold mb-2 block">
            Additional Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            placeholder="Any special requirements or notes for the provider..."
            value={formData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            Share any specific needs, preferences, or questions you have about the service.
          </p>
        </Card>
      )}

      {/* Summary of selections */}
      {formData.selectedDate && formData.selectedTime && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900">Appointment Scheduled</p>
              <div className="text-sm text-green-700 mt-1 space-y-1">
                <p>{format(formData.selectedDate, "EEEE, MMMM d, yyyy")}</p>
                <p>{formData.selectedTime} - {getEndTime()} ({service.duration} minutes)</p>
                <p className="flex items-center gap-1 mt-2">
                  <MapPin className="h-3 w-3" />
                  With {provider.displayName}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}