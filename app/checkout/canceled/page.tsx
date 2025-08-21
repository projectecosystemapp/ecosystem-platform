"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";

/**
 * Checkout Canceled Page
 * 
 * This page is displayed when a user cancels the Stripe checkout process.
 * It provides clear messaging and helpful next steps to re-engage the user.
 * 
 * URL: /checkout/canceled
 */
export default function CheckoutCanceledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Canceled Header */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl text-orange-800">Payment Canceled</CardTitle>
            <CardDescription className="text-orange-600">
              No worries! Your payment was not processed and you haven&apos;t been charged.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* What Happened */}
        <Card>
          <CardHeader>
            <CardTitle>What Happened?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You canceled the payment process before it was completed. This is completely normal 
              and happens for various reasons:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Changed your mind about the booking</li>
              <li>Wanted to review the details again</li>
              <li>Needed to check your schedule first</li>
              <li>Encountered a technical issue</li>
            </ul>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What Would You Like to Do?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Try Again */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                    <RefreshCcw className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Try Payment Again</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ready to complete your booking? You can restart the payment process.
                    </p>
                    <Button size="sm" className="w-full">
                      <Link href="#" onClick={() => window.history.back()}>
                        Return to Checkout
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Browse More */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                    <ArrowLeft className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Browse More Options</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Explore other providers or services that might be a better fit.
                    </p>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/providers">Browse Providers</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Other Options</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">Return Home</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/help">Get Help</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-700 text-sm mb-3">
              If you experienced any issues during checkout or have questions about the booking process, 
              we&apos;re here to help!
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100" asChild>
                <Link href="/contact">Contact Support</Link>
              </Button>
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100" asChild>
                <Link href="/faq">View FAQ</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Assurance */}
        <div className="text-center text-sm text-muted-foreground">
          <p>🔒 Your payment information is secure and was not stored or processed.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Key Features of this Canceled Page:
 * 
 * 1. Reassuring Messaging:
 *    - Clear indication that no payment was processed
 *    - Explains that canceling is normal and acceptable
 *    - Removes any anxiety about the cancellation
 * 
 * 2. Recovery Options:
 *    - Easy way to return to checkout ("Try Again")
 *    - Alternative paths (browse more providers)
 *    - Multiple navigation options
 * 
 * 3. User-Friendly Design:
 *    - Orange color scheme (attention without alarm)
 *    - Clear visual hierarchy
 *    - Helpful icons and visual cues
 * 
 * 4. Support Resources:
 *    - Links to help and FAQ
 *    - Contact support option
 *    - Multiple assistance pathways
 * 
 * 5. Trust Building:
 *    - Security reassurance
 *    - Professional presentation
 *    - Clear communication about what happened
 * 
 * 6. Conversion Recovery:
 *    - Prominent "Try Again" option
 *    - Alternative engagement paths
 *    - Reduces bounce rate from cancellations
 */