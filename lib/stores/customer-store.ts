'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';

export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'customer' | 'provider';
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingSummary {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  totalSpent: number;
  averageBookingValue: number;
}

export interface PaymentSummary {
  totalTransactions: number;
  totalPaid: number;
  totalRefunded: number;
  platformFeesPaid: number;
  netSpent: number;
}

export interface CustomerState {
  // Authentication state
  isAuthenticated: boolean;
  profile: CustomerProfile | null;
  
  // Booking data
  bookings: any[];
  bookingSummary: BookingSummary | null;
  
  // Payment data
  paymentHistory: any[];
  paymentSummary: PaymentSummary | null;
  
  // UI state
  isLoadingBookings: boolean;
  isLoadingPayments: boolean;
  selectedBooking: any | null;
  
  // Actions
  setProfile: (profile: CustomerProfile) => void;
  updateProfile: (updates: Partial<CustomerProfile>) => void;
  setBookings: (bookings: any[]) => void;
  updateBooking: (bookingId: string, updates: any) => void;
  setBookingSummary: (summary: BookingSummary) => void;
  setPaymentHistory: (payments: any[]) => void;
  setPaymentSummary: (summary: PaymentSummary) => void;
  setSelectedBooking: (booking: any | null) => void;
  setLoadingBookings: (loading: boolean) => void;
  setLoadingPayments: (loading: boolean) => void;
  clearCustomerData: () => void;
  
  // Async actions
  fetchBookings: () => Promise<void>;
  fetchPaymentHistory: () => Promise<void>;
  cancelBooking: (bookingId: string, reason: string) => Promise<boolean>;
  
  // Computed getters
  getUpcomingBookings: () => any[];
  getPastBookings: () => any[];
  getRecentPayments: (limit?: number) => any[];
}

export const useCustomerStore = create<CustomerState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        isAuthenticated: false,
        profile: null,
        bookings: [],
        bookingSummary: null,
        paymentHistory: [],
        paymentSummary: null,
        isLoadingBookings: false,
        isLoadingPayments: false,
        selectedBooking: null,
        
        // Actions
        setProfile: (profile) =>
          set((state) => {
            state.profile = profile;
            state.isAuthenticated = true;
          }),
          
        updateProfile: (updates) =>
          set((state) => {
            if (state.profile) {
              Object.assign(state.profile, updates);
              state.profile.updatedAt = new Date();
            }
          }),
          
        setBookings: (bookings) =>
          set((state) => {
            state.bookings = bookings;
          }),
          
        updateBooking: (bookingId, updates) =>
          set((state) => {
            const index = state.bookings.findIndex(b => b.id === bookingId);
            if (index !== -1) {
              Object.assign(state.bookings[index], updates);
            }
          }),
          
        setBookingSummary: (summary) =>
          set((state) => {
            state.bookingSummary = summary;
          }),
          
        setPaymentHistory: (payments) =>
          set((state) => {
            state.paymentHistory = payments;
          }),
          
        setPaymentSummary: (summary) =>
          set((state) => {
            state.paymentSummary = summary;
          }),
          
        setSelectedBooking: (booking) =>
          set((state) => {
            state.selectedBooking = booking;
          }),
          
        setLoadingBookings: (loading) =>
          set((state) => {
            state.isLoadingBookings = loading;
          }),
          
        setLoadingPayments: (loading) =>
          set((state) => {
            state.isLoadingPayments = loading;
          }),
          
        clearCustomerData: () =>
          set((state) => {
            state.isAuthenticated = false;
            state.profile = null;
            state.bookings = [];
            state.bookingSummary = null;
            state.paymentHistory = [];
            state.paymentSummary = null;
            state.selectedBooking = null;
            state.isLoadingBookings = false;
            state.isLoadingPayments = false;
          }),
          
        // Async actions
        fetchBookings: async () => {
          const { profile, setLoadingBookings, setBookings, setBookingSummary } = get();
          if (!profile) return;
          
          try {
            setLoadingBookings(true);
            
            const response = await fetch(`/api/bookings/customer/${profile.id}`);
            if (response.ok) {
              const data = await response.json();
              setBookings(data.bookings || []);
              
              // Calculate summary
              const bookings = data.bookings || [];
              const totalBookings = bookings.length;
              const upcomingBookings = bookings.filter((b: any) => 
                new Date(b.bookingDate) >= new Date() && 
                ['pending', 'confirmed'].includes(b.status)
              ).length;
              const completedBookings = bookings.filter((b: any) => b.status === 'completed').length;
              const totalSpent = bookings
                .filter((b: any) => ['completed', 'confirmed'].includes(b.status))
                .reduce((sum: number, b: any) => sum + parseFloat(b.totalAmount), 0);
              
              setBookingSummary({
                totalBookings,
                upcomingBookings,
                completedBookings,
                totalSpent,
                averageBookingValue: totalBookings > 0 ? totalSpent / totalBookings : 0,
              });
            }
          } catch (error) {
            console.error('Failed to fetch bookings:', error);
          } finally {
            setLoadingBookings(false);
          }
        },
        
        fetchPaymentHistory: async () => {
          const { setLoadingPayments, setPaymentHistory, setPaymentSummary } = get();
          
          try {
            setLoadingPayments(true);
            
            const response = await fetch('/api/customer/payment-history');
            if (response.ok) {
              const data = await response.json();
              setPaymentHistory(data.payments || []);
              
              if (data.summary) {
                setPaymentSummary({
                  totalTransactions: data.summary.totalTransactions,
                  totalPaid: parseFloat(data.summary.totalPaid),
                  totalRefunded: parseFloat(data.summary.totalRefunded),
                  platformFeesPaid: parseFloat(data.summary.platformFeesPaid),
                  netSpent: parseFloat(data.summary.netSpent),
                });
              }
            }
          } catch (error) {
            console.error('Failed to fetch payment history:', error);
          } finally {
            setLoadingPayments(false);
          }
        },
        
        cancelBooking: async (bookingId, reason) => {
          try {
            const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reason,
                urgency: 'planned',
                requestRefund: true,
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              
              // Update the booking in the store
              get().updateBooking(bookingId, {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason,
              });
              
              return true;
            }
            
            return false;
          } catch (error) {
            console.error('Failed to cancel booking:', error);
            return false;
          }
        },
        
        // Computed getters
        getUpcomingBookings: () => {
          const { bookings } = get();
          const now = new Date();
          return bookings.filter(booking => 
            new Date(booking.bookingDate) >= now && 
            ['pending', 'confirmed'].includes(booking.status)
          );
        },
        
        getPastBookings: () => {
          const { bookings } = get();
          const now = new Date();
          return bookings.filter(booking => 
            new Date(booking.bookingDate) < now || 
            booking.status === 'completed'
          );
        },
        
        getRecentPayments: (limit = 5) => {
          const { paymentHistory } = get();
          return paymentHistory
            .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
            .slice(0, limit);
        },
      })),
      {
        name: 'customer-storage',
        partialize: (state) => ({
          // Only persist essential customer state
          isAuthenticated: state.isAuthenticated,
          profile: state.profile,
          bookingSummary: state.bookingSummary,
          paymentSummary: state.paymentSummary,
        }),
      }
    ),
    {
      name: 'customer-store',
    }
  )
);

// Convenience hooks
export const useCustomerProfile = () => 
  useCustomerStore((state) => state.profile);

export const useCustomerBookings = () => 
  useCustomerStore((state) => ({
    bookings: state.bookings,
    summary: state.bookingSummary,
    isLoading: state.isLoadingBookings,
  }));

export const useCustomerPayments = () => 
  useCustomerStore((state) => ({
    payments: state.paymentHistory,
    summary: state.paymentSummary,
    isLoading: state.isLoadingPayments,
  }));

export const useCustomerActions = () => 
  useCustomerStore((state) => ({
    setProfile: state.setProfile,
    updateProfile: state.updateProfile,
    fetchBookings: state.fetchBookings,
    fetchPaymentHistory: state.fetchPaymentHistory,
    cancelBooking: state.cancelBooking,
    clearCustomerData: state.clearCustomerData,
  }));