import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  ArrowRight, 
  Shield, 
  Clock, 
  Star, 
  Users, 
  DollarSign,
  Calendar,
  Search,
  Sparkles,
  TrendingUp,
  Award,
  Heart,
  MessageSquare,
  MapPin,
  Zap,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Stats data
const stats = [
  { label: "Active Providers", value: "10,000+", icon: Users },
  { label: "Happy Customers", value: "50,000+", icon: Heart },
  { label: "Services Booked", value: "100,000+", icon: Calendar },
  { label: "5-Star Reviews", value: "25,000+", icon: Star },
];

// Service categories
const categories = [
  { name: "Photography", icon: "📸", count: "2,500+ providers" },
  { name: "Personal Training", icon: "💪", count: "1,800+ providers" },
  { name: "Home Services", icon: "🏠", count: "3,200+ providers" },
  { name: "Tutoring", icon: "📚", count: "1,500+ providers" },
  { name: "Beauty & Wellness", icon: "💅", count: "2,100+ providers" },
  { name: "Business Consulting", icon: "💼", count: "900+ providers" },
  { name: "Event Planning", icon: "🎉", count: "750+ providers" },
  { name: "Pet Services", icon: "🐕", count: "1,200+ providers" },
];

// How it works steps
const howItWorks = {
  customer: [
    { step: 1, title: "Search & Discover", description: "Browse verified providers in your area", icon: Search },
    { step: 2, title: "Compare & Choose", description: "Read reviews and compare prices", icon: Star },
    { step: 3, title: "Book Instantly", description: "Schedule services with one click", icon: Calendar },
    { step: 4, title: "Pay Securely", description: "Protected payments through Stripe", icon: Shield },
  ],
  provider: [
    { step: 1, title: "Create Profile", description: "Showcase your skills and experience", icon: Users },
    { step: 2, title: "Set Your Rates", description: "Control your pricing and availability", icon: DollarSign },
    { step: 3, title: "Get Bookings", description: "Receive bookings from qualified customers", icon: Calendar },
    { step: 4, title: "Grow Your Business", description: "Build your reputation and expand", icon: TrendingUp },
  ],
};

// Features
const features = [
  {
    title: "Verified Providers",
    description: "All providers are background-checked and insured for your peace of mind",
    icon: Shield,
  },
  {
    title: "Instant Booking",
    description: "Book services instantly without back-and-forth messaging",
    icon: Zap,
  },
  {
    title: "Secure Payments",
    description: "Your payment is held securely until the service is completed",
    icon: DollarSign,
  },
  {
    title: "24/7 Support",
    description: "Our support team is always here to help you",
    icon: MessageSquare,
  },
  {
    title: "Satisfaction Guarantee",
    description: "Not satisfied? We'll make it right or refund your money",
    icon: CheckCircle2,
  },
  {
    title: "Location-Based",
    description: "Find providers near you with precise location matching",
    icon: MapPin,
  },
];

// Testimonials
const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Small Business Owner",
    content: "Found an amazing photographer for our product shoot. The quality was exceptional and the booking process was so simple!",
    rating: 5,
    avatar: "SM",
  },
  {
    name: "Mike Rodriguez",
    role: "Fitness Enthusiast",
    content: "My personal trainer from ECOSYSTEM has completely transformed my fitness journey. Best investment I've made!",
    rating: 5,
    avatar: "MR",
  },
  {
    name: "Emily Chen",
    role: "Busy Parent",
    content: "The home cleaning service I found here is fantastic. Reliable, professional, and my house has never been cleaner!",
    rating: 5,
    avatar: "EC",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 md:px-6 lg:py-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background -z-10" />
        
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="inline-flex gap-2" variant="secondary">
                <Sparkles className="h-3 w-3" />
                Trusted by 50,000+ users
              </Badge>
              
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                  Find Trusted Service Providers{" "}
                  <span className="text-primary">Near You</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                  Connect with verified professionals for any service you need. 
                  From photography to personal training, we've got you covered.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8">
                  <Link href="/providers">
                    Find Providers
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg px-8">
                  <Link href="/become-a-provider">
                    Become a Provider
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">Rated 4.9/5 from 25,000+ reviews</p>
                </div>
              </div>
            </div>

            <div className="relative lg:block hidden">
              <div className="relative w-full h-[500px]">
                {/* Placeholder for hero image/graphic */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl" />
                <div className="absolute inset-4 bg-card rounded-xl shadow-2xl p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Search className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 h-3 bg-muted rounded-full" />
                    </div>
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="h-2 bg-muted rounded w-3/4" />
                            <div className="h-2 bg-muted rounded w-1/2" />
                          </div>
                          <Badge variant="secondary">Available</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 md:px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center space-y-2">
                  <Icon className="h-8 w-8 mx-auto text-primary mb-2" />
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Popular Service Categories</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore our wide range of services from verified professionals
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((category) => (
              <Link key={category.name} href={`/providers?services=${category.name.toLowerCase()}`}>
                <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="text-4xl">{category.icon}</div>
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.count}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 md:px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Getting started is easy, whether you're a customer or provider
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* For Customers */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="default">For Customers</Badge>
              </div>
              {howItWorks.customer.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {step.title}
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* For Providers */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">For Providers</Badge>
              </div>
              {howItWorks.provider.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {step.title}
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Why Choose ECOSYSTEM?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're committed to providing the best experience for both customers and providers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-2 hover:border-primary transition-colors">
                  <CardHeader>
                    <Icon className="h-10 w-10 text-primary mb-2" />
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 md:px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">What Our Users Say</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of satisfied customers and providers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <CardTitle className="text-base">{testimonial.name}</CardTitle>
                      <CardDescription>{testimonial.role}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">"{testimonial.content}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-12 text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Ready to Get Started?
              </h2>
              <p className="text-xl opacity-90 max-w-2xl mx-auto">
                Join ECOSYSTEM today and experience the easiest way to book services or grow your business
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" variant="secondary" asChild className="text-lg px-8">
                  <Link href="/providers">
                    Browse Providers
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  <Link href="/become-a-provider">
                    Start Earning
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-12 px-4 md:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-lg mb-4">ECOSYSTEM</h3>
              <p className="text-muted-foreground text-sm">
                Your trusted marketplace for services.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">For Customers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/providers" className="hover:text-foreground">Browse Providers</Link></li>
                <li><Link href="/how-it-works" className="hover:text-foreground">How It Works</Link></li>
                <li><Link href="/trust-safety" className="hover:text-foreground">Trust & Safety</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">For Providers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/become-a-provider" className="hover:text-foreground">Start Earning</Link></li>
                <li><Link href="/provider-resources" className="hover:text-foreground">Resources</Link></li>
                <li><Link href="/provider-support" className="hover:text-foreground">Support</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
                <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} ECOSYSTEM. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-muted-foreground text-sm hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-muted-foreground text-sm hover:text-foreground">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}