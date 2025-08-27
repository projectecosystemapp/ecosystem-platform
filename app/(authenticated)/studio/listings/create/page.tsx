"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Package, Calendar, MapPin, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ListingType = 'service' | 'event' | 'space' | 'thing';

interface ListingTypeOption {
  value: ListingType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: string[];
}

const listingTypes: ListingTypeOption[] = [
  {
    value: 'service',
    label: 'Service',
    description: 'Offer a professional service like consulting, photography, or repairs',
    icon: Package,
    fields: ['name', 'description', 'duration', 'price', 'category'],
  },
  {
    value: 'event',
    label: 'Event',
    description: 'Host workshops, classes, tours, or experiences',
    icon: Calendar,
    fields: ['title', 'description', 'date', 'time', 'duration', 'capacity', 'price', 'location'],
  },
  {
    value: 'space',
    label: 'Space',
    description: 'Rent out venues, studios, offices, or storage spaces',
    icon: MapPin,
    fields: ['name', 'description', 'type', 'capacity', 'hourlyRate', 'dailyRate', 'amenities', 'location'],
  },
  {
    value: 'thing',
    label: 'Thing',
    description: 'Sell or rent equipment, tools, or other physical items',
    icon: ShoppingBag,
    fields: ['name', 'description', 'category', 'price', 'condition', 'availability'],
  },
];

