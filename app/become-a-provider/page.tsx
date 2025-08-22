/**
 * Provider Onboarding Main Page
 * 
 * Business Context:
 * - Entry point for the provider onboarding flow
 * - Uses the new OnboardingWizard component with zustand store
 * - Checks for existing provider profile and redirects if found
 * 
 * Technical Decisions:
 * - Server component that checks auth and existing profile
 * - Redirects to dashboard if provider already exists
 * - Renders client-side OnboardingWizard for the form
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProviderByUserId } from "@/db/queries/providers-queries";
import OnboardingWizard from "@/components/provider/onboarding/OnboardingWizard";

export const metadata: Metadata = {
  title: "Become a Provider | Ecosystem Platform",
  description: "Join thousands of professionals building thriving businesses on our platform. Set your own rates, manage your schedule, and grow your client base.",
  openGraph: {
    title: "Become a Provider | Ecosystem Platform",
    description: "Turn your expertise into income. Join our community of service providers.",
    type: "website",
  },
};

export default async function BecomeAProviderPage() {
  // Check authentication
  const { userId } = auth();
  
  if (!userId) {
    // Redirect to login with return URL
    redirect("/login?redirectUrl=/become-a-provider");
  }

  // Check if user already has a provider profile
  const existingProvider = await getProviderByUserId(userId);
  
  if (existingProvider) {
    // Redirect to provider dashboard if they already have a profile
    redirect("/dashboard/provider");
  }

  // Render the onboarding wizard
  return <OnboardingWizard />;
}