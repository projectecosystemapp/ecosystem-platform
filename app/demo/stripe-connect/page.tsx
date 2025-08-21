"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  CreditCard, 
  Users, 
  Package, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Plus,
  Eye,
  Edit,
  Trash2
} from "lucide-react";

/**
 * Stripe Connect Integration Demo
 * 
 * This page demonstrates all aspects of the Stripe Connect integration
 * built for the Ecosystem marketplace. It provides a comprehensive
 * interface for testing and understanding the integration.
 * 
 * Features demonstrated:
 * - Connected account creation and management
 * - Product management with Stripe-Account header
 * - Checkout session creation with application fees
 * - Real-time status checking
 * - Comprehensive error handling
 */
export default function StripeConnectDemoPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Demo data state
  const [accountData, setAccountData] = useState({
    providerId: "prov_demo_123",
    email: "provider@example.com",
    country: "US",
    businessType: "individual" as "individual" | "company"
  });

  const [productData, setProductData] = useState({
    accountId: "acct_demo_123",
    name: "Photography Session",
    description: "Professional portrait photography session",
    priceInCents: 15000,
    currency: "usd",
    images: ["https://images.unsplash.com/photo-1554048612-b6a482b224dd?w=400"]
  });

  const [checkoutData, setCheckoutData] = useState({
    accountId: "acct_demo_123",
    lineItems: [{ price: "price_demo_123", quantity: 1 }],
    applicationFeePercent: 15,
    successUrl: "https://myapp.com/checkout/success",
    cancelUrl: "https://myapp.com/checkout/canceled"
  });

  // API call handler
  const makeApiCall = async (endpoint: string, method: string = "GET", data?: any) => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        ...(data && { body: JSON.stringify(data) })
      });

      const result = await response.json();
      setResults({
        status: response.status,
        success: response.ok,
        data: result
      });
    } catch (error) {
      setResults({
        status: 500,
        success: false,
        data: { error: "Network error", details: error instanceof Error ? error.message : "Unknown error" }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Stripe Connect Integration Demo
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore the complete Stripe Connect implementation for the Ecosystem marketplace. 
            Test connected accounts, product management, and checkout flows with application fees.
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="secondary">Controller-Based Accounts</Badge>
            <Badge variant="secondary">Direct Charges</Badge>
            <Badge variant="secondary">Application Fees</Badge>
            <Badge variant="secondary">Stripe-Account Header</Badge>
          </div>
        </div>

        {/* Integration Overview */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Integration Architecture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold">Connected Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Controller-based accounts with full dashboard access
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold">Product Management</h3>
                <p className="text-sm text-muted-foreground">
                  Products created directly on connected accounts
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold">Marketplace Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Direct charges with automatic application fees
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Interface */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Testing Interface</CardTitle>
                <CardDescription>
                  Test all Stripe Connect API endpoints with real data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="accounts">Accounts</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="checkout">Checkout</TabsTrigger>
                  </TabsList>

                  {/* Connected Accounts Tab */}
                  <TabsContent value="accounts" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="providerId">Provider ID</Label>
                        <Input
                          id="providerId"
                          value={accountData.providerId}
                          onChange={(e) => setAccountData({ ...accountData, providerId: e.target.value })}
                          placeholder="prov_abc123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={accountData.email}
                          onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                          placeholder="provider@example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            value={accountData.country}
                            onChange={(e) => setAccountData({ ...accountData, country: e.target.value })}
                            placeholder="US"
                          />
                        </div>
                        <div>
                          <Label htmlFor="businessType">Business Type</Label>
                          <select 
                            className="w-full p-2 border rounded-md"
                            value={accountData.businessType}
                            onChange={(e) => setAccountData({ ...accountData, businessType: e.target.value as "individual" | "company" })}
                          >
                            <option value="individual">Individual</option>
                            <option value="company">Company</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        onClick={() => makeApiCall("/api/stripe/connect/accounts/create", "POST", accountData)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Connected Account
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => makeApiCall(`/api/stripe/connect/accounts/acct_demo_123/status`)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Check Account Status
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => makeApiCall("/api/stripe/connect/accounts/acct_demo_123/onboard", "POST", {
                          refreshUrl: "https://myapp.com/dashboard/provider/setup",
                          returnUrl: "https://myapp.com/dashboard/provider/payouts"
                        })}
                        disabled={loading}
                        className="w-full"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Create Onboarding Link
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Products Tab */}
                  <TabsContent value="products" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="accountId">Account ID</Label>
                        <Input
                          id="accountId"
                          value={productData.accountId}
                          onChange={(e) => setProductData({ ...productData, accountId: e.target.value })}
                          placeholder="acct_abc123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="productName">Product Name</Label>
                        <Input
                          id="productName"
                          value={productData.name}
                          onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                          placeholder="Photography Session"
                        />
                      </div>
                      <div>
                        <Label htmlFor="productDescription">Description</Label>
                        <Textarea
                          id="productDescription"
                          value={productData.description}
                          onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                          placeholder="Professional portrait photography session"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="price">Price (cents)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={productData.priceInCents}
                            onChange={(e) => setProductData({ ...productData, priceInCents: parseInt(e.target.value) })}
                            placeholder="15000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="currency">Currency</Label>
                          <Input
                            id="currency"
                            value={productData.currency}
                            onChange={(e) => setProductData({ ...productData, currency: e.target.value })}
                            placeholder="usd"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        onClick={() => makeApiCall(`/api/stripe/connect/accounts/${productData.accountId}/products`, "POST", productData)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Product
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => makeApiCall(`/api/stripe/connect/accounts/${productData.accountId}/products`)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        List Products
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Checkout Tab */}
                  <TabsContent value="checkout" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="checkoutAccountId">Account ID</Label>
                        <Input
                          id="checkoutAccountId"
                          value={checkoutData.accountId}
                          onChange={(e) => setCheckoutData({ ...checkoutData, accountId: e.target.value })}
                          placeholder="acct_abc123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="priceId">Price ID</Label>
                        <Input
                          id="priceId"
                          value={checkoutData.lineItems[0].price}
                          onChange={(e) => setCheckoutData({ 
                            ...checkoutData, 
                            lineItems: [{ ...checkoutData.lineItems[0], price: e.target.value }]
                          })}
                          placeholder="price_abc123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="applicationFee">Application Fee (%)</Label>
                        <Input
                          id="applicationFee"
                          type="number"
                          value={checkoutData.applicationFeePercent}
                          onChange={(e) => setCheckoutData({ ...checkoutData, applicationFeePercent: parseInt(e.target.value) })}
                          placeholder="15"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={() => makeApiCall("/api/stripe/connect/checkout", "POST", checkoutData)}
                      disabled={loading}
                      className="w-full"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Create Checkout Session
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  ) : results?.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : results && !results.success ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Settings className="w-5 h-5" />
                  )}
                  API Response
                </CardTitle>
                <CardDescription>
                  {loading ? "Making API request..." : "Response from the last API call"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={results.success ? "default" : "destructive"}>
                        {results.status} {results.success ? "Success" : "Error"}
                      </Badge>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                      <pre className="text-sm">{JSON.stringify(results.data, null, 2)}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Make an API call to see the response here</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">Test Account IDs:</h4>
                    <code className="bg-gray-100 px-2 py-1 rounded">acct_1RyNIdRhJeqQDKv9</code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Test Cards:</h4>
                    <div className="space-y-1">
                      <div><code className="bg-gray-100 px-2 py-1 rounded">4242 4242 4242 4242</code> - Visa</div>
                      <div><code className="bg-gray-100 px-2 py-1 rounded">4000 0000 0000 0002</code> - Declined</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">API Endpoints:</h4>
                    <div className="space-y-1 text-xs">
                      <div>POST /api/stripe/connect/accounts/create</div>
                      <div>GET /api/stripe/connect/accounts/[id]/status</div>
                      <div>POST /api/stripe/connect/accounts/[id]/products</div>
                      <div>POST /api/stripe/connect/checkout</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ★ Insight ─────────────────────────────────────
 * This demo page showcases the complete Stripe Connect implementation:
 * 1. **Controller-Based Architecture**: Uses the new controller pattern instead of legacy account types
 * 2. **Comprehensive Testing Interface**: Allows testing all API endpoints with real data
 * 3. **Real-Time Response Display**: Shows actual API responses for debugging and learning
 * ─────────────────────────────────────────────────
 */