"use client";

import { motion } from "framer-motion";
import { Clock, DollarSign, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Service {
  name: string;
  description: string;
  duration: number;
  price: number;
}

interface ProviderServicesProps {
  services: Service[];
  currency: string;
  providerId: string;
}

export default function ProviderServices({
  services,
  currency,
  providerId,
}: ProviderServicesProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}min`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      return `${mins} minutes`;
    }
  };

  const formatPrice = (price: number) => {
    const currencySymbol = currency === "usd" ? "$" : currency.toUpperCase();
    return `${currencySymbol}${price.toFixed(2)}`;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Services Offered
            </CardTitle>
            <CardDescription className="mt-1">
              Choose from {services.length} professional service{services.length > 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-white">
            {services.length} Available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group hover:bg-gray-50 transition-colors"
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-gray-600 mb-3 leading-relaxed">
                      {service.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>{formatDuration(service.duration)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium text-gray-900">
                        <DollarSign className="h-4 w-4 text-green-600" aria-hidden="true" />
                        <span className="text-lg">{formatPrice(service.price)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 group/btn"
                      onClick={() => {
                        // Handle booking for specific service
                        console.log("Book service:", service.name);
                      }}
                    >
                      Book This Service
                      <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}