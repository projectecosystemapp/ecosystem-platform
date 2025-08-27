"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Clock, 
  Save,
  X,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Provider } from "@/db/schema/providers-schema";
import { updateProviderServicesAction } from "@/actions/providers-actions";
import { 
  Service, 
  serviceSchema,
  DURATION_OPTIONS,
  formatDuration,
  formatPrice
} from "@/lib/validations/services";
import { z } from "zod";

interface ServiceManagementPanelProps {
  provider: Provider;
  onUpdate?: () => void;
}

export function ServiceManagementPanel({ provider, onUpdate }: ServiceManagementPanelProps) {
  const [services, setServices] = useState<Service[]>(
    (provider.services as Service[]) || []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Service form dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Service>({
    name: "",
    description: "",
    duration: 60,
    price: 0,
  });

  const handleAddService = () => {
    setEditingService(null);
    setEditingIndex(null);
    setFormData({
      name: "",
      description: "",
      duration: 60,
      price: 0,
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleEditService = (service: Service, index: number) => {
    setEditingService(service);
    setEditingIndex(index);
    setFormData(service);
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleDeleteService = (index: number) => {
    setDeleteIndex(index);
  };

  const confirmDelete = () => {
    if (deleteIndex !== null) {
      const newServices = services.filter((_, i) => i !== deleteIndex);
      setServices(newServices);
      setDeleteIndex(null);
      setIsEditing(true);
      toast.success("Service removed. Remember to save your changes.");
    }
  };

  const handleSaveService = () => {
    try {
      // Validate the service data
      const validatedService = serviceSchema.parse(formData);
      
      const newServices = [...services];
      if (editingIndex !== null) {
        // Update existing service
        newServices[editingIndex] = validatedService;
        toast.success("Service updated");
      } else {
        // Add new service
        newServices.push(validatedService);
        toast.success("Service added");
      }
      
      setServices(newServices);
      setIsDialogOpen(false);
      setIsEditing(true);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error("Failed to save service");
      }
    }
  };

  const handleSaveAll = async () => {
    if (services.length === 0) {
      toast.error("You must have at least one service");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProviderServicesAction(services);
      
      if (result.isSuccess) {
        toast.success("Services updated successfully!");
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } else {
        toast.error(result.message || "Failed to update services");
      }
    } catch (error) {
      console.error("Error updating services:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setServices((provider.services as Service[]) || []);
    setIsEditing(false);
    toast.info("Changes discarded");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Services Management
              </CardTitle>
              <CardDescription>
                Manage the services you offer to customers
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAll}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-medium mb-2">No services yet</h3>
              <p className="text-gray-600 mb-4">
                Add services that customers can book
              </p>
              <Button onClick={handleAddService} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Service
              </Button>
            </div>
          ) : (
            <>
              <AnimatePresence mode="sync">
                {services.map((service, index) => (
                  <motion.div
                    key={`service-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{service.name}</h4>
                        <p className="text-gray-600 text-sm mt-1">
                          {service.description}
                        </p>
                        <div className="flex gap-4 mt-3">
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="w-4 h-4" />
                            {formatDuration(service.duration)}
                          </span>
                          <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                            <DollarSign className="w-4 h-4" />
                            {formatPrice(service.price, provider.currency || "usd")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditService(service, index)}
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
                  </motion.div>
                ))}
              </AnimatePresence>

              <Button
                onClick={handleAddService}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Service
              </Button>
            </>
          )}

          {isEditing && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Remember to save before leaving this page.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Service Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Service" : "Add New Service"}
            </DialogTitle>
            <DialogDescription>
              Define the details of your service offering
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Service Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Deep Tissue Massage"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's included in this service..."
                rows={3}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(value) => 
                    setFormData({ ...formData, duration: parseInt(value) })
                  }
                >
                  <SelectTrigger id="duration" className={errors.duration ? "border-red-500" : ""}>
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
                {errors.duration && (
                  <p className="text-sm text-red-500">{errors.duration}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">
                  Price <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">$</span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => 
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    className={errors.price ? "border-red-500" : ""}
                  />
                </div>
                {errors.price && (
                  <p className="text-sm text-red-500">{errors.price}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveService}>
              {editingIndex !== null ? "Update Service" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
