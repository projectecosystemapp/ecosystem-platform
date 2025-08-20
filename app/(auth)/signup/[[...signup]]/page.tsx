"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { claimPendingProfile } from "@/actions/whop-actions";
import { useSignUp } from "@clerk/nextjs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/**
 * Enhanced SignUp Page with Profile Claiming
 * 
 * This page supports the frictionless payment flow by:
 * 1. Reading email and token from URL parameters
 * 2. Pre-filling the email field in the signup form
 * 3. Claiming any pending profiles after successful signup
 * 4. Showing success/error messages appropriately
 */
export default function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();
  
  // States for profile claiming
  const [claimingProfile, setClaimingProfile] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // Add a state to track the signup completion
  const [signupComplete, setSignupComplete] = useState(false);
  
  // Extract email and token from URL params
  const email = searchParams.get("email");
  const token = searchParams.get("token");
  const isPaymentSuccess = searchParams.get("payment") === "success";
  
  // Define handleProfileClaiming with useCallback to avoid dependency issues
  const handleProfileClaiming = useCallback(async (userId: string) => {
    if (!email) return;
    
    try {
      setClaimingProfile(true);
      
      console.log(`Attempting to claim profile for user ${userId} with email ${email}`);
      
      // Call the action to claim the profile
      const result = await claimPendingProfile(userId, email, token || undefined);
      
      console.log(`Profile claim result:`, result);
      
      if (result.success) {
        setClaimResult({
          success: true,
          message: "Your purchase has been successfully linked to your account!"
        });
        
        // Redirect to dashboard after a short delay with payment=success parameter
        setTimeout(() => {
          router.push("/dashboard?payment=success");
        }, 2000);
      } else {
        setClaimResult({
          success: false,
          message: result.error || "Failed to link your purchase to your account."
        });
        
        // Even if there's an error, redirect to dashboard after a slightly longer delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
      }
    } catch (error) {
      console.error("Error in handleProfileClaiming:", error);
      setClaimResult({
        success: false,
        message: "An unexpected error occurred while linking your purchase."
      });
      
      // Redirect to dashboard even after an exception
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } finally {
      setClaimingProfile(false);
    }
  }, [email, token, router]);

  // Handle redirect after signup completes
  useEffect(() => {
    const checkAndClaimProfile = async () => {
      console.log("Signup status check:", {
        isLoaded,
        signUpStatus: signUp?.status,
        hasUserId: !!signUp?.createdUserId,
        hasEmail: !!email,
        signUpCompleted: isLoaded && signUp?.status === 'complete'
      });
      
      if (isLoaded && signUp?.status === 'complete') {
        console.log("Signup complete, setting signupComplete state");
        setSignupComplete(true);
        
        // Only attempt to claim if we have both email and userId
        if (email && signUp?.createdUserId) {
          console.log("Attempting to claim profile", {
            userId: signUp.createdUserId,
            email,
            hasToken: !!token
          });
          
          try {
            await handleProfileClaiming(signUp.createdUserId);
          } catch (error) {
            console.error("Error claiming profile:", error);
            // Even if claiming fails, redirect to dashboard after a short delay
            setTimeout(() => {
              router.push("/dashboard");
            }, 2000);
          }
        } else {
          // If no purchase to claim, just redirect to dashboard
          console.log("No email found, redirecting to dashboard without claiming");
          router.push("/dashboard");
        }
      }
    };
    
    checkAndClaimProfile();
  }, [isLoaded, signUp?.status, signUp?.createdUserId, email, token, router, handleProfileClaiming]);
  
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
      {!signupComplete && (
        <SignUp 
          appearance={{ 
            elements: {
              rootBox: "w-full",
              card: "shadow-md rounded-lg"
            }
          }}
          initialValues={email ? { emailAddress: email } : undefined}
        />
      )}
      
      {/* Post-signup processing message */}
      {signupComplete && !claimingProfile && !claimResult && (
        <div className="w-full p-6 border border-gray-200 rounded-lg shadow-md bg-white dark:bg-gray-800 text-center">
          <h2 className="text-xl font-semibold mb-4">Account Created Successfully!</h2>
          
          {email ? (
            <div className="flex flex-col items-center">
              <p className="mb-4">Checking for pending purchases...</p>
              <Loader2 className="animate-spin h-8 w-8 text-purple-600 mb-4" />
            </div>
          ) : (
            <p>You will be redirected to the dashboard shortly.</p>
          )}
        </div>
      )}
      
      {/* Profile claiming status */}
      {claimingProfile && (
        <div className="mt-4 flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-md">
          <Loader2 className="animate-spin h-5 w-5 mr-2 text-purple-600" />
          <span>Linking your purchase to your new account...</span>
        </div>
      )}
      
      {/* Claim result message */}
      {claimResult && (
        <Alert 
          className={`mt-4 ${
            claimResult.success 
              ? "border-green-200 bg-green-50 text-green-800" 
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {claimResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle>{claimResult.success ? "Success!" : "Something went wrong"}</AlertTitle>
          <AlertDescription>{claimResult.message}</AlertDescription>
          
          {!claimResult.success && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => router.push("/dashboard")}
            >
              Continue Anyway
            </Button>
          )}
        </Alert>
      )}
    </div>
  );
}
