import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LoyaltyDashboard from "@/components/loyalty/loyalty-dashboard";

export const metadata = {
  title: "Loyalty Program - ECOSYSTEM",
  description: "View your loyalty points, tier status, and redeem rewards",
};

export default async function LoyaltyPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Loyalty Program</h1>
        <p className="text-muted-foreground">
          Earn points on every booking and unlock exclusive rewards
        </p>
      </div>
      
      <LoyaltyDashboard userId={userId} />
    </div>
  );
}