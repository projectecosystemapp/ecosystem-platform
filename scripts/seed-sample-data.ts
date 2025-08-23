/**
 * Seed script to populate database with sample provider data
 * Run with: npx tsx scripts/seed-sample-data.ts
 */

import { db } from "@/db/db";
import { providersTable, providerAvailabilityTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { faker } from "@faker-js/faker";

const services = {
  photography: [
    { name: "Portrait Session", description: "Professional portrait photography", duration: 60, price: 150 },
    { name: "Event Photography", description: "Full event coverage", duration: 240, price: 800 },
    { name: "Product Photography", description: "E-commerce product shots", duration: 120, price: 300 },
  ],
  fitness: [
    { name: "Personal Training", description: "1-on-1 fitness session", duration: 60, price: 75 },
    { name: "Group Class", description: "Small group fitness class", duration: 45, price: 30 },
    { name: "Nutrition Consultation", description: "Personalized meal planning", duration: 30, price: 50 },
  ],
  tutoring: [
    { name: "Math Tutoring", description: "K-12 math help", duration: 60, price: 60 },
    { name: "SAT Prep", description: "Test preparation", duration: 90, price: 85 },
    { name: "Language Learning", description: "Foreign language instruction", duration: 60, price: 55 },
  ],
  cleaning: [
    { name: "House Cleaning", description: "Full home cleaning service", duration: 120, price: 120 },
    { name: "Deep Clean", description: "Thorough deep cleaning", duration: 240, price: 250 },
    { name: "Office Cleaning", description: "Commercial space cleaning", duration: 90, price: 100 },
  ],
  consulting: [
    { name: "Business Strategy", description: "Strategic planning session", duration: 120, price: 300 },
    { name: "Marketing Consultation", description: "Marketing strategy review", duration: 90, price: 200 },
    { name: "Tech Consultation", description: "Technology assessment", duration: 60, price: 150 },
  ],
};

const providerTemplates = [
  {
    displayName: "Sarah Johnson Photography",
    tagline: "Capturing life's precious moments",
    bio: "Professional photographer with 10+ years of experience specializing in portraits, weddings, and events.",
    serviceType: "photography",
    hourlyRate: 150,
    yearsExperience: 10,
    isVerified: true,
    hasInsurance: true,
    instantBooking: true,
    averageRating: "4.8",
    totalReviews: 127,
    completedBookings: 342,
  },
  {
    displayName: "Mike's Fitness Studio",
    tagline: "Transform your body, transform your life",
    bio: "Certified personal trainer and nutritionist helping clients achieve their fitness goals.",
    serviceType: "fitness",
    hourlyRate: 75,
    yearsExperience: 7,
    isVerified: true,
    hasInsurance: true,
    instantBooking: false,
    averageRating: "4.9",
    totalReviews: 89,
    completedBookings: 256,
  },
  {
    displayName: "Elite Tutoring Services",
    tagline: "Unlock your academic potential",
    bio: "Experienced educators providing personalized tutoring in math, science, and test prep.",
    serviceType: "tutoring",
    hourlyRate: 60,
    yearsExperience: 5,
    isVerified: true,
    hasInsurance: false,
    instantBooking: true,
    averageRating: "4.7",
    totalReviews: 64,
    completedBookings: 189,
  },
  {
    displayName: "Sparkle Clean Co.",
    tagline: "Your home, spotlessly clean",
    bio: "Professional cleaning service with eco-friendly products and satisfaction guarantee.",
    serviceType: "cleaning",
    hourlyRate: 50,
    yearsExperience: 8,
    isVerified: true,
    hasInsurance: true,
    instantBooking: true,
    averageRating: "4.6",
    totalReviews: 203,
    completedBookings: 567,
  },
  {
    displayName: "Strategic Business Solutions",
    tagline: "Empowering businesses to thrive",
    bio: "Business consultant specializing in growth strategy, operations, and digital transformation.",
    serviceType: "consulting",
    hourlyRate: 200,
    yearsExperience: 15,
    isVerified: true,
    hasInsurance: true,
    instantBooking: false,
    averageRating: "4.9",
    totalReviews: 41,
    completedBookings: 98,
  },
];

const cities = [
  { city: "San Francisco", state: "CA", zipCode: "94102" },
  { city: "Los Angeles", state: "CA", zipCode: "90001" },
  { city: "New York", state: "NY", zipCode: "10001" },
  { city: "Chicago", state: "IL", zipCode: "60601" },
  { city: "Austin", state: "TX", zipCode: "78701" },
  { city: "Seattle", state: "WA", zipCode: "98101" },
  { city: "Denver", state: "CO", zipCode: "80201" },
  { city: "Miami", state: "FL", zipCode: "33101" },
];

async function generateSlug(displayName: string): Promise<string> {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedData() {
  console.log("🌱 Starting to seed sample data...");

  try {
    // Create sample profiles first
    const profileIds: string[] = [];
    
    for (let i = 0; i < 20; i++) {
      const userId = `user_sample_${i}_${Date.now()}`;
      const email = faker.internet.email();
      
      await db.insert(profilesTable).values({
        userId,
        email,
        membership: "free",
        usageCredits: 5,
        usedCredits: 0,
        status: "active",
      });
      
      profileIds.push(userId);
      console.log(`✅ Created profile: ${email}`);
    }

    // Create providers
    for (let i = 0; i < profileIds.length; i++) {
      const template = providerTemplates[i % providerTemplates.length];
      const location = cities[i % cities.length];
      const serviceType = template.serviceType as keyof typeof services;
      
      // Create unique display name
      const displayName = `${template.displayName} ${i > 4 ? i : ""}`.trim();
      const slug = await generateSlug(displayName);
      
      const [provider] = await db.insert(providersTable).values({
        userId: profileIds[i],
        displayName,
        slug,
        tagline: template.tagline,
        bio: template.bio,
        locationCity: location.city,
        locationState: location.state,
        locationZipCode: location.zipCode,
        hourlyRate: template.hourlyRate.toString(),
        yearsExperience: template.yearsExperience,
        services: services[serviceType],
        isVerified: template.isVerified,
        hasInsurance: template.hasInsurance,
        instantBooking: template.instantBooking,
        averageRating: template.averageRating,
        totalReviews: template.totalReviews,
        completedBookings: template.completedBookings,
        isActive: true,
        profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`,
        coverImageUrl: `https://source.unsplash.com/800x400/?${serviceType}`,
      }).returning();
      
      console.log(`✅ Created provider: ${displayName} in ${location.city}, ${location.state}`);
      
      // Add availability for weekdays
      const availability = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }, // Tuesday
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
        { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
        { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }, // Friday
      ];
      
      for (const slot of availability) {
        await db.insert(providerAvailabilityTable).values({
          providerId: provider.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: true,
        });
      }
      
      console.log(`  📅 Added availability for ${displayName}`);
    }

    console.log("\n🎉 Sample data seeded successfully!");
    console.log(`Created ${profileIds.length} profiles and providers`);
    
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the seed
seedData();