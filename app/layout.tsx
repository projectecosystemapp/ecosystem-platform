import { getProfileByUserIdAction } from "@/actions/profiles-actions";
import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { ClerkProvider } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createProfileAction } from "@/actions/profiles-actions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ECOSYSTEM Marketplace",
  description: "A modern two-sided marketplace connecting service providers with customers."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();

  if (userId) {
    try {
      // First check if the user already has a profile
      const res = await getProfileByUserIdAction(userId);
      
      if (!res.data) {
        // No profile exists for this user, so we might need to create one
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        
        if (email) {
          // Create profile with email
          console.log(`Creating new profile for user ${userId} with email ${email}`);
          await createProfileAction({ 
            userId,
            email
          });
        } else {
          // No email available, create a basic profile
          console.log(`Creating basic profile for user ${userId} with no email`);
          await createProfileAction({ userId });
        }
      }
    } catch (error) {
      console.error("Error checking/creating user profile:", error);
    }
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <LayoutWrapper>
              {userId && <PaymentStatusAlert />}
              {children}
            </LayoutWrapper>
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
