/**
 * Customer Booking & Payment Flow Component
 * 
 * This component handles the complete booking and payment process:
 * 1. Service selection
 * 2. Date/time selection
 * 3. Payment processing via Direct Charge
 * 4. Booking confirmation
 * 
 * Supports both authenticated users and guest checkout
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  CreditCard,
  User,
  MapPin,
  DollarSign,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  stripePriceId: string;
}

interface Provider {
  id: string;
  displayName: string;
  profileImageUrl?: string;
  locationCity?: string;
  locationState?: string;
  stripeConnectAccountId: string;
  services: Service[];
}

interface BookingPaymentFlowProps {
  provider: Provider;
  selectedService?: Service;
  selectedDate?: Date;
  selectedTime?: string;
  onComplete?: (bookingId: string) => void;
  onCancel?: () => void;
}

export function BookingPaymentFlow({
  provider,
  selectedService: initialService,
  selectedDate: initialDate,
  selectedTime: initialTime,
  onComplete,
  onCancel,
}: BookingPaymentFlowProps) {
  const { isSignedIn, userId } = useAuth();
  const [step, setStep] = useState<'service' | 'datetime' | 'payment' | 'complete'>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(initialService || null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate || null);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime || '');
  const [guestEmail, setGuestEmail] = useState('');
  const [bookingId, setBookingId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fees, setFees] = useState<any>(null);

  const isGuest = !isSignedIn;

  // Calculate total with fees
  const calculateTotal = () => {
    if (!selectedService) return { base: 0, total: 0, platformFee: 0, guestFee: 0 };
    
    const base = selectedService.price;
    const platformFee = base * 0.10; // 10% platform fee
    const guestFee = isGuest ? base * 0.10 : 0; // 10% guest surcharge
    const total = base + guestFee; // Customer pays base + guest fee (if applicable)
    
    return {
      base,
      total,
      platformFee,
      guestFee,
      providerReceives: base - platformFee,
    };
  };

  // Create booking and payment intent
  const createBookingAndPayment = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error('Please complete all booking details');
      return;
    }

    setIsProcessing(true);

    try {
      // First create the booking
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          servicePrice: selectedService.price,
          scheduledDate: selectedDate.toISOString(),
          scheduledTime: selectedTime,
          duration: selectedService.duration,
          customerEmail: guestEmail || undefined,
          isGuest,
        }),
      });

      if (!bookingResponse.ok) {
        throw new Error('Failed to create booking');
      }

      const bookingData = await bookingResponse.json();
      setBookingId(bookingData.bookingId);

      // Then create payment intent
      const paymentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingData.bookingId,
          connectedAccountId: provider.stripeConnectAccountId,
          amountCents: Math.round(selectedService.price * 100),
          currency: 'usd',
          isGuest,
          customerEmail: guestEmail || undefined,
          metadata: {
            serviceName: selectedService.name,
            providerName: provider.displayName,
            scheduledDate: selectedDate.toISOString(),
            scheduledTime: selectedTime,
          },
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment');
      }

      const paymentData = await paymentResponse.json();
      setClientSecret(paymentData.clientSecret);
      setFees(paymentData.fees);
      setStep('payment');
      
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render service selection step
  const renderServiceStep = () => (
    <div className="space-y-4">
      <div className="grid gap-3">
        {provider.services.filter(s => s.active !== false).map((service) => (
          <Card
            key={service.id}
            className={`cursor-pointer transition-all ${
              selectedService?.id === service.id
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:shadow-md'
            }`}
            onClick={() => setSelectedService(service)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium">{service.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {service.duration} min
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">${service.price}</div>
                  {isGuest && (
                    <div className="text-xs text-orange-600">+10% guest fee</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => setStep('datetime')}
          disabled={!selectedService}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  // Render date/time selection step
  const renderDateTimeStep = () => (
    <div className="space-y-4">
      <div className="space-y-4">
        <div>
          <Label htmlFor="date">Select Date</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="time">Select Time</Label>
          <Input
            id="time"
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="mt-1"
          />
        </div>
        
        {isGuest && (
          <div>
            <Label htmlFor="email">Email Address (for booking confirmation)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1"
              required
            />
          </div>
        )}
      </div>
      
      {/* Booking Summary */}
      <Card className="bg-gray-50">
        <CardContent className="p-4 space-y-2">
          <h4 className="font-medium">Booking Summary</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Service:</span>
              <span className="font-medium">{selectedService?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span className="font-medium">
                {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span className="font-medium">{selectedTime || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="font-medium">{selectedService?.duration} minutes</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>Service Price:</span>
              <span>${selectedService?.price.toFixed(2)}</span>
            </div>
            {isGuest && (
              <div className="flex justify-between text-orange-600">
                <span>Guest Fee (10%):</span>
                <span>+${calculateTotal().guestFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${calculateTotal().total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep('service')}>
          Back
        </Button>
        <Button 
          onClick={createBookingAndPayment}
          disabled={!selectedDate || !selectedTime || (isGuest && !guestEmail) || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Booking...
            </>
          ) : (
            'Continue to Payment'
          )}
        </Button>
      </div>
    </div>
  );

  // Render payment step
  const renderPaymentStep = () => (
    <div className="space-y-4">
      {clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#3b82f6',
              },
            },
          }}
        >
          <PaymentForm
            bookingId={bookingId}
            provider={provider}
            service={selectedService!}
            fees={fees}
            onSuccess={() => {
              setStep('complete');
              onComplete?.(bookingId);
            }}
            onError={(error) => {
              toast.error(error);
            }}
          />
        </Elements>
      ) : (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
        </div>
      )}
    </div>
  );

  // Render completion step
  const renderCompleteStep = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      <h3 className="text-xl font-semibold">Booking Confirmed!</h3>
      <p className="text-gray-600">
        Your booking with {provider.displayName} has been confirmed.
      </p>
      <Card className="text-left max-w-md mx-auto">
        <CardContent className="p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Booking ID:</span>
            <span className="font-mono text-xs">{bookingId.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Service:</span>
            <span>{selectedService?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date & Time:</span>
            <span>
              {selectedDate && format(selectedDate, 'MMM dd, yyyy')} at {selectedTime}
            </span>
          </div>
        </CardContent>
      </Card>
      {isGuest && guestEmail && (
        <p className="text-sm text-gray-600">
          A confirmation email has been sent to {guestEmail}
        </p>
      )}
      <Button onClick={() => window.location.href = '/bookings'}>
        View My Bookings
      </Button>
    </div>
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Book with {provider.displayName}</CardTitle>
            <CardDescription>
              {provider.locationCity && provider.locationState && (
                <span className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {provider.locationCity}, {provider.locationState}
                </span>
              )}
            </CardDescription>
          </div>
          {isGuest && (
            <Badge variant="outline" className="text-orange-600">
              Guest Checkout
            </Badge>
          )}
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-6">
          {['service', 'datetime', 'payment', 'complete'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step === s ? 'bg-blue-500 text-white' : 
                  ['service', 'datetime', 'payment', 'complete'].indexOf(step) > idx 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-600'}
              `}>
                {['service', 'datetime', 'payment', 'complete'].indexOf(step) > idx ? 
                  <CheckCircle className="w-5 h-5" /> : idx + 1}
              </div>
              {idx < 3 && (
                <div className={`
                  w-full h-1 mx-2
                  ${['service', 'datetime', 'payment', 'complete'].indexOf(step) > idx 
                    ? 'bg-green-500' : 'bg-gray-200'}
                `} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {step === 'service' && renderServiceStep()}
        {step === 'datetime' && renderDateTimeStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'complete' && renderCompleteStep()}
      </CardContent>
    </Card>
  );
}

// Payment form component
function PaymentForm({
  bookingId,
  provider,
  service,
  fees,
  onSuccess,
  onError,
}: {
  bookingId: string;
  provider: Provider;
  service: Service;
  fees: any;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/bookings/${bookingId}/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      onError('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      {fees && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <div>Service: ${(fees.customerTotal / 100).toFixed(2)}</div>
            <div>Platform fee: ${(fees.platformFee / 100).toFixed(2)}</div>
            {fees.guestSurcharge > 0 && (
              <div>Guest surcharge: ${(fees.guestSurcharge / 100).toFixed(2)}</div>
            )}
            <div className="font-medium mt-1">
              Provider receives: ${(fees.providerReceives / 100).toFixed(2)}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${(fees?.customerTotal / 100 || service.price).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}