"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Clock,
  Edit,
  Package,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OnboardingData } from "@/app/become-a-provider/onboarding/page";

interface ServicesPricingStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}

interface ServiceFormData {
  name: string;
  description: string;
  duration: number;
  price: number;
}

const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "Full day (8 hours)" },
];

export default function ServicesPricingStep({
  data,
  updateData,
  errors,
}: ServicesPricingStepProps) {
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    name: "",
    description: "",
    duration: 60,
    price: 0,
  });
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});

  const validateService = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!serviceForm.name) errors.name = "Service name is required";
    if (!serviceForm.description) errors.description = "Description is required";
    if (serviceForm.price <= 0) errors.price = "Price must be greater than 0";
    
    setServiceErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddService = () => {
    if (!validateService()) return;

    const updatedServices = [...data.services];
    
    if (editingIndex !== null) {
      updatedServices[editingIndex] = serviceForm;
    } else {
      updatedServices.push(serviceForm);
    }
    
    updateData({ services: updatedServices });
    
    // Reset form
    setServiceForm({
      name: "",
      description: "",
      duration: 60,
      price: 0,
    });
    setServiceErrors({});
    setIsAddingService(false);
    setEditingIndex(null);
  };

  const handleEditService = (index: number) => {
    setServiceForm(data.services[index]);
    setEditingIndex(index);
    setIsAddingService(true);
  };

  const handleDeleteService = (index: number) => {
    const updatedServices = data.services.filter((_, i) => i !== index);
    updateData({ services: updatedServices });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Services Offered
          </CardTitle>
          <CardDescription>
            Define the services you offer to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service List */}
          {data.services.length > 0 ? (
            <div className="space-y-3">
              {data.services.map((service, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{service.name}</h4>
                      <p className="text-gray-600 text-sm mt-1">{service.description}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-4 h-4" />
                          {formatDuration(service.duration)}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-green-600">
                          <DollarSign className="w-4 h-4" />
                          ${service.price}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditService(index)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteService(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-4">No services added yet</p>
              <Button
                onClick={() => setIsAddingService(true)}
                variant="outline"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Your First Service
              </Button>
            </div>
          )}

          {data.services.length > 0 && (
            <Button
              onClick={() => setIsAddingService(true)}
              variant="outline"
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Service
            </Button>
          )}

          {errors.services && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.services}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Base Hourly Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Base Pricing
          </CardTitle>
          <CardDescription>
            Set your default hourly rate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hourlyRate">
              Hourly Rate <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">$</span>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                step="5"
                value={data.hourlyRate}
                onChange={(e) => updateData({ hourlyRate: parseFloat(e.target.value) || 0 })}
                className={errors.hourlyRate ? "border-red-500" : ""}
                placeholder="50"
              />
              <span className="text-gray-600">per hour</span>
            </div>
            {errors.hourlyRate && (
              <p className="text-sm text-red-500">{errors.hourlyRate}</p>
            )}
            <p className="text-sm text-gray-600">
              This rate will be used for custom bookings not covered by your services
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={data.currency}
              onValueChange={(value) => updateData({ currency: value })}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD - US Dollar</SelectItem>
                <SelectItem value="eur">EUR - Euro</SelectItem>
                <SelectItem value="gbp">GBP - British Pound</SelectItem>
                <SelectItem value="cad">CAD - Canadian Dollar</SelectItem>
                <SelectItem value="aud">AUD - Australian Dollar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tips */}
      <Alert>
        <DollarSign className="h-4 w-4" />
        <AlertDescription>
          <strong>Pricing Tips:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Research competitor pricing in your area</li>
            <li>• Consider offering package deals for better value</li>
            <li>• You can always adjust your prices later</li>
            <li>• Remember, the platform takes a 15% commission on bookings</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Add/Edit Service Dialog */}
      <Dialog open={isAddingService} onOpenChange={setIsAddingService}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Service" : "Add New Service"}
            </DialogTitle>
            <DialogDescription>
              Define a service package that customers can book
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">
                Service Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="serviceName"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="e.g., Portrait Photography Session"
                className={serviceErrors.name ? "border-red-500" : ""}
              />
              {serviceErrors.name && (
                <p className="text-sm text-red-500">{serviceErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="serviceDescription"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Describe what's included in this service..."
                rows={3}
                className={serviceErrors.description ? "border-red-500" : ""}
              />
              {serviceErrors.description && (
                <p className="text-sm text-red-500">{serviceErrors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceDuration">Duration</Label>
                <Select
                  value={serviceForm.duration.toString()}
                  onValueChange={(value) => setServiceForm({ ...serviceForm, duration: parseInt(value) })}
                >
                  <SelectTrigger id="serviceDuration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="servicePrice">
                  Price <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <Input
                    id="servicePrice"
                    type="number"
                    min="0"
                    step="5"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
                    className={serviceErrors.price ? "border-red-500" : ""}
                  />
                </div>
                {serviceErrors.price && (
                  <p className="text-sm text-red-500">{serviceErrors.price}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingService(false);
                setEditingIndex(null);
                setServiceForm({
                  name: "",
                  description: "",
                  duration: 60,
                  price: 0,
                });
                setServiceErrors({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddService}>
              {editingIndex !== null ? "Update Service" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}