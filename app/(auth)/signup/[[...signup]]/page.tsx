"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * SignUp Page
 * 
 * Simple signup page using Clerk authentication.
 * Redirects to dashboard after successful signup.
 */
export default function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();
  
  // Extract email from URL params (if provided)
  const email = searchParams.get("email");
  const isPaymentSuccess = searchParams.get("payment") === "success";

  // Handle redirect after signup completes
  useEffect(() => {
    if (isLoaded && signUp?.status === 'complete') {
      // Redirect to dashboard after successful signup
      router.push(isPaymentSuccess ? "/dashboard?payment=success" : "/dashboard");
    }
  }, [isLoaded, signUp?.status, router, isPaymentSuccess]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-md">
      {/* Payment success notification */}
      {isPaymentSuccess && (
        <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Payment Successful!</AlertTitle>
          <AlertDescription>
            Complete signup to activate your subscription.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Clerk SignUp component */}
      <SignUp 
        appearance={{ 
          elements: {
            rootBox: "w-full",
            card: "shadow-md rounded-lg"
          }
        }}
        initialValues={email ? { emailAddress: email } : undefined}
      />
    </div>
  );
}