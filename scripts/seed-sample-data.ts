/**
 * Seed script to populate database with sample provider data
 * Run with: npx tsx scripts/seed-sample-data.ts
 */

import { db } from "@/db/db";
import { providersTable, providerAvailabilityTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
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
      
      // Add sample reviews for each provider
      const numReviews = Math.min(template.totalReviews, 10); // Add up to 10 sample reviews per provider
      
      for (let r = 0; r < numReviews; r++) {
        // Create a customer user for this review
        const customerId = `customer_${provider.id}_${r}_${Date.now()}`;
        await db.insert(profilesTable).values({
          userId: customerId,
          email: faker.internet.email(),
          membership: "free",
          status: "active",
        });
        
        // Create a completed booking for this review
        const bookingId = `booking_${provider.id}_${r}_${Date.now()}`;
        const bookingDate = faker.date.past({ years: 1 });
        
        await db.insert(bookingsTable).values({
          id: bookingId,
          providerId: provider.id,
          customerId: customerId,
          serviceType: template.serviceType,
          serviceName: services[serviceType][0].name,
          startTime: bookingDate.toISOString(),
          endTime: new Date(bookingDate.getTime() + 60 * 60 * 1000).toISOString(),
          status: "completed",
          totalAmount: services[serviceType][0].price.toString(),
          providerAmount: (services[serviceType][0].price * 0.9).toString(),
          platformFee: (services[serviceType][0].price * 0.1).toString(),
          paymentStatus: "captured",
          createdAt: bookingDate,
          updatedAt: bookingDate,
        });
        
        // Create the review
        const ratings = [5, 5, 5, 5, 4, 4, 4, 3]; // Weighted towards positive reviews
        const rating = ratings[Math.floor(Math.random() * ratings.length)];
        
        const reviewTexts = {
          5: [
            "Absolutely amazing service! Exceeded all my expectations.",
            "Professional, punctual, and delivered outstanding results. Highly recommend!",
            "Best experience I've had. Will definitely book again!",
            "Fantastic work! Very pleased with the outcome.",
            "Couldn't be happier with the service. 10/10!",
          ],
          4: [
            "Great service overall. Just a few minor areas for improvement.",
            "Very good experience. Would recommend to others.",
            "Professional and reliable. Happy with the results.",
            "Good value for money. Satisfied with the service.",
          ],
          3: [
            "Service was okay. Met basic expectations.",
            "Average experience. Nothing particularly special.",
            "Decent service but room for improvement.",
          ],
        };
        
        const reviewTextOptions = reviewTexts[rating as keyof typeof reviewTexts] || reviewTexts[5];
        const reviewText = reviewTextOptions[Math.floor(Math.random() * reviewTextOptions.length)];
        
        await db.insert(reviewsTable).values({
          bookingId: bookingId,
          providerId: provider.id,
          customerId: customerId,
          rating: rating,
          reviewText: reviewText,
          isVerifiedBooking: true,
          isPublished: true,
          isFlagged: false,
          createdAt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000), // Review day after booking
          updatedAt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000),
        });
      }
      
      console.log(`  ⭐ Added ${numReviews} reviews for ${displayName}`);
    }

    console.log("\n🎉 Sample data seeded successfully!");
    console.log(`Created ${profileIds.length} profiles and providers with reviews`);
    
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the seed
seedData();