export default function CreateListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get('type') as ListingType) || null;
  
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [selectedType, setSelectedType] = useState<ListingType | null>(initialType);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeSelect = (type: ListingType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedType) return;

    setIsSubmitting(true);
    try {
      // Call appropriate API based on listing type
      const endpoint = selectedType === 'service' 
        ? '/api/providers/services'
        : `/api/${selectedType}s`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create listing');
      }

      const result = await response.json();
      toast.success(`${selectedType} created successfully!`);
      
      // Redirect to the listing details or edit page
      router.push(`/studio/listings/${selectedType}s/${result.id}`);
    } catch (error) {
      console.error('Error creating listing:', error);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSelection = () => (
    <Card>
      <CardHeader>
        <CardTitle>What would you like to list?</CardTitle>
        <CardDescription>
          Choose the type of listing you want to create
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedType || ''}
          onValueChange={(value) => handleTypeSelect(value as ListingType)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {listingTypes.map((type) => {
              const Icon = type.icon;
              return (
                <label
                  key={type.value}
                  htmlFor={type.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-4 hover:bg-gray-50",
                    selectedType === type.value && "border-blue-500 bg-blue-50"
                  )}
                >
                  <RadioGroupItem
                    value={type.value}
                    id={type.value}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "rounded-lg p-2",
                      selectedType === type.value ? "bg-blue-100" : "bg-gray-100"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        selectedType === type.value ? "text-blue-600" : "text-gray-600"
                      )} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{type.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );

  const renderServiceForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Service Name</Label>
        <Input
          id="name"
          placeholder="e.g., Professional Photography Session"
          value={formData.name || ''}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your service in detail..."
          rows={4}
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            placeholder="60"
            value={formData.duration || ''}
            onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            placeholder="100"
            value={formData.price || ''}
            onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          placeholder="e.g., Photography, Consulting, Repairs"
          value={formData.category || ''}
          onChange={(e) => handleInputChange('category', e.target.value)}
        />
      </div>
    </div>
  );

  const renderEventForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          placeholder="e.g., Weekend Photography Workshop"
          value={formData.title || ''}
          onChange={(e) => handleInputChange('title', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your event in detail..."
          rows={4}
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Event Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date || ''}
            onChange={(e) => handleInputChange('date', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Start Time</Label>
          <Input
            id="time"
            type="time"
            value={formData.time || ''}
            onChange={(e) => handleInputChange('time', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (hours)</Label>
          <Input
            id="duration"
            type="number"
            placeholder="2"
            value={formData.duration || ''}
            onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Max Attendees</Label>
          <Input
            id="capacity"
            type="number"
            placeholder="20"
            value={formData.capacity || ''}
            onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Ticket Price ($)</Label>
          <Input
            id="price"
            type="number"
            placeholder="50"
            value={formData.price || ''}
            onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="123 Main St, San Francisco, CA"
          value={formData.location || ''}
          onChange={(e) => handleInputChange('location', e.target.value)}
        />
      </div>
    </div>
  );

  const renderSpaceForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Space Name</Label>
        <Input
          id="name"
          placeholder="e.g., Downtown Photography Studio"
          value={formData.name || ''}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your space in detail..."
          rows={4}
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Space Type</Label>
          <Input
            id="type"
            placeholder="e.g., Studio, Office, Warehouse"
            value={formData.type || ''}
            onChange={(e) => handleInputChange('type', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            placeholder="10"
            value={formData.capacity || ''}
            onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
          <Input
            id="hourlyRate"
            type="number"
            placeholder="75"
            value={formData.hourlyRate || ''}
            onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dailyRate">Daily Rate ($)</Label>
          <Input
            id="dailyRate"
            type="number"
            placeholder="500"
            value={formData.dailyRate || ''}
            onChange={(e) => handleInputChange('dailyRate', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amenities">Amenities</Label>
        <Input
          id="amenities"
          placeholder="WiFi, Parking, Kitchen, etc."
          value={formData.amenities || ''}
          onChange={(e) => handleInputChange('amenities', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Address</Label>
        <Input
          id="location"
          placeholder="123 Main St, San Francisco, CA"
          value={formData.location || ''}
          onChange={(e) => handleInputChange('location', e.target.value)}
        />
      </div>
    </div>
  );

  const renderThingForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Item Name</Label>
        <Input
          id="name"
          placeholder="e.g., Canon 5D Mark IV Camera"
          value={formData.name || ''}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe the item in detail..."
          rows={4}
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g., Electronics, Tools, Equipment"
            value={formData.category || ''}
            onChange={(e) => handleInputChange('category', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Input
            id="condition"
            placeholder="e.g., New, Like New, Good"
            value={formData.condition || ''}
            onChange={(e) => handleInputChange('condition', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            placeholder="500"
            value={formData.price || ''}
            onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Availability</Label>
          <Input
            id="availability"
            placeholder="e.g., For Sale, For Rent"
            value={formData.availability || ''}
            onChange={(e) => handleInputChange('availability', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderDetailsForm = () => {
    if (!selectedType) return null;

    const typeConfig = listingTypes.find(t => t.value === selectedType);
    if (!typeConfig) return null;

    const Icon = typeConfig.icon;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Create {typeConfig.label}</CardTitle>
              <CardDescription>
                Fill in the details for your new {selectedType} listing
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedType === 'service' && renderServiceForm()}
          {selectedType === 'event' && renderEventForm()}
          {selectedType === 'space' && renderSpaceForm()}
          {selectedType === 'thing' && renderThingForm()}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Listing</h1>
        <p className="mt-1 text-sm text-gray-600">
          List your services, events, spaces, or things on the marketplace
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
            step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
          )}>
            1
          </div>
          <span className={cn(
            "text-sm font-medium",
            step >= 1 ? "text-gray-900" : "text-gray-500"
          )}>
            Choose Type
          </span>
        </div>
        <div className="flex-1 mx-4">
          <div className="h-1 bg-gray-200 rounded-full">
            <div 
              className="h-1 bg-blue-600 rounded-full transition-all"
              style={{ width: step >= 2 ? '100%' : '0%' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
            step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
          )}>
            2
          </div>
          <span className={cn(
            "text-sm font-medium",
            step >= 2 ? "text-gray-900" : "text-gray-500"
          )}>
            Add Details
          </span>
        </div>
      </div>

      {/* Form Content */}
      {step === 1 && renderTypeSelection()}
      {step === 2 && renderDetailsForm()}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => step === 1 ? router.push('/studio/listings') : setStep(1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        
        {step === 2 && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={isSubmitting}>
              Save as Draft
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Listing'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}