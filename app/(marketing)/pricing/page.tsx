import { auth } from "@clerk/nextjs/server";
import dynamic from "next/dynamic";

const PricingPageClient = dynamic(() => import("./pricing-page-client"), { ssr: true });

export default async function PricingPage() {
  const { userId } = auth();

  // Pricing values (updated to match design)
  const monthlyPrice = "$30";
  const yearlyPrice = "$249";

  return (
    <PricingPageClient 
      userId={userId}
      stripeMonthlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY || "#"}
      stripeYearlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY || "#"}
      monthlyPrice={monthlyPrice}
      yearlyPrice={yearlyPrice}
    />
  );
}
