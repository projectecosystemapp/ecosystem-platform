"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Ticket, 
  Plus, 
  Minus,
  Info,
  Video,
  Building
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EventBookingFormProps {
  event: {
    id: string;
    name: string;
    description?: string;
    price: number;
    startDateTime?: Date;
    endDateTime?: Date;
    location?: string;
    locationType?: "in_person" | "virtual" | "hybrid";
    availableSpots?: number;
    maxAttendees?: number;
  };
  formData: any;
  onUpdate: (data: any) => void;
}

interface AttendeeInfo {
  name: string;
  email: string;
}

export function EventBookingForm({ event, formData, onUpdate }: EventBookingFormProps) {
  const [numberOfTickets, setNumberOfTickets] = useState(formData.numberOfTickets || 1);
  const [attendeeInfo, setAttendeeInfo] = useState<AttendeeInfo[]>(
    formData.attendeeInfo || [{ name: "", email: "" }]
  );
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);

  // Update form data when tickets change
  useEffect(() => {
    const totalAmount = event.price * numberOfTickets;
    onUpdate({
      ...formData,
      numberOfTickets,
      attendeeInfo,
      baseAmount: totalAmount,
    });
  }, [numberOfTickets, attendeeInfo, event.price]);

  const handleTicketChange = (change: number) => {
    const newCount = numberOfTickets + change;
    const maxTickets = event.availableSpots || 10;
    
    if (newCount >= 1 && newCount <= maxTickets) {
      setNumberOfTickets(newCount);
      
      // Adjust attendee info array
      if (change > 0) {
        // Add new attendee slots
        const newAttendees = [...attendeeInfo];
        for (let i = 0; i < change; i++) {
          newAttendees.push({ name: "", email: "" });
        }
        setAttendeeInfo(newAttendees);
      } else {
        // Remove attendee slots from the end
        setAttendeeInfo(attendeeInfo.slice(0, newCount));
      }
    }
  };

  const handleAttendeeChange = (index: number, field: "name" | "email", value: string) => {
    const updatedAttendees = [...attendeeInfo];
    updatedAttendees[index] = {
      ...updatedAttendees[index],
      [field]: value,
    };
    setAttendeeInfo(updatedAttendees);
  };

  const getLocationIcon = () => {
    if (event.locationType === "virtual") return <Video className="h-4 w-4" />;
    if (event.locationType === "hybrid") return <Users className="h-4 w-4" />;
    return <Building className="h-4 w-4" />;
  };

  const getLocationLabel = () => {
    if (event.locationType === "virtual") return "Virtual Event";
    if (event.locationType === "hybrid") return "Hybrid Event";
    return "In-Person Event";
  };

  const totalPrice = event.price * numberOfTickets;

  return (
    <div className="space-y-6">
      {/* Event Details Card */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
            {event.description && (
              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {event.startDateTime && (
              <Badge variant="secondary" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {format(event.startDateTime, "MMM d, yyyy")}
              </Badge>
            )}
            
            {event.startDateTime && (
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {format(event.startDateTime, "h:mm a")}
                {event.endDateTime && ` - ${format(event.endDateTime, "h:mm a")}`}
              </Badge>
            )}

            {event.locationType && (
              <Badge variant="secondary" className="gap-1.5">
                {getLocationIcon()}
                {getLocationLabel()}
              </Badge>
            )}

            {event.location && event.locationType !== "virtual" && (
              <Badge variant="secondary" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </Badge>
            )}
          </div>

          {event.availableSpots && event.availableSpots < 10 && (
            <Alert className="border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Only {event.availableSpots} spots remaining!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Ticket Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Number of Tickets</Label>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Ticket className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">General Admission</p>
                <p className="text-sm text-gray-600">${event.price} per ticket</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleTicketChange(-1)}
                disabled={numberOfTickets <= 1}
                className="h-8 w-8"
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="w-12 text-center">
                <span className="font-semibold text-lg">{numberOfTickets}</span>
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleTicketChange(1)}
                disabled={numberOfTickets >= (event.availableSpots || 10)}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Subtotal ({numberOfTickets} {numberOfTickets === 1 ? "ticket" : "tickets"})</span>
              <span className="text-xl font-bold text-blue-600">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Attendee Information (Optional) */}
      {numberOfTickets > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-base font-semibold">
              Attendee Information 
              <span className="text-sm font-normal text-gray-500 ml-2">(Optional)</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAttendeeForm(!showAttendeeForm)}
            >
              {showAttendeeForm ? "Hide" : "Add"} Details
            </Button>
          </div>

          {showAttendeeForm && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Add attendee names and emails to send them event reminders and updates.
              </p>
              
              {attendeeInfo.map((attendee, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      Ticket {index + 1}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`name-${index}`} className="text-sm">
                        Name
                      </Label>
                      <Input
                        id={`name-${index}`}
                        type="text"
                        placeholder="John Doe"
                        value={attendee.name}
                        onChange={(e) => handleAttendeeChange(index, "name", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`email-${index}`} className="text-sm">
                        Email
                      </Label>
                      <Input
                        id={`email-${index}`}
                        type="email"
                        placeholder="john@example.com"
                        value={attendee.email}
                        onChange={(e) => handleAttendeeChange(index, "email", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  {index < numberOfTickets - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Event Summary */}
      {numberOfTickets > 0 && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Ticket className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900">Tickets Selected</p>
              <div className="text-sm text-green-700 mt-1 space-y-1">
                <p>{numberOfTickets} {numberOfTickets === 1 ? "ticket" : "tickets"} to {event.name}</p>
                {event.startDateTime && (
                  <p>{format(event.startDateTime, "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
                )}
                {event.location && event.locationType !== "virtual" && (
                  <p className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.location}
                  </p>
                )}
                <p className="font-semibold mt-2">Total: ${totalPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}