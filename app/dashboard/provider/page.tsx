import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyProviderProfileAction } from "@/actions/providers-actions";
import { ProviderDashboardClient } from "@/components/provider/provider-dashboard-client";

export const metadata: Metadata = {
  title: "Provider Dashboard | Ecosystem",
  description: "Manage your provider profile, bookings, and earnings",
};

export default async function ProviderDashboardPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/login");
  }

  // Get provider profile
  const providerResult = await getMyProviderProfileAction();

  if (!providerResult.isSuccess || !providerResult.data) {
    redirect("/become-a-provider");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ProviderDashboardClient provider={providerResult.data} />
    </div>
  );
}