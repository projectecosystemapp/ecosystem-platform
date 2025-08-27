import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Zap, Shield, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | Ecosystem Platform",
  description: "Learn about the Ecosystem Platform mission, values, and the team building the future of service marketplaces.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-6xl py-16 px-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">About Ecosystem Platform</h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          We're building the future of service marketplaces, connecting skilled professionals 
          with customers who need their expertise. Our platform empowers providers to build 
          thriving businesses while delivering exceptional experiences to customers.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <div>
          <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
          <p className="text-muted-foreground mb-4">
            To create a world where anyone can easily access quality services and skilled 
            professionals can build sustainable businesses. We believe in empowering both 
            sides of the marketplace with tools, technology, and trust.
          </p>
          <p className="text-muted-foreground">
            Our platform handles payments, bookings, and customer relationships so providers 
            can focus on what they do best - delivering exceptional services.
          </p>
        </div>
        
        <div>
          <h2 className="text-3xl font-bold mb-6">Our Values</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Heart className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Customer First</h3>
                <p className="text-muted-foreground text-sm">
                  Every decision we make prioritizes the experience of our users.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Trust & Safety</h3>
                <p className="text-muted-foreground text-sm">
                  We maintain the highest standards of security and reliability.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Innovation</h3>
                <p className="text-muted-foreground text-sm">
                  We continuously improve our platform with cutting-edge technology.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Secure Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Stripe-powered payment processing with escrow protection and automatic payouts.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Booking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automated booking management with real-time availability and calendar sync.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loyalty Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Built-in loyalty and referral programs to help providers retain customers.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Comprehensive analytics to help providers optimize their business performance.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Join Our Community</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Whether you're looking to provide services or book them, we're here to make 
          your experience exceptional. Join thousands of professionals and customers 
          who trust our platform.
        </p>
        <div className="flex justify-center gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              <div className="text-left">
                <div className="text-2xl font-bold">10,000+</div>
                <div className="text-muted-foreground">Active Users</div>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              <div className="text-left">
                <div className="text-2xl font-bold">50,000+</div>
                <div className="text-muted-foreground">Bookings Completed</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}