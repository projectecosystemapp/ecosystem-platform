import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Calendar, 
  Users, 
  Shield, 
  Star,
  Clock,
  TrendingUp,
  CheckCircle
} from "lucide-react";

export default function BecomeAProviderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-200">
            Join Our Community
          </Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Start Earning as a Provider
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Turn your expertise into income. Join thousands of professionals who are 
            building thriving businesses on our platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/become-a-provider/onboarding">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                Get Started Now
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 bg-white border-y">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">5,000+</div>
              <div className="text-gray-600 mt-1">Active Providers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">$3,500</div>
              <div className="text-gray-600 mt-1">Avg. Monthly Earnings</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">4.8</div>
              <div className="text-gray-600 mt-1">Average Rating</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">85%</div>
              <div className="text-gray-600 mt-1">Keep of Earnings</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in three simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative overflow-hidden">
              <div className="absolute top-4 left-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                1
              </div>
              <CardContent className="pt-20 pb-8">
                <h3 className="text-xl font-semibold mb-3">Create Your Profile</h3>
                <p className="text-gray-600">
                  Set up your professional profile with your services, pricing, and availability. 
                  Showcase your expertise with a portfolio and testimonials.
                </p>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden">
              <div className="absolute top-4 left-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                2
              </div>
              <CardContent className="pt-20 pb-8">
                <h3 className="text-xl font-semibold mb-3">Get Verified</h3>
                <p className="text-gray-600">
                  Complete our quick verification process to build trust with customers. 
                  Verified providers see 3x more bookings.
                </p>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden">
              <div className="absolute top-4 left-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                3
              </div>
              <CardContent className="pt-20 pb-8">
                <h3 className="text-xl font-semibold mb-3">Start Earning</h3>
                <p className="text-gray-600">
                  Accept bookings, deliver great service, and get paid automatically. 
                  Track your earnings and grow your business.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Providers Choose Us
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to succeed
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Competitive Earnings</h3>
                <p className="text-gray-600 text-sm">
                  Keep 85% of your earnings. Set your own rates and maximize your income.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Flexible Schedule</h3>
                <p className="text-gray-600 text-sm">
                  Work when you want. Set your availability and take time off whenever needed.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Quality Customers</h3>
                <p className="text-gray-600 text-sm">
                  Connect with verified customers who value your expertise and professionalism.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Payments</h3>
                <p className="text-gray-600 text-sm">
                  Get paid automatically after each booking. We handle all payment processing.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Growth Tools</h3>
                <p className="text-gray-600 text-sm">
                  Access analytics, marketing tools, and insights to grow your business.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Build Your Reputation</h3>
                <p className="text-gray-600 text-sm">
                  Collect reviews and testimonials to attract more customers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Provider Success Stories
            </h2>
            <p className="text-lg text-gray-600">
              Hear from providers who are thriving on our platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full" />
                  <div>
                    <div className="font-semibold">Sarah Chen</div>
                    <div className="text-sm text-gray-600">Photography</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 italic">
                  &ldquo;I doubled my client base in just 3 months. The platform makes it so easy 
                  to manage bookings and payments. I can focus on what I love - photography!&rdquo;
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full" />
                  <div>
                    <div className="font-semibold">Marcus Johnson</div>
                    <div className="text-sm text-gray-600">Personal Training</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 italic">
                  &ldquo;The flexibility is incredible. I set my own hours and rates. Last month 
                  was my best month yet - $8,500 in earnings!&rdquo;
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full" />
                  <div>
                    <div className="font-semibold">Emily Rodriguez</div>
                    <div className="text-sm text-gray-600">Business Consulting</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 italic">
                  &ldquo;Finally, a platform that understands service providers. The tools are 
                  intuitive and the support team is amazing.&rdquo;
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Requirements to Join
            </h2>
            <p className="text-lg text-gray-600">
              We maintain high standards for our community
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Professional Experience</div>
                  <div className="text-sm text-gray-600">
                    At least 1 year of experience in your service area
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Quality Portfolio</div>
                  <div className="text-sm text-gray-600">
                    Examples of your work to showcase your expertise
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Professional Communication</div>
                  <div className="text-sm text-gray-600">
                    Responsive and professional in customer interactions
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Valid Documentation</div>
                  <div className="text-sm text-gray-600">
                    Business license or relevant certifications (where applicable)
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Commitment to Quality</div>
                  <div className="text-sm text-gray-600">
                    Dedication to providing excellent service to customers
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of providers who are building successful businesses on our platform.
          </p>
          <Link href="/become-a-provider/onboarding">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Start Your Application
            </Button>
          </Link>
          <p className="mt-4 text-sm opacity-75">
            Takes less than 10 minutes • No fees to join
          </p>
        </div>
      </section>
    </div>
  );
}