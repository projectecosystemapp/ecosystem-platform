import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Camera, MapPin, Globe, DollarSign, Shield, Check } from "lucide-react";

export default async function ProfileSettingsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, userId))
    .limit(1);

  if (!provider) {
    redirect("/become-a-provider");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your provider profile and public information
        </p>
      </div>

      {/* Profile Form */}
      <form className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              This information will be displayed on your public profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  defaultValue={provider.displayName}
                  placeholder="Your business name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={provider.slug}
                  placeholder="your-unique-url"
                />
                <p className="text-xs text-gray-500">
                  ecosystem.com/providers/{provider.slug}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                name="tagline"
                defaultValue={provider.tagline || ''}
                placeholder="A short, catchy description of your services"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={provider.bio || ''}
                placeholder="Tell customers about yourself and your expertise..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Profile Images */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Images</CardTitle>
            <CardDescription>
              Upload your profile and cover images
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
                  {provider.profileImageUrl ? (
                    <img
                      src={provider.profileImageUrl}
                      alt="Profile"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <Camera className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <Button type="button" variant="outline" size="sm">
                    Upload Photo
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG or GIF. Max 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="space-y-2">
                <div className="h-32 w-full rounded-lg bg-gray-100 flex items-center justify-center">
                  {provider.coverImageUrl ? (
                    <img
                      src={provider.coverImageUrl}
                      alt="Cover"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <Camera className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <Button type="button" variant="outline" size="sm">
                  Upload Cover Image
                </Button>
                <p className="text-xs text-gray-500">
                  Recommended: 1920x480px. JPG or PNG. Max 10MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>
              Where you provide your services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationCity">City</Label>
                <Input
                  id="locationCity"
                  name="locationCity"
                  defaultValue={provider.locationCity || ''}
                  placeholder="San Francisco"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationState">State</Label>
                <Input
                  id="locationState"
                  name="locationState"
                  defaultValue={provider.locationState || ''}
                  placeholder="CA"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationZipCode">ZIP Code</Label>
                <Input
                  id="locationZipCode"
                  name="locationZipCode"
                  defaultValue={provider.locationZipCode || ''}
                  placeholder="94102"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationCountry">Country</Label>
                <Input
                  id="locationCountry"
                  name="locationCountry"
                  defaultValue={provider.locationCountry || 'US'}
                  placeholder="US"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullAddress">Full Address</Label>
              <Input
                id="fullAddress"
                name="fullAddress"
                defaultValue={provider.fullAddress || ''}
                placeholder="123 Main St, San Francisco, CA 94102"
              />
              <p className="text-xs text-gray-500">
                This will be used for location-based searches
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Details</CardTitle>
            <CardDescription>
              Information about your expertise and rates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input
                  id="yearsExperience"
                  name="yearsExperience"
                  type="number"
                  defaultValue={provider.yearsExperience || ''}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Base Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="hourlyRate"
                    name="hourlyRate"
                    type="number"
                    defaultValue={provider.hourlyRate || ''}
                    placeholder="100"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Verification Status</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {provider.isVerified ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-medium">Verified Provider</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">Not Verified</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {provider.hasInsurance ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Insurance Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">No Insurance on File</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-900">Instant Booking</p>
                <p className="text-xs text-blue-700">
                  Allow customers to book without approval
                </p>
              </div>
              <input
                type="checkbox"
                name="instantBooking"
                defaultChecked={provider.instantBooking}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}