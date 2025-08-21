"use client";

import { Clock, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface Service {
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
}

interface ProviderServicesProps {
  services: Service[];
  currency: string;
  onBookService: (service: Service) => void;
}

export function ProviderServices({ services, currency, onBookService }: ProviderServicesProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    return `${hours}h ${mins}min`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <Card className="p-6 lg:p-8">
      <h2 className="text-2xl font-bold mb-6">Services Offered</h2>
      
      <div className="space-y-4">
        {services.map((service, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {service.name}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xl font-bold text-blue-600">
                      {formatPrice(service.price)}
                    </span>
                    {service.duration && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(service.duration)}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {service.description && (
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {service.description}
                  </p>
                )}
                
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50"
                    onClick={() => onBookService(service)}
                  >
                    Book This Service
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Prices may vary based on specific requirements. 
          Final pricing will be confirmed during booking.
        </p>
      </div>
    </Card>
  );
}