"use server";

import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { InsertProfile, profilesTable, SelectProfile } from "../schema/profiles-schema";

export const createProfile = async (data: InsertProfile) => {
  try {
    // Set default values only if they are not provided
    const profileData = {
      ...data,
      // Default to free membership if not specified
      membership: data.membership || "free",
      status: data.status || "active"
    };
    
    console.log(`Creating profile with data:`, {
      userId: profileData.userId,
      email: profileData.email,
      membership: profileData.membership,
      status: profileData.status
    });
    
    const [newProfile] = await db.insert(profilesTable).values(profileData).returning();
    return newProfile;
  } catch (error) {
    console.error("Error creating profile:", error);
    throw new Error("Failed to create profile");
  }
};

export const getProfileByUserId = async (userId: string) => {
  try {
    console.log(`Looking up profile by user ID: ${userId}`);
    
    // Increase timeout from 5 to 10 seconds for more reliability in serverless environments
    const profiles = await Promise.race([
      db.select().from(profilesTable).where(eq(profilesTable.userId, userId)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database query timeout")), 10000)
      )
    ]) as SelectProfile[];
    
    if (profiles && profiles.length > 0) {
      return profiles[0];
    }
    return null;
  } catch (error) {
    console.error("Error getting profile by user ID:", error);
    return null;
  }
};

export const getAllProfiles = async (): Promise<SelectProfile[]> => {
  return db.query.profiles.findMany();
};

export const updateProfile = async (userId: string, data: Partial<InsertProfile>) => {
  try {
    const [updatedProfile] = await db.update(profilesTable).set(data).where(eq(profilesTable.userId, userId)).returning();
    return updatedProfile;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw new Error("Failed to update profile");
  }
};

export const updateProfileByStripeCustomerId = async (stripeCustomerId: string, data: Partial<InsertProfile>) => {
  try {
    const [updatedProfile] = await db.update(profilesTable).set(data).where(eq(profilesTable.stripeCustomerId, stripeCustomerId)).returning();
    return updatedProfile;
  } catch (error) {
    console.error("Error updating profile by stripe customer ID:", error);
    throw new Error("Failed to update profile");
  }
};

export const deleteProfile = async (userId: string) => {
  try {
    await db.delete(profilesTable).where(eq(profilesTable.userId, userId));
  } catch (error) {
    console.error("Error deleting profile:", error);
    throw new Error("Failed to delete profile");
  }
};

// @deprecated - Whop integration has been removed. This function is kept for backwards compatibility but does nothing.
export const updateProfileByWhopUserId = async (whopUserId: string, data: Partial<InsertProfile>) => {
  console.warn("updateProfileByWhopUserId is deprecated. Whop integration has been removed.");
  return null;
};

// @deprecated - Whop integration has been removed. This function is kept for backwards compatibility but does nothing.
export const getProfileByWhopUserId = async (whopUserId: string) => {
  console.warn("getProfileByWhopUserId is deprecated. Whop integration has been removed.");
  return null;
};

// Enhanced function to get profile by email
export const getProfileByUserEmail = async (email: string) => {
  if (!email) {
    console.error("Email is required for profile lookup");
    return null;
  }

  try {
    // Log the operation
    console.log(`Looking up profile by user email: ${email}`);
    
    // Add a timeout to prevent hanging connections
    const profiles = await Promise.race([
      db.select().from(profilesTable).where(eq(profilesTable.email, email)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database query timeout")), 5000)
      )
    ]) as SelectProfile[];
    
    if (profiles && profiles.length > 0) {
      const profile = profiles[0];
      console.log(`Found profile for email ${email}: userId=${profile.userId}`);
      return profile;
    } else {
      console.log(`No profile found with email: ${email}`);
      return null;
    }
  } catch (error) {
    console.error("Error looking up profile by email:", error);
    return null;
  }
};

// For the frictionless payment flow - function with standardized name
export const getProfileByEmail = async (email: string) => {
  try {
    // Query profiles with matching email
    const profiles = await db.select().from(profilesTable).where(eq(profilesTable.email, email));
    return profiles[0] || null;
  } catch (error) {
    console.error("Error getting profile by email:", error);
    return null;
  }
};

// Add a utility function to get plan information
export const getUserPlanInfo = async (userId: string) => {
  try {
    console.log(`Getting plan information for user: ${userId}`);
    const profile = await getProfileByUserId(userId);
    
    if (!profile) {
      console.warn(`No profile found for user: ${userId}`);
      return null;
    }
    
    return {
      membership: profile.membership,
      status: profile.status || null
    };
  } catch (error) {
    console.error("Error getting user plan information:", error);
    return null;
  }
};

// Delete profile by ID (works with both regular and temporary IDs)
export const deleteProfileById = async (profileId: string) => {
  try {
    console.log(`Deleting profile with ID: ${profileId}`);
    
    if (!profileId) {
      throw new Error("Profile ID is required");
    }
    
    await db.delete(profilesTable).where(eq(profilesTable.userId, profileId));
    console.log(`Successfully deleted profile with ID: ${profileId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting profile with ID ${profileId}:`, error);
    return false;
  }
};
