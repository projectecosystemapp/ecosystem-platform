import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyProviderProfileAction } from "@/actions/providers-actions";
import { ProfileEditor } from "@/components/provider/profile/ProfileEditor";

export const metadata: Metadata = {
  title: "Edit Profile | Provider Dashboard",
  description: "Manage and update your provider profile information",
};

export default async function ProviderProfileEditPage() {
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
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your provider profile and keep your information up to date
        </p>
      </div>
      
      <ProfileEditor provider={providerResult.data} />
    </div>
  );
}