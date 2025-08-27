"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Truck, 
  MapPin, 
  DollarSign, 
  Tag,
  Info,
  ShoppingCart,
  MessageSquare,
  User,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ThingPurchaseFormProps {
  thing: {
    id: string;
    name: string;
    description?: string;
    price: number;
    condition?: string;
    sellerName?: string;
    shippingAvailable?: boolean;
    localPickup?: boolean;
    acceptsOffers?: boolean;
    minOfferAmount?: number;
  };
  formData: any;
  onUpdate: (data: any) => void;
}

interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

const conditionBadgeVariant = (condition?: string) => {
  switch (condition?.toLowerCase()) {
    case "new":
      return "default";
    case "like_new":
    case "excellent":
      return "secondary";
    case "good":
      return "outline";
    default:
      return "destructive";
  }
};

export function ThingPurchaseForm({ thing, formData, onUpdate }: ThingPurchaseFormProps) {
  const [purchaseType, setPurchaseType] = useState<"buy_now" | "make_offer">(
    formData.purchaseType || "buy_now"
  );
  const [offerAmount, setOfferAmount] = useState<number>(
    formData.offerAmount || thing.minOfferAmount || Math.floor(thing.price * 0.8)
  );
  const [deliveryMethod, setDeliveryMethod] = useState<"shipping" | "pickup">(
    formData.deliveryMethod || (thing.shippingAvailable ? "shipping" : "pickup")
  );
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(
    formData.shippingAddress || {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    }
  );
  const [message, setMessage] = useState(formData.message || "");
  const [pickupNotes, setPickupNotes] = useState(formData.pickupNotes || "");

  // Update form data when changes occur
  useEffect(() => {
    const finalAmount = purchaseType === "buy_now" ? thing.price : offerAmount;
    
    onUpdate({
      ...formData,
      purchaseType,
      offerAmount: purchaseType === "make_offer" ? offerAmount : undefined,
      deliveryMethod,
      shippingAddress: deliveryMethod === "shipping" ? shippingAddress : undefined,
      message: purchaseType === "make_offer" ? message : undefined,
      pickupNotes: deliveryMethod === "pickup" ? pickupNotes : undefined,
      baseAmount: finalAmount,
      notes: message || pickupNotes || formData.notes,
    });
  }, [purchaseType, offerAmount, deliveryMethod, shippingAddress, message, pickupNotes, thing.price]);

  const handleAddressChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress({
      ...shippingAddress,
      [field]: value,
    });
  };

  const isAddressComplete = () => {
    if (deliveryMethod !== "shipping") return true;
    return !!(
      shippingAddress.street &&
      shippingAddress.city &&
      shippingAddress.state &&
      shippingAddress.zipCode
    );
  };

  const getOfferPercentage = () => {
    return Math.round((offerAmount / thing.price) * 100);
  };

  const getFinalPrice = () => {
    return purchaseType === "buy_now" ? thing.price : offerAmount;
  };

  return (
    <div className="space-y-6">
      {/* Item Details Card */}
      <Card className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{thing.name}</h3>
              {thing.description && (
                <p className="text-sm text-gray-600 mt-1">{thing.description}</p>
              )}
            </div>
            <div className="text-right ml-4">
              <p className="text-2xl font-bold text-amber-600">
                ${thing.price.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Listed price</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {thing.condition && (
              <Badge variant={conditionBadgeVariant(thing.condition)}>
                {thing.condition}
              </Badge>
            )}
            
            {thing.sellerName && (
              <Badge variant="secondary" className="gap-1.5">
                <User className="h-3 w-3" />
                {thing.sellerName}
              </Badge>
            )}

            {thing.shippingAvailable && (
              <Badge variant="outline" className="gap-1.5">
                <Truck className="h-3 w-3" />
                Shipping available
              </Badge>
            )}

            {thing.localPickup && (
              <Badge variant="outline" className="gap-1.5">
                <MapPin className="h-3 w-3" />
                Local pickup
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Purchase Type Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Purchase Option</Label>
        
        <RadioGroup 
          value={purchaseType} 
          onValueChange={(value) => setPurchaseType(value as typeof purchaseType)}
        >
          <div className="space-y-3">
            <label
              htmlFor="buy_now"
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                purchaseType === "buy_now" 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="buy_now" id="buy_now" />
                <div>
                  <p className="font-medium">Buy Now</p>
                  <p className="text-sm text-gray-600">Purchase at listed price</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">${thing.price.toFixed(2)}</p>
              </div>
            </label>

            {thing.acceptsOffers && (
              <label
                htmlFor="make_offer"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  purchaseType === "make_offer" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="make_offer" id="make_offer" />
                  <div>
                    <p className="font-medium">Make an Offer</p>
                    <p className="text-sm text-gray-600">Negotiate the price</p>
                  </div>
                </div>
                <Tag className="h-5 w-5 text-gray-400" />
              </label>
            )}
          </div>
        </RadioGroup>

        {/* Offer Amount Input */}
        {purchaseType === "make_offer" && (
          <div className="mt-4 space-y-4">
            <Separator />
            
            <div>
              <Label htmlFor="offer" className="text-sm mb-2 block">Your Offer Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="offer"
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(parseFloat(e.target.value) || 0)}
                  min={thing.minOfferAmount || 1}
                  max={thing.price}
                  step={0.01}
                  className="pl-10"
                />
              </div>
              
              {/* Offer feedback */}
              <div className="mt-2">
                {offerAmount < (thing.minOfferAmount || thing.price * 0.5) && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Offer is too low. Minimum offer: ${(thing.minOfferAmount || thing.price * 0.5).toFixed(2)}
                    </AlertDescription>
                  </Alert>
                )}
                
                {offerAmount >= (thing.minOfferAmount || thing.price * 0.5) && offerAmount < thing.price && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700">
                      Your offer is {getOfferPercentage()}% of the listing price
                    </span>
                    <Badge variant="secondary">
                      Save ${(thing.price - offerAmount).toFixed(2)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="message" className="text-sm mb-2 block">
                Message to Seller <span className="text-gray-500">(Optional)</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Explain your offer or ask questions about the item..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Delivery Method Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Delivery Method</Label>
        
        <RadioGroup 
          value={deliveryMethod} 
          onValueChange={(value) => setDeliveryMethod(value as typeof deliveryMethod)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {thing.shippingAvailable && (
              <label
                htmlFor="shipping"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  deliveryMethod === "shipping" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="shipping" id="shipping" />
                  <div>
                    <p className="font-medium">Shipping</p>
                    <p className="text-sm text-gray-600">Delivered to your address</p>
                  </div>
                </div>
                <Truck className="h-5 w-5 text-gray-400" />
              </label>
            )}

            {thing.localPickup && (
              <label
                htmlFor="pickup"
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                  deliveryMethod === "pickup" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <div>
                    <p className="font-medium">Local Pickup</p>
                    <p className="text-sm text-gray-600">Pick up in person</p>
                  </div>
                </div>
                <MapPin className="h-5 w-5 text-gray-400" />
              </label>
            )}
          </div>
        </RadioGroup>

        {/* Shipping Address Form */}
        {deliveryMethod === "shipping" && (
          <div className="mt-4 space-y-4">
            <Separator />
            <div>
              <Label className="text-sm font-medium mb-3 block">Shipping Address</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="street" className="text-sm mb-1 block">Street Address</Label>
                  <Input
                    id="street"
                    placeholder="123 Main St"
                    value={shippingAddress.street}
                    onChange={(e) => handleAddressChange("street", e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city" className="text-sm mb-1 block">City</Label>
                    <Input
                      id="city"
                      placeholder="San Francisco"
                      value={shippingAddress.city}
                      onChange={(e) => handleAddressChange("city", e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="state" className="text-sm mb-1 block">State</Label>
                    <Input
                      id="state"
                      placeholder="CA"
                      maxLength={2}
                      value={shippingAddress.state}
                      onChange={(e) => handleAddressChange("state", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="zipCode" className="text-sm mb-1 block">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    placeholder="94102"
                    maxLength={5}
                    value={shippingAddress.zipCode}
                    onChange={(e) => handleAddressChange("zipCode", e.target.value)}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            {!isAddressComplete() && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Please complete all shipping address fields to continue.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Pickup Notes */}
        {deliveryMethod === "pickup" && (
          <div className="mt-4 space-y-4">
            <Separator />
            <div>
              <Label htmlFor="pickup-notes" className="text-sm mb-2 block">
                Pickup Arrangements <span className="text-gray-500">(Optional)</span>
              </Label>
              <Textarea
                id="pickup-notes"
                placeholder="Preferred pickup times, special instructions..."
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                The seller will contact you to arrange pickup details after purchase.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Purchase Summary */}
      {((purchaseType === "buy_now") || (purchaseType === "make_offer" && offerAmount > 0)) && isAddressComplete() && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900">
                {purchaseType === "buy_now" ? "Ready to Purchase" : "Offer Ready"}
              </p>
              <div className="text-sm text-green-700 mt-1 space-y-1">
                <p>{thing.name}</p>
                <p className="flex items-center gap-1">
                  {deliveryMethod === "shipping" ? (
                    <>
                      <Truck className="h-3 w-3" />
                      Ship to {shippingAddress.city}, {shippingAddress.state}
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3 w-3" />
                      Local pickup
                    </>
                  )}
                </p>
                <p className="pt-2 font-semibold text-base">
                  {purchaseType === "buy_now" ? "Total" : "Offer"}: ${getFinalPrice().toFixed(2)}
                </p>
                {purchaseType === "make_offer" && (
                  <p className="text-xs italic">
                    Seller will review your offer and respond within 48 hours
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}