/**
 * Services Step Component
 * 
 * Allows providers to define the services they offer with pricing and duration
 */

"use client";

import { useState } from "react";
import { useProviderOnboardingStore } from "@/lib/stores/provider-onboarding-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Clock, DollarSign, InfoIcon } from "lucide-react";

export default function ServicesStep() {
  const { 
    servicesInfo, 
    addService, 
    updateService, 
    removeService, 
    stepValidation, 
    currentStep 
  } = useProviderOnboardingStore();
  
  const validation = stepValidation[currentStep];
  const [isAdding, setIsAdding] = useState(false);

  const handleAddService = () => {
    addService({
      id: Date.now().toString(), // Generate unique ID
      name: "",
      description: "",
      duration: 60,
      price: 5000, // $50 default
    });
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Define the services you offer. Be specific about what's included in each service.
        </AlertDescription>
      </Alert>

      {/* Services List */}
      <div className="space-y-4">
        {(!servicesInfo.services || servicesInfo.services.length === 0) && !isAdding ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-8">
              <p className="text-gray-500 mb-4">No services added yet</p>
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {servicesInfo.services && servicesInfo.services.map((service: any, index: number) => (
              <Card key={service.id}>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Service Name */}
                    <div>
                      <Label htmlFor={`service-name-${service.id}`}>
                        Service Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`service-name-${service.id}`}
                        value={service.name}
                        onChange={(e) => updateService(service.id, { name: e.target.value })}
                        placeholder="e.g., Basic Plumbing Repair"
                        maxLength={100}
                      />
                      {validation?.errors?.[`service_${index}_name`] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validation.errors[`service_${index}_name`]}
                        </p>
                      )}
                    </div>

                    {/* Service Description */}
                    <div>
                      <Label htmlFor={`service-desc-${service.id}`}>
                        Description <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id={`service-desc-${service.id}`}
                        value={service.description}
                        onChange={(e) => updateService(service.id, { description: e.target.value })}
                        placeholder="Describe what this service includes..."
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {service.description.length}/500 characters
                      </p>
                      {validation?.errors?.[`service_${index}_description`] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validation.errors[`service_${index}_description`]}
                        </p>
                      )}
                    </div>

                    {/* Duration and Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`service-duration-${service.id}`}>
                          <Clock className="w-4 h-4 inline mr-1" />
                          Duration (minutes) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`service-duration-${service.id}`}
                          type="number"
                          min="15"
                          max="480"
                          step="15"
                          value={service.duration}
                          onChange={(e) => updateService(service.id, { 
                            duration: Number(e.target.value) 
                          })}
                        />
                        {validation?.errors?.[`service_${index}_duration`] && (
                          <p className="text-sm text-red-500 mt-1">
                            {validation.errors[`service_${index}_duration`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`service-price-${service.id}`}>
                          <DollarSign className="w-4 h-4 inline mr-1" />
                          Price (USD) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`service-price-${service.id}`}
                          type="number"
                          min="5"
                          max="10000"
                          step="5"
                          value={service.price / 100}
                          onChange={(e) => updateService(service.id, { 
                            price: Number(e.target.value) * 100 
                          })}
                        />
                        {validation?.errors?.[`service_${index}_price`] && (
                          <p className="text-sm text-red-500 mt-1">
                            {validation.errors[`service_${index}_price`]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Remove Service Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeService(service.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Service
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Service Button */}
            {servicesInfo.services && servicesInfo.services.length < 20 && (
              <Button
                variant="outline"
                onClick={handleAddService}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Service
              </Button>
            )}
          </>
        )}
      </div>

      {/* Validation Error */}
      {validation?.errors?.general && (
        <Alert variant="destructive">
          <AlertDescription>{validation.errors.general}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}