"use client";

import { useState, useEffect } from "react";
import { Provider } from "@/db/schema/providers-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoSection } from "./BasicInfoSection";
import { ServicesSection } from "./ServicesSection";
import { AvailabilitySection } from "./AvailabilitySection";
import { MediaSection } from "./MediaSection";
import { toast } from "sonner";
import { User, Briefcase, Calendar, Camera, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileEditorProps {
  provider: Provider;
}

interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export function ProfileEditor({ provider: initialProvider }: ProfileEditorProps) {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [activeTab, setActiveTab] = useState("basic");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
  });

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(provider) !== JSON.stringify(initialProvider);
    setSaveStatus(prev => ({ ...prev, hasUnsavedChanges: hasChanges }));
  }, [provider, initialProvider]);

  // Auto-save indicator
  useEffect(() => {
    if (saveStatus.lastSaved) {
      const timer = setTimeout(() => {
        toast.success("All changes saved", {
          icon: <CheckCircle2 className="h-4 w-4" />,
          duration: 2000,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [saveStatus.lastSaved]);

  const handleProviderUpdate = (updatedProvider: Provider) => {
    setProvider(updatedProvider);
    setSaveStatus({
      isSaving: false,
      lastSaved: new Date(),
      hasUnsavedChanges: false,
    });
  };

  const handleSaveStart = () => {
    setSaveStatus(prev => ({ ...prev, isSaving: true }));
  };

  const handleSaveError = (error: string) => {
    setSaveStatus(prev => ({ ...prev, isSaving: false }));
    toast.error(error, {
      icon: <XCircle className="h-4 w-4" />,
      duration: 4000,
    });
  };

  const tabs = [
    {
      value: "basic",
      label: "Basic Info",
      icon: User,
      description: "Name, bio, and location",
    },
    {
      value: "services",
      label: "Services",
      icon: Briefcase,
      description: "Services you offer",
    },
    {
      value: "availability",
      label: "Availability",
      icon: Calendar,
      description: "Your working hours",
    },
    {
      value: "media",
      label: "Media",
      icon: Camera,
      description: "Photos and gallery",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Save Status Bar */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          saveStatus.hasUnsavedChanges && "border-amber-500/50 bg-amber-50/5"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm">
          {saveStatus.isSaving ? (
            <>
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Saving changes...</span>
            </>
          ) : saveStatus.hasUnsavedChanges ? (
            <>
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Unsaved changes</span>
            </>
          ) : saveStatus.lastSaved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">All changes saved</span>
            </>
          ) : (
            <span className="text-muted-foreground">Ready to edit</span>
          )}
        </div>
        {saveStatus.lastSaved && (
          <span className="text-xs text-muted-foreground">
            Last saved {saveStatus.lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-4 bg-transparent p-0 lg:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group relative flex h-auto flex-col items-start gap-2 rounded-lg border bg-background p-4 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground group-data-[state=active]:text-primary" />
                  <span className="font-medium">{tab.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {tab.description}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Content */}
        <div className="rounded-lg border bg-card">
          <TabsContent value="basic" className="m-0 p-6">
            <BasicInfoSection
              provider={provider}
              onUpdate={handleProviderUpdate}
              onSaveStart={handleSaveStart}
              onSaveError={handleSaveError}
            />
          </TabsContent>

          <TabsContent value="services" className="m-0 p-6">
            <ServicesSection
              provider={provider}
              onUpdate={handleProviderUpdate}
              onSaveStart={handleSaveStart}
              onSaveError={handleSaveError}
            />
          </TabsContent>

          <TabsContent value="availability" className="m-0 p-6">
            <AvailabilitySection
              provider={provider}
              onUpdate={handleProviderUpdate}
              onSaveStart={handleSaveStart}
              onSaveError={handleSaveError}
            />
          </TabsContent>

          <TabsContent value="media" className="m-0 p-6">
            <MediaSection
              provider={provider}
              onUpdate={handleProviderUpdate}
              onSaveStart={handleSaveStart}
              onSaveError={handleSaveError}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}