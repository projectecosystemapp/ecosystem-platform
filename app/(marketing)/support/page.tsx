import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, Phone, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Support | Ecosystem Platform",
  description: "Get help with the Ecosystem Platform. Contact our support team or browse our help resources.",
};

export default function SupportPage() {
  return (
    <div className="container mx-auto max-w-6xl py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Support Center</h1>
        <p className="text-lg text-muted-foreground">
          We're here to help. Get support, find answers, or contact our team.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Support
            </CardTitle>
            <CardDescription>
              Get help via email within 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="mailto:support@ecosystem-platform.com">
                Send Email
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Live Chat
            </CardTitle>
            <CardDescription>
              Chat with our support team in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Phone Support
            </CardTitle>
            <CardDescription>
              Call us during business hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="tel:+1-555-0123">
                +1 (555) 012-3456
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">How do platform fees work?</h3>
              <p className="text-muted-foreground">
                We charge a 10% commission on successful bookings. Guest users pay an additional 
                10% surcharge. All fees are clearly shown before payment.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">How do I become a service provider?</h3>
              <p className="text-muted-foreground">
                Click "Become a Provider" to start the onboarding process. You'll need to complete 
                your profile, verify your identity, and set up payment processing.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, debit cards, and digital wallets through 
                our secure Stripe payment processing.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">How do cancellations work?</h3>
              <p className="text-muted-foreground">
                Cancellation policies vary by provider. Check the specific policy on each 
                service listing. Refunds are processed according to the provider's terms.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}