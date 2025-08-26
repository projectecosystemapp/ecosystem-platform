'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';

export interface GuestInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface GuestCheckoutState {
  // State
  isGuestCheckout: boolean;
  guestInfo: GuestInfo | null;
  
  // Actions
  setIsGuestCheckout: (value: boolean) => void;
  setGuestInfo: (info: GuestInfo) => void;
  updateGuestInfo: (updates: Partial<GuestInfo>) => void;
  clearGuestSession: () => void;
  
  // Computed getters
  hasCompleteGuestInfo: () => boolean;
  getDisplayName: () => string | null;
}

export const useGuestCheckoutStore = create<GuestCheckoutState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        isGuestCheckout: false,
        guestInfo: null,
        
        // Actions
        setIsGuestCheckout: (value) =>
          set((state) => {
            state.isGuestCheckout = value;
            if (!value) {
              // Clear guest info when disabling guest checkout
              state.guestInfo = null;
            }
          }),
          
        setGuestInfo: (info) =>
          set((state) => {
            state.guestInfo = info;
            state.isGuestCheckout = true;
          }),
          
        updateGuestInfo: (updates) =>
          set((state) => {
            if (state.guestInfo) {
              Object.assign(state.guestInfo, updates);
            } else {
              // Create new guest info with defaults if none exists
              state.guestInfo = {
                email: '',
                firstName: '',
                lastName: '',
                phone: '',
                ...updates,
              };
            }
          }),
          
        clearGuestSession: () =>
          set((state) => {
            state.isGuestCheckout = false;
            state.guestInfo = null;
          }),
          
        // Computed getters
        hasCompleteGuestInfo: () => {
          const { guestInfo } = get();
          return Boolean(
            guestInfo &&
            guestInfo.email &&
            guestInfo.firstName &&
            guestInfo.lastName
          );
        },
        
        getDisplayName: () => {
          const { guestInfo } = get();
          if (!guestInfo) return null;
          
          return `${guestInfo.firstName} ${guestInfo.lastName}`.trim() || guestInfo.email;
        },
      })),
      {
        name: 'guest-checkout-storage',
        partialize: (state) => ({
          // Only persist essential guest checkout state
          isGuestCheckout: state.isGuestCheckout,
          guestInfo: state.guestInfo,
        }),
      }
    ),
    {
      name: 'guest-checkout-store',
    }
  )
);

// Convenience hook for guest checkout status
export const useIsGuestCheckout = () => 
  useGuestCheckoutStore((state) => state.isGuestCheckout);

// Convenience hook for guest info
export const useGuestInfo = () => 
  useGuestCheckoutStore((state) => state.guestInfo);

// Convenience hook for guest checkout actions
export const useGuestCheckoutActions = () => 
  useGuestCheckoutStore((state) => ({
    setIsGuestCheckout: state.setIsGuestCheckout,
    setGuestInfo: state.setGuestInfo,
    updateGuestInfo: state.updateGuestInfo,
    clearGuestSession: state.clearGuestSession,
  }));