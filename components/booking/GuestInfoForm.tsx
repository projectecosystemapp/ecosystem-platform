"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  AlertCircle,
  LogIn,
  UserPlus
} from "lucide-react";
import { useGuestCheckout } from "@/contexts/guest-checkout-context";
import { useAuth, useSignIn } from "@clerk/nextjs";
import Link from "next/link";

interface GuestInfoFormProps {
  onSubmit: () => void;
  onSignIn?: () => void;
}

export function GuestInfoForm({ onSubmit, onSignIn }: GuestInfoFormProps) {
  const { setGuestInfo, setIsGuestCheckout } = useGuestCheckout();
  const { isSignedIn } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showGuestForm, setShowGuestForm] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.phone) {
      newErrors.phone = "Phone number is required";
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      newErrors.phone = "Phone number must be at least 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setGuestInfo(formData);
      setIsGuestCheckout(true);
      onSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  // If user is already signed in, skip guest form
  if (isSignedIn) {
    return null;
  }

  // Show choice between sign in or guest checkout
  if (!showGuestForm) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">How would you like to continue?</h3>
          
          {/* Sign In Option */}
          <div className="space-y-4">
            <Card className="p-4 border-blue-200 bg-blue-50/50">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <LogIn className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Sign In or Create Account</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    No guest surcharge - save 10% on your booking
                  </p>
                  <div className="mt-3 space-y-2">
                    <Link href="/sign-in">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        Sign In / Sign Up
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            {/* Guest Checkout Option */}
            <Card className="p-4 border-gray-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <UserPlus className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Continue as Guest</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Quick checkout with 10% guest surcharge
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full mt-3"
                    onClick={() => setShowGuestForm(true)}
                  >
                    Continue as Guest
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Fee Comparison */}
          <Alert className="mt-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong>Save 10% on your booking!</strong> Sign in to avoid the guest checkout surcharge.
            </AlertDescription>
          </Alert>
        </Card>
      </div>
    );
  }

  // Show guest information form
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Guest Information</h3>
        <p className="text-sm text-gray-600 mt-1">
          Please provide your contact details for the booking
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              First Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="John"
                value={formData.firstName}
                onChange={handleInputChange}
                className={`pl-10 ${errors.firstName ? "border-red-500" : ""}`}
              />
            </div>
            {errors.firstName && (
              <p className="text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleInputChange}
                className={`pl-10 ${errors.lastName ? "border-red-500" : ""}`}
              />
            </div>
            {errors.lastName && (
              <p className="text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email Address <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChange={handleInputChange}
              className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={handleInputChange}
              className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
            />
          </div>
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Guest Checkout Notice */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong>Guest Checkout:</strong> 10% surcharge applies to your total. 
            <Link href="/sign-in" className="underline ml-1 text-blue-600">
              Sign in to save 10%
            </Link>
          </AlertDescription>
        </Alert>

        {/* Trust Signals */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span>Your information is secure and will only be shared with the provider</span>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowGuestForm(false)}
            className="flex-1"
          >
            Back
          </Button>
          <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
            Continue to Payment
          </Button>
        </div>
      </form>
    </Card>
  );
}