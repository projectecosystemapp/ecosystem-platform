"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Home, 
  Maximize,
  Wifi,
  Coffee,
  Monitor,
  Car,
  Info
} from "lucide-react";
import { format, differenceInDays, differenceInHours, addDays, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

interface SpaceBookingFormProps {
  space: {
    id: string;
    name: string;
    description?: string;
    address?: string;
    capacity?: number;
    amenities?: string[];
    squareFeet?: number;
    hourlyRate?: number;
    dailyRate?: number;
    weeklyRate?: number;
  };
  formData: any;
  onUpdate: (data: any) => void;
}

const amenityIcons: Record<string, any> = {
  wifi: Wifi,
  coffee: Coffee,
  projector: Monitor,
  parking: Car,
};

export function SpaceBookingForm({ space, formData, onUpdate }: SpaceBookingFormProps) {
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(formData.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(formData.checkOutDate);
  const [rentalPeriod, setRentalPeriod] = useState<"hourly" | "daily" | "weekly">(
    formData.rentalPeriod || "daily"
  );
  const [hoursNeeded, setHoursNeeded] = useState(formData.hoursNeeded || 4);
  const [purpose, setPurpose] = useState(formData.purpose || "");
  const [estimatedAttendees, setEstimatedAttendees] = useState(formData.estimatedAttendees || 1);

  // Calculate rental duration and price
  useEffect(() => {
    if (!checkInDate) return;

    let duration = 0;
    let totalPrice = 0;

    if (rentalPeriod === "hourly") {
      duration = hoursNeeded;
      totalPrice = (space.hourlyRate || 0) * duration;
    } else if (rentalPeriod === "daily" && checkOutDate) {
      duration = differenceInDays(checkOutDate, checkInDate) || 1;
      totalPrice = (space.dailyRate || 0) * duration;
    } else if (rentalPeriod === "weekly" && checkOutDate) {
      const days = differenceInDays(checkOutDate, checkInDate) || 1;
      duration = Math.ceil(days / 7);
      totalPrice = (space.weeklyRate || 0) * duration;
    }

    onUpdate({
      ...formData,
      checkInDate,
      checkOutDate: rentalPeriod === "hourly" ? checkInDate : checkOutDate,
      rentalPeriod,
      rentalDuration: duration,
      hoursNeeded: rentalPeriod === "hourly" ? hoursNeeded : undefined,
      purpose,
      estimatedAttendees,
      baseAmount: totalPrice,
    });
  }, [checkInDate, checkOutDate, rentalPeriod, hoursNeeded, purpose, estimatedAttendees, space]);

  const handleCheckInChange = (date: Date | undefined) => {
    setCheckInDate(date);
    
    // Auto-set checkout for daily/weekly rentals
    if (date) {
      if (rentalPeriod === "daily" && !checkOutDate) {
        setCheckOutDate(addDays(date, 1));
      } else if (rentalPeriod === "weekly" && !checkOutDate) {
        setCheckOutDate(addDays(date, 7));
      }
    }
  };

  const handleCheckOutChange = (date: Date | undefined) => {
    if (date && checkInDate && isBefore(date, checkInDate)) {
      // Don't allow checkout before checkin
      return;
    }
    setCheckOutDate(date);
  };

  const getRateDisplay = () => {
    if (rentalPeriod === "hourly" && space.hourlyRate) {
      return `$${space.hourlyRate}/hour`;
    } else if (rentalPeriod === "daily" && space.dailyRate) {
      return `$${space.dailyRate}/day`;
    } else if (rentalPeriod === "weekly" && space.weeklyRate) {
      return `$${space.weeklyRate}/week`;
    }
    return "Rate not available";
  };

  const getTotalPrice = () => {
    if (!checkInDate) return 0;

    if (rentalPeriod === "hourly") {
      return (space.hourlyRate || 0) * hoursNeeded;
    } else if (rentalPeriod === "daily" && checkOutDate) {
      const days = differenceInDays(checkOutDate, checkInDate) || 1;
      return (space.dailyRate || 0) * days;
    } else if (rentalPeriod === "weekly" && checkOutDate) {
      const days = differenceInDays(checkOutDate, checkInDate) || 1;
      const weeks = Math.ceil(days / 7);
      return (space.weeklyRate || 0) * weeks;
    }
    return 0;
  };

  const getDurationText = () => {
    if (!checkInDate) return "";

    if (rentalPeriod === "hourly") {
      return `${hoursNeeded} hour${hoursNeeded !== 1 ? "s" : ""}`;
    } else if (rentalPeriod === "daily" && checkOutDate) {
      const days = differenceInDays(checkOutDate, checkInDate) || 1;
      return `${days} day${days !== 1 ? "s" : ""}`;
    } else if (rentalPeriod === "weekly" && checkOutDate) {
      const days = differenceInDays(checkOutDate, checkInDate) || 1;
      const weeks = Math.ceil(days / 7);
      return `${weeks} week${weeks !== 1 ? "s" : ""}`;
    }
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Space Details Card */}
      <Card className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{space.name}</h3>
            {space.description && (
              <p className="text-sm text-gray-600 mt-1">{space.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {space.capacity && (
              <Badge variant="secondary" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Up to {space.capacity} people
              </Badge>
            )}
            
            {space.squareFeet && (
              <Badge variant="secondary" className="gap-1.5">
                <Maximize className="h-3.5 w-3.5" />
                {space.squareFeet} sq ft
              </Badge>
            )}

            {space.address && (
              <Badge variant="secondary" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {space.address}
              </Badge>
            )}
          </div>

          {/* Amenities */}
          {space.amenities && space.amenities.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {space.amenities.map((amenity) => {
                  const Icon = amenityIcons[amenity.toLowerCase()] || Home;
                  return (
                    <Badge key={amenity} variant="outline" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {amenity}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Rental Period Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Rental Period</Label>
        
        <RadioGroup 
          value={rentalPeriod} 
          onValueChange={(value) => setRentalPeriod(value as typeof rentalPeriod)}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {space.hourlyRate && (
              <label
                htmlFor="hourly"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  rentalPeriod === "hourly" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <div>
                    <p className="font-medium">Hourly</p>
                    <p className="text-sm text-gray-600">${space.hourlyRate}/hour</p>
                  </div>
                </div>
                <Clock className="h-5 w-5 text-gray-400" />
              </label>
            )}

            {space.dailyRate && (
              <label
                htmlFor="daily"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  rentalPeriod === "daily" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="daily" id="daily" />
                  <div>
                    <p className="font-medium">Daily</p>
                    <p className="text-sm text-gray-600">${space.dailyRate}/day</p>
                  </div>
                </div>
                <CalendarIcon className="h-5 w-5 text-gray-400" />
              </label>
            )}

            {space.weeklyRate && (
              <label
                htmlFor="weekly"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  rentalPeriod === "weekly" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="weekly" id="weekly" />
                  <div>
                    <p className="font-medium">Weekly</p>
                    <p className="text-sm text-gray-600">${space.weeklyRate}/week</p>
                  </div>
                </div>
                <Home className="h-5 w-5 text-gray-400" />
              </label>
            )}
          </div>
        </RadioGroup>
      </Card>

      {/* Date/Time Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">
          {rentalPeriod === "hourly" ? "Select Date & Time" : "Select Dates"}
        </Label>

        {rentalPeriod === "hourly" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="date" className="text-sm mb-2 block">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkInDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkInDate ? format(checkInDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={handleCheckInChange}
                    disabled={(date) => isBefore(date, new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="hours" className="text-sm mb-2 block">Number of Hours</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setHoursNeeded(Math.max(1, hoursNeeded - 1))}
                  disabled={hoursNeeded <= 1}
                >
                  -
                </Button>
                <Input
                  id="hours"
                  type="number"
                  value={hoursNeeded}
                  onChange={(e) => setHoursNeeded(parseInt(e.target.value) || 1)}
                  className="w-20 text-center"
                  min={1}
                  max={12}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setHoursNeeded(Math.min(12, hoursNeeded + 1))}
                  disabled={hoursNeeded >= 12}
                >
                  +
                </Button>
                <span className="text-sm text-gray-600">hours</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkin" className="text-sm mb-2 block">Check-in Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkInDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkInDate ? format(checkInDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={handleCheckInChange}
                    disabled={(date) => isBefore(date, new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="checkout" className="text-sm mb-2 block">Check-out Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkOutDate && "text-muted-foreground"
                    )}
                    disabled={!checkInDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkOutDate ? format(checkOutDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutDate}
                    onSelect={handleCheckOutChange}
                    disabled={(date) => 
                      isBefore(date, checkInDate || new Date()) ||
                      isBefore(date, new Date())
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </Card>

      {/* Additional Details */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Additional Details</Label>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="attendees" className="text-sm mb-2 block">
              Estimated Number of Attendees
            </Label>
            <Input
              id="attendees"
              type="number"
              value={estimatedAttendees}
              onChange={(e) => setEstimatedAttendees(parseInt(e.target.value) || 1)}
              min={1}
              max={space.capacity || 100}
              className="w-32"
            />
            {space.capacity && estimatedAttendees > space.capacity && (
              <Alert className="mt-2 border-orange-200 bg-orange-50">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  This exceeds the space's maximum capacity of {space.capacity} people.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="purpose" className="text-sm mb-2 block">
              Purpose of Rental <span className="text-gray-500">(Optional)</span>
            </Label>
            <Textarea
              id="purpose"
              placeholder="E.g., team meeting, workshop, photo shoot, private event..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </Card>

      {/* Price Summary */}
      {checkInDate && (rentalPeriod === "hourly" || checkOutDate) && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Home className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900">Space Reserved</p>
              <div className="text-sm text-green-700 mt-1 space-y-1">
                <p>{space.name}</p>
                <p>
                  {rentalPeriod === "hourly" 
                    ? format(checkInDate, "EEEE, MMMM d, yyyy")
                    : `${format(checkInDate, "MMM d")} - ${checkOutDate ? format(checkOutDate, "MMM d, yyyy") : ""}`
                  }
                </p>
                <p>Duration: {getDurationText()}</p>
                <p className="pt-2 font-semibold text-base">
                  Total: ${getTotalPrice().toFixed(2)}
                </p>
                <p className="text-xs">({getRateDisplay()})</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}