'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

export interface BookingFormData {
  providerId: string;
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration: number;
  bookingDate: Date | null;
  startTime: string;
  endTime: string;
  customerNotes?: string;
  
  // Provider info
  providerName: string;
  providerBusinessName?: string;
  
  // Metadata
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface BookingState {
  // Current booking flow state
  currentStep: 'service-selection' | 'date-time' | 'customer-info' | 'payment' | 'confirmation';
  bookingData: Partial<BookingFormData>;
  
  // Available time slots
  availableTimeSlots: string[];
  selectedTimeSlot: string | null;
  
  // Payment state
  clientSecret: string | null;
  paymentIntentId: string | null;
  isProcessingPayment: boolean;
  paymentError: string | null;
  
  // Confirmation state
  confirmationCode: string | null;
  bookingId: string | null;
  
  // UI state
  isLoading: boolean;
  errors: Record<string, string>;
  
  // Actions
  setCurrentStep: (step: BookingState['currentStep']) => void;
  updateBookingData: (data: Partial<BookingFormData>) => void;
  setAvailableTimeSlots: (slots: string[]) => void;
  setSelectedTimeSlot: (slot: string | null) => void;
  setPaymentDetails: (details: { clientSecret: string; paymentIntentId: string }) => void;
  setPaymentProcessing: (processing: boolean) => void;
  setPaymentError: (error: string | null) => void;
  setConfirmation: (details: { confirmationCode: string; bookingId: string }) => void;
  setLoading: (loading: boolean) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearErrors: () => void;
  resetBookingFlow: () => void;
  
  // Async actions
  fetchAvailableSlots: (providerId: string, serviceId: string, date: Date) => Promise<void>;
  initiateCheckout: (isGuest: boolean) => Promise<boolean>;
  
  // Computed getters
  isStepValid: (step: BookingState['currentStep']) => boolean;
  getBookingSummary: () => {
    serviceName: string;
    providerName: string;
    date: string;
    time: string;
    duration: number;
    price: string;
  } | null;
}

export const useBookingStore = create<BookingState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      currentStep: 'service-selection',
      bookingData: {},
      availableTimeSlots: [],
      selectedTimeSlot: null,
      clientSecret: null,
      paymentIntentId: null,
      isProcessingPayment: false,
      paymentError: null,
      confirmationCode: null,
      bookingId: null,
      isLoading: false,
      errors: {},
      
      // Actions
      setCurrentStep: (step) =>
        set((state) => {
          state.currentStep = step;
        }),
        
      updateBookingData: (data) =>
        set((state) => {
          Object.assign(state.bookingData, data);
        }),
        
      setAvailableTimeSlots: (slots) =>
        set((state) => {
          state.availableTimeSlots = slots;
        }),
        
      setSelectedTimeSlot: (slot) =>
        set((state) => {
          state.selectedTimeSlot = slot;
          if (slot) {
            const [startTime] = slot.split(' - ');
            state.bookingData.startTime = startTime;
            
            // Calculate end time based on duration
            if (state.bookingData.serviceDuration) {
              const [hours, minutes] = startTime.split(':').map(Number);
              const startMinutes = hours * 60 + minutes;
              const endMinutes = startMinutes + state.bookingData.serviceDuration;
              const endHours = Math.floor(endMinutes / 60);
              const endMins = endMinutes % 60;
              state.bookingData.endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
            }
          }
        }),
        
      setPaymentDetails: (details) =>
        set((state) => {
          state.clientSecret = details.clientSecret;
          state.paymentIntentId = details.paymentIntentId;
        }),
        
      setPaymentProcessing: (processing) =>
        set((state) => {
          state.isProcessingPayment = processing;
        }),
        
      setPaymentError: (error) =>
        set((state) => {
          state.paymentError = error;
        }),
        
