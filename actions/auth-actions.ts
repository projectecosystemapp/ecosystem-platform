"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getProfileByUserIdAction, createProfileAction } from "@/actions/profiles-actions";

export async function ensureUserProfileAction() {
  const { userId } = auth();
  
  if (!userId) {
    return { isSuccess: false, message: "Not authenticated" };
  }

  try {
    // Check if profile already exists
    const existingProfile = await getProfileByUserIdAction(userId);
    
    if (existingProfile.data) {
      return { isSuccess: true, data: existingProfile.data };
    }

    // Create new profile if it doesn't exist
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    
    const result = await createProfileAction({ 
      userId,
      email: email || undefined
    });
    
    return result;
  } catch (error) {
    console.error("Error ensuring user profile:", error);
    return { 
      isSuccess: false, 
      message: "Failed to ensure user profile" 
    };
  }
}