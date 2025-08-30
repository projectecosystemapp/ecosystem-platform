/**
 * Providers Listing Page - Simplified for cleanup
 */

'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProvidersPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Service Providers</h1>
          <p className="text-muted-foreground mb-6">
            Find and connect with trusted service providers in your area.
          </p>
          
          <div className="flex gap-4 max-w-md">
            <Input
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button>Search</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for providers - will be implemented in future iteration */}
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Provider listings will be available soon. The marketplace is being actively developed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}