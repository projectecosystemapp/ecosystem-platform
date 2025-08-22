"use server";

import { createProfile, deleteProfile, getAllProfiles, getProfileByUserId, updateProfile, getUserPlanInfo } from "@/db/queries/profiles-queries";
import { InsertProfile, SelectProfile } from "@/db/schema/profiles-schema";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

export async function createProfileAction(data: InsertProfile): Promise<ActionResult<SelectProfile>> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: Please sign in" };
    }
    
    // Ensure the profile being created matches the authenticated user
    if (data.userId !== userId) {
      console.error(`[SECURITY] User ${userId} attempted to create profile for different user ${data.userId}`);
      return { isSuccess: false, message: "Unauthorized: Cannot create profile for another user" };
    }
    
    const newProfile = await createProfile(data);
    
    // Audit log
    console.log(`[AUDIT] User ${userId} created profile at ${new Date().toISOString()}`);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile created successfully", data: newProfile };
  } catch (error) {
    return { isSuccess: false, message: "Failed to create profile" };
  }
}

export async function getProfileByUserIdAction(requestedUserId: string): Promise<ActionResult<SelectProfile | null>> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: Please sign in" };
    }
    
    // Only allow users to fetch their own profile unless they're an admin
    if (userId !== requestedUserId) {
      console.warn(`[SECURITY] User ${userId} attempted to access profile of user ${requestedUserId}`);
      // For now, allow this but log it. In production, this should check admin role
      // return { isSuccess: false, message: "Unauthorized: Cannot access other user profiles" };
    }
    
    const profile = await getProfileByUserId(requestedUserId);
    return { isSuccess: true, message: "Profile retrieved successfully", data: profile };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get profiles" };
  }
}

export async function getAllProfilesAction(): Promise<ActionResult<SelectProfile[]>> {
  try {
    // Authentication check - this should be admin-only
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: Please sign in" };
    }
    
    // TODO: Add admin role check when role system is implemented
    console.log(`[AUDIT] User ${userId} accessed all profiles at ${new Date().toISOString()}`);
    
    const profiles = await getAllProfiles();
    return { isSuccess: true, message: "Profiles retrieved successfully", data: profiles };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get profiles" };
  }
}

export async function updateProfileAction(targetUserId: string, data: Partial<InsertProfile>): Promise<ActionResult<SelectProfile>> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: Please sign in" };
    }
    
    // Only allow users to update their own profile
    if (userId !== targetUserId) {
      console.error(`[SECURITY] User ${userId} attempted to update profile of user ${targetUserId}`);
      return { isSuccess: false, message: "Unauthorized: Cannot update another user's profile" };
    }
    
    // Prevent updating userId field
    if (data.userId && data.userId !== userId) {
      console.error(`[SECURITY] User ${userId} attempted to change userId to ${data.userId}`);
      return { isSuccess: false, message: "Unauthorized: Cannot change user ID" };
    }
    
    const updatedProfile = await updateProfile(targetUserId, data);
    
    // Audit log
    console.log(`[AUDIT] User ${userId} updated their profile at ${new Date().toISOString()}`);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile updated successfully", data: updatedProfile };
  } catch (error) {
    return { isSuccess: false, message: "Failed to update profile" };
  }
}

export async function deleteProfileAction(targetUserId: string): Promise<ActionResult<void>> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized: Please sign in" };
    }
    
    // Only allow users to delete their own profile
    if (userId !== targetUserId) {
      console.error(`[SECURITY] User ${userId} attempted to delete profile of user ${targetUserId}`);
      return { isSuccess: false, message: "Unauthorized: Cannot delete another user's profile" };
    }
    
    // Audit log - important for GDPR compliance
    console.log(`[AUDIT] User ${userId} deleted their profile at ${new Date().toISOString()}`);
    
    await deleteProfile(targetUserId);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile deleted successfully" };
  } catch (error) {
    return { isSuccess: false, message: "Failed to delete profile" };
  }
}

/**
 * Check if the current user's payment has failed
 * This is used by the PaymentStatusAlert component
 * Efficient: Only returns the boolean flag, not the entire profile
 */
export async function checkPaymentFailedAction(): Promise<{ paymentFailed: boolean }> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { paymentFailed: false };
    }
    
    const profile = await getProfileByUserId(userId);
    return { paymentFailed: profile?.status === "payment_failed" || false };
  } catch (error) {
    console.error("Error checking payment status:", error);
    return { paymentFailed: false };
  }
}

/**
 * Get the current user's plan information including membership type and duration
 * This is used to display subscription details in the UI
 */
export async function getUserPlanInfoAction(): Promise<ActionResult<{
  membership: string;
  planDuration: string | null;
  status: string | null;
  usageCredits: number | null;
  usedCredits: number | null;
  billingCycleStart: Date | null;
  billingCycleEnd: Date | null;
  nextCreditRenewal: Date | null;
} | null>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { 
        isSuccess: false, 
        message: "User not authenticated" 
      };
    }
    
    const planInfo = await getUserPlanInfo(userId);
    
    if (!planInfo) {
      return { 
        isSuccess: false, 
        message: "No plan information found" 
      };
    }
    
    return { 
      isSuccess: true, 
      message: "Plan information retrieved successfully", 
      data: planInfo 
    };
  } catch (error) {
    console.error("Error getting user plan information:", error);
    return { 
      isSuccess: false, 
      message: "Failed to get plan information" 
    };
  }
}
