"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { ensureUserProfileAction } from "@/actions/auth-actions";

export function ProfileInitializer() {
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      // Ensure user profile exists (non-blocking)
      ensureUserProfileAction().catch(error => {
        console.error("Failed to initialize profile:", error);
      });
    }
  }, [isSignedIn, userId]);

  return null;
}