"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface GuestInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface GuestCheckoutContextType {
  isGuestCheckout: boolean;
  guestInfo: GuestInfo | null;
  setIsGuestCheckout: (value: boolean) => void;
  setGuestInfo: (info: GuestInfo) => void;
  clearGuestSession: () => void;
}

const GuestCheckoutContext = createContext<GuestCheckoutContextType | undefined>(undefined);

export function GuestCheckoutProvider({ children }: { children: ReactNode }) {
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);

  const clearGuestSession = () => {
    setIsGuestCheckout(false);
    setGuestInfo(null);
  };

  return (
    <GuestCheckoutContext.Provider
      value={{
        isGuestCheckout,
        guestInfo,
        setIsGuestCheckout,
        setGuestInfo,
        clearGuestSession,
      }}
    >
      {children}
    </GuestCheckoutContext.Provider>
  );
}

export function useGuestCheckout() {
  const context = useContext(GuestCheckoutContext);
  if (context === undefined) {
    throw new Error("useGuestCheckout must be used within a GuestCheckoutProvider");
  }
  return context;
}