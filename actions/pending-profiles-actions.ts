"use server";

import { 
  getPendingProfileByEmail, 
  getUnclaimedPendingProfiles, 
  markPendingProfileAsClaimed,
  deletePendingProfile 
} from "@/db/queries/pending-profiles-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

// Input validation schemas
const emailSchema = z.string().email();
const uuidSchema = z.string().uuid();

export async function getPendingProfileByEmailAction(email: string) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized: Please sign in" };
    }
    
    // Validate email input
    const validatedEmail = emailSchema.parse(email);
    
    // Audit log for privacy-sensitive operation
    console.log(`[AUDIT] User ${userId} queried pending profile for email at ${new Date().toISOString()}`);
    
    const profile = await getPendingProfileByEmail(validatedEmail);
    return { success: true, data: profile };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid email format" };
    }
    console.error("Error getting pending profile by email:", error);
    return { success: false, error: "Failed to get pending profile" };
  }
}

export async function getUnclaimedPendingProfilesAction() {
  try {
    // Authentication check - this should be admin-only
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized: Please sign in" };
    }
    
    // TODO: Add admin role check when role system is implemented
    console.log(`[AUDIT] User ${userId} accessed unclaimed pending profiles at ${new Date().toISOString()}`);
    
    const profiles = await getUnclaimedPendingProfiles();
    return { success: true, data: profiles };
  } catch (error) {
    console.error("Error getting unclaimed pending profiles:", error);
    return { success: false, error: "Failed to get unclaimed profiles" };
  }
}

export async function markPendingProfileAsClaimedAction(id: string, claimingUserId: string) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized: Please sign in" };
    }
    
    // Validate inputs
    const validatedId = uuidSchema.parse(id);
    const validatedClaimingUserId = z.string().min(1).parse(claimingUserId);
    
    // Verify the authenticated user is claiming for themselves
    if (userId !== validatedClaimingUserId) {
      console.error(`[SECURITY] User ${userId} attempted to claim pending profile ${id} for different user ${validatedClaimingUserId}`);
      return { success: false, error: "Unauthorized: Cannot claim profile for another user" };
    }
    
    // Audit log for profile claiming
    console.log(`[AUDIT] User ${userId} claimed pending profile ${validatedId} at ${new Date().toISOString()}`);
    
    const updated = await markPendingProfileAsClaimed(validatedId, validatedClaimingUserId);
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input format" };
    }
    console.error("Error marking pending profile as claimed:", error);
    return { success: false, error: "Failed to mark profile as claimed" };
  }
}

export async function deletePendingProfileAction(id: string) {
  try {
    // Authentication check - this should be admin-only
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized: Please sign in" };
    }
    
    // Validate input
    const validatedId = uuidSchema.parse(id);
    
    // TODO: Add admin role check when role system is implemented
    // For now, log this sensitive operation
    console.log(`[AUDIT] User ${userId} deleted pending profile ${validatedId} at ${new Date().toISOString()}`);
    
    const deleted = await deletePendingProfile(validatedId);
    return { success: true, data: deleted };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid profile ID format" };
    }
    console.error("Error deleting pending profile:", error);
    return { success: false, error: "Failed to delete pending profile" };
  }
} 