      setConfirmation: (details) =>
        set((state) => {
          state.confirmationCode = details.confirmationCode;
          state.bookingId = details.bookingId;
        }),
        
      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),
        
      setError: (field, error) =>
        set((state) => {
          state.errors[field] = error;
        }),
        
      clearError: (field) =>
        set((state) => {
          delete state.errors[field];
        }),
        
      clearErrors: () =>
        set((state) => {
          state.errors = {};
        }),
        
      resetBookingFlow: () =>
        set((state) => {
          state.currentStep = 'service-selection';
          state.bookingData = {};
          state.availableTimeSlots = [];
          state.selectedTimeSlot = null;
          state.clientSecret = null;
          state.paymentIntentId = null;
          state.isProcessingPayment = false;
          state.paymentError = null;
          state.confirmationCode = null;
          state.bookingId = null;
          state.isLoading = false;
          state.errors = {};
        }),
        
      // Async actions
      fetchAvailableSlots: async (providerId, serviceId, date) => {
        const { setLoading, setAvailableTimeSlots, setError } = get();
        
        try {
          setLoading(true);
          
          const response = await fetch(`/api/providers/${providerId}/services/${serviceId}/availability?date=${date.toISOString()}`);
          
          if (response.ok) {
            const data = await response.json();
            setAvailableTimeSlots(data.availableSlots || []);
          } else {
            setError('availability', 'Failed to fetch available time slots');
          }
        } catch (error) {
          console.error('Error fetching available slots:', error);
          setError('availability', 'Failed to fetch available time slots');
        } finally {
          setLoading(false);
        }
      },
      
      initiateCheckout: async (isGuest) => {
        const { bookingData, setPaymentDetails, setPaymentError, setLoading } = get();
        
        try {
          setLoading(true);
          setPaymentError(null);
          
          const endpoint = isGuest ? '/api/checkout/guest' : '/api/checkout/customer';
          
          const checkoutData = isGuest ? {
            guestEmail: bookingData.guestEmail,
            guestName: `${bookingData.guestFirstName} ${bookingData.guestLastName}`,
            guestPhone: bookingData.guestPhone,
            providerId: bookingData.providerId,
            serviceId: bookingData.serviceId,
            bookingDate: bookingData.bookingDate?.toISOString(),
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            customerNotes: bookingData.customerNotes,
            referrer: bookingData.referrer,
            utmSource: bookingData.utmSource,
            utmMedium: bookingData.utmMedium,
            utmCampaign: bookingData.utmCampaign,
          } : {
            providerId: bookingData.providerId,
            serviceId: bookingData.serviceId,
            bookingDate: bookingData.bookingDate?.toISOString(),
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            customerNotes: bookingData.customerNotes,
            referrer: bookingData.referrer,
            utmSource: bookingData.utmSource,
            utmMedium: bookingData.utmMedium,
            utmCampaign: bookingData.utmCampaign,
          };
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutData),
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            setPaymentDetails({
              clientSecret: data.clientSecret,
              paymentIntentId: data.paymentIntentId,
            });
            
            if (data.confirmationCode && data.bookingId) {
              get().setConfirmation({
                confirmationCode: data.confirmationCode,
                bookingId: data.bookingId,
              });
            }
            
            return true;
          } else {
            setPaymentError(data.error || 'Failed to initiate checkout');
            return false;
          }
        } catch (error) {
          console.error('Error initiating checkout:', error);
          setPaymentError('Failed to initiate checkout');
          return false;
        } finally {
          setLoading(false);
        }
      },
      
      // Computed getters
      isStepValid: (step) => {
        const { bookingData } = get();
        
        switch (step) {
          case 'service-selection':
            return !!(bookingData.providerId && bookingData.serviceId);
            
          case 'date-time':
            return !!(bookingData.bookingDate && bookingData.startTime && bookingData.endTime);
            
          case 'customer-info':
            // For guest checkout
            return !!(
              bookingData.guestEmail && 
              bookingData.guestFirstName && 
              bookingData.guestLastName
            ) || true; // Allow authenticated users to skip this
            
          case 'payment':
            return !!get().clientSecret;
            
          case 'confirmation':
            return !!(get().confirmationCode && get().bookingId);
            
          default:
            return false;
        }
      },
      
      getBookingSummary: () => {
        const { bookingData } = get();
        
        if (!bookingData.serviceName || !bookingData.bookingDate || !bookingData.startTime) {
          return null;
        }
        
        return {
          serviceName: bookingData.serviceName,
          providerName: bookingData.providerBusinessName || bookingData.providerName,
          date: bookingData.bookingDate.toLocaleDateString(),
          time: `${bookingData.startTime} - ${bookingData.endTime}`,
          duration: bookingData.serviceDuration || 0,
          price: bookingData.servicePrice || '0',
        };
      },
    })),
    {
      name: 'booking-store',
    }
  )
);

// Convenience hooks
export const useBookingFlow = () => 
  useBookingStore((state) => ({
    currentStep: state.currentStep,
    bookingData: state.bookingData,
    isLoading: state.isLoading,
    errors: state.errors,
  }));

export const useBookingActions = () => 
  useBookingStore((state) => ({
    setCurrentStep: state.setCurrentStep,
    updateBookingData: state.updateBookingData,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    resetBookingFlow: state.resetBookingFlow,
    fetchAvailableSlots: state.fetchAvailableSlots,
    initiateCheckout: state.initiateCheckout,
  }));

export const useBookingPayment = () => 
  useBookingStore((state) => ({
    clientSecret: state.clientSecret,
    paymentIntentId: state.paymentIntentId,
    isProcessingPayment: state.isProcessingPayment,
    paymentError: state.paymentError,
    confirmationCode: state.confirmationCode,
    bookingId: state.bookingId,
  }));