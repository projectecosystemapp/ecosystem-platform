import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Package, 
  CreditCard, 
  Code, 
  Settings, 
  BookOpen,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ExternalLink
} from "lucide-react";

/**
 * Stripe Connect Integration Documentation
 * 
 * This comprehensive documentation page explains the entire Stripe Connect
 * implementation for the Ecosystem marketplace, including architecture,
 * API endpoints, security considerations, and best practices.
 */
export default function StripeConnectDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Stripe Connect Integration Documentation
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete implementation guide for Stripe Connect in the Ecosystem marketplace platform
          </p>
          <div className="flex justify-center gap-2">
            <Badge>API Version 2024-06-20</Badge>
            <Badge>Controller-Based</Badge>
            <Badge>Direct Charges</Badge>
            <Badge>Production Ready</Badge>
          </div>
        </div>

        {/* Table of Contents */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Implementation Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Core Components</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Connected Account Management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Product Management System
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Checkout with Application Fees
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Webhook Event Handling
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Key Benefits</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    Automated fee collection
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    Provider dashboard access
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    Simplified dispute handling
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    Regulatory compliance
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Tabs */}
        <Tabs defaultValue="architecture" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Architecture Tab */}
          <TabsContent value="architecture">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Controller-Based Architecture
                  </CardTitle>
                  <CardDescription>
                    Our implementation uses Stripe&apos;s new controller-based approach for maximum flexibility
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Why Controller-Based?</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                      <li>Platform maintains control over fees and dashboard access</li>
                      <li>Connected accounts pay their own Stripe fees</li>
                      <li>Providers get full access to Stripe dashboard</li>
                      <li>Better compliance and regulatory handling</li>
                    </ul>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-green-700">✅ Controller Pattern</h4>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`await stripe.accounts.create({
  controller: {
    fees: { payer: 'account' },
    losses: { payments: 'stripe' },
    stripe_dashboard: { type: 'full' }
  },
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true }
  }
})`}
                      </pre>
                    </div>

                    <div className="border rounded-lg p-4 opacity-60">
                      <h4 className="font-semibold mb-2 text-red-700">❌ Legacy Pattern</h4>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`await stripe.accounts.create({
  type: 'express', // Legacy approach
  country: 'US',
  capabilities: {
    card_payments: { requested: true }
  }
})`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Flow Architecture</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <p className="font-semibold">Customer</p>
                        <p className="text-sm text-gray-600">Pays $100</p>
                      </div>
                      <ArrowRight className="text-gray-400" />
                      <div className="text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <CreditCard className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-semibold">Provider Account</p>
                        <p className="text-sm text-gray-600">Receives $85</p>
                      </div>
                      <ArrowRight className="text-gray-400" />
                      <div className="text-center">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <p className="font-semibold">Platform</p>
                        <p className="text-sm text-gray-600">Collects $15 fee</p>
                      </div>
                    </div>
                    <div className="text-center text-sm text-gray-600">
                      Direct Charges with Application Fees (15% platform commission)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Connected Account Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">1. Account Creation</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm mb-2"><strong>Endpoint:</strong> <code>POST /api/stripe/connect/accounts/create</code></p>
                        <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`{
  "providerId": "prov_abc123",
  "email": "provider@example.com",
  "country": "US",
  "businessType": "individual"
}`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. Status Checking</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm mb-2"><strong>Endpoint:</strong> <code>GET /api/stripe/connect/accounts/[accountId]/status</code></p>
                        <p className="text-sm text-gray-600">Returns real-time onboarding status, capabilities, and requirements.</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Onboarding Links</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm mb-2"><strong>Endpoint:</strong> <code>POST /api/stripe/connect/accounts/[accountId]/onboard</code></p>
                        <p className="text-sm text-gray-600">Generates secure, temporary URLs for Stripe&apos;s hosted onboarding flow.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-5 h-5" />
                    Security Considerations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>• Always verify provider ownership before account operations</p>
                  <p>• Check onboarding completion before allowing payments</p>
                  <p>• Use HTTPS for all onboarding redirect URLs</p>
                  <p>• Implement rate limiting on account creation endpoints</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Product Management with Stripe-Account Header
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Key Concept: Stripe-Account Header</h4>
                    <p className="text-sm mb-2">
                      Products are created directly on connected accounts using the <code>stripeAccount</code> parameter.
                      This ensures each provider owns their products while maintaining marketplace control.
                    </p>
                    <pre className="text-xs bg-white p-2 rounded border">
{`await stripe.products.create({
  name: "Photography Session",
  default_price_data: {
    unit_amount: 15000,
    currency: "usd"
  }
}, {
  stripeAccount: "acct_abc123" // Routes to connected account
})`}
                    </pre>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Available Operations</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Create:</strong> <code>POST /products</code></li>
                        <li>• <strong>List:</strong> <code>GET /products</code></li>
                        <li>• <strong>Retrieve:</strong> <code>GET /products/[id]</code></li>
                        <li>• <strong>Update:</strong> <code>PUT /products/[id]</code></li>
                        <li>• <strong>Delete:</strong> <code>DELETE /products/[id]</code></li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Validation Rules</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Minimum price: $0.50 (50 cents)</li>
                        <li>• Name required, max 250 characters</li>
                        <li>• Description optional, max 1000 characters</li>
                        <li>• Up to 8 product images supported</li>
                        <li>• Currency must match account country</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Example: Creating a Service Product</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
{`// Request
POST /api/stripe/connect/accounts/acct_abc123/products
{
  "name": "2-Hour Photography Session",
  "description": "Professional portrait session including editing",
  "priceInCents": 25000,
  "currency": "usd",
  "images": ["https://example.com/portfolio-1.jpg"]
}

// Response
{
  "success": true,
  "product": {
    "id": "prod_xyz789",
    "name": "2-Hour Photography Session",
    "default_price": "price_abc123",
    "active": true,
    "account_id": "acct_abc123"
  }
}`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Marketplace Payments with Application Fees
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Direct Charges Pattern</h4>
                    <p className="text-sm mb-2">
                      We use Direct Charges (recommended for marketplaces) where:
                    </p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>Payment goes directly to the connected account</li>
                      <li>Platform automatically collects application fee</li>
                      <li>Provider handles disputes and chargebacks</li>
                      <li>Better for regulatory compliance</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Checkout Flow</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        <div>
                          <p className="font-medium">Create Checkout Session</p>
                          <p className="text-sm text-gray-600">POST /api/stripe/connect/checkout</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                        <div>
                          <p className="font-medium">Redirect to Stripe Checkout</p>
                          <p className="text-sm text-gray-600">Customer completes payment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                        <div>
                          <p className="font-medium">Webhook Processing</p>
                          <p className="text-sm text-gray-600">Update booking status, send notifications</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fee Calculation Example</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <h4 className="font-semibold">Customer Pays</h4>
                        <p className="text-2xl font-bold text-blue-600">$100.00</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Platform Fee (15%)</h4>
                        <p className="text-2xl font-bold text-red-600">-$15.00</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Provider Receives</h4>
                        <p className="text-2xl font-bold text-green-600">$85.00</p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-600">
                      <p>* Stripe processing fees (2.9% + 30¢) are paid by the connected account</p>
                      <p>* Application fee is collected by the platform automatically</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-5 h-5" />
                    Critical Security Measures
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Authentication & Authorization</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Verify user authentication on all endpoints</li>
                        <li>• Check provider ownership before operations</li>
                        <li>• Validate account access permissions</li>
                        <li>• Implement role-based access control</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Data Validation</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Sanitize all input parameters</li>
                        <li>• Validate fee percentages (max 30%)</li>
                        <li>• Check minimum/maximum amounts</li>
                        <li>• Verify account IDs format</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Webhook Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Signature Verification</h4>
                    <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`const sig = headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(
  body, 
  sig, 
  process.env.STRIPE_WEBHOOK_SECRET
);

// Always verify webhook signatures to prevent spoofing`}
                    </pre>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Handled Events</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <code>account.updated</code></li>
                        <li>• <code>payment_intent.succeeded</code></li>
                        <li>• <code>payment_intent.payment_failed</code></li>
                        <li>• <code>checkout.session.completed</code></li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Best Practices</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Idempotent event processing</li>
                        <li>• Retry failed webhook deliveries</li>
                        <li>• Log all webhook events</li>
                        <li>• Handle duplicate events gracefully</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Environment Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Required Environment Variables</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-xs overflow-x-auto">
{`# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Platform Configuration
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=15
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Database (for provider validation)
DATABASE_URL=postgresql://...`}
                        </pre>
                      </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <h4 className="font-semibold mb-2 text-amber-800">Production Checklist</h4>
                      <ul className="text-sm space-y-1 text-amber-700">
                        <li>• Switch to live Stripe keys</li>
                        <li>• Configure production webhook endpoints</li>
                        <li>• Set up monitoring and alerting</li>
                        <li>• Enable rate limiting</li>
                        <li>• Configure CORS policies</li>
                        <li>• Set up error tracking (Sentry)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Ready to Test?</h3>
            <p className="mb-4">Try the interactive demo to explore all features</p>
            <div className="flex justify-center gap-4">
              <a 
                href="/demo/stripe-connect" 
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Interactive Demo
              </a>
              <a 
                href="https://stripe.com/docs/connect" 
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                Stripe Docs
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * ★ Insight ─────────────────────────────────────
 * This documentation provides comprehensive coverage of our Stripe Connect implementation:
 * 1. **Architecture Explanation**: Details the controller-based approach and its advantages
 * 2. **Security Guidelines**: Covers authentication, validation, and webhook security
 * 3. **Implementation Examples**: Real code snippets for all major operations
 * ─────────────────────────────────────────────────
 */