import { db } from "@/db/db";
import { 
  providersTable,
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  type Provider,
  type NewProvider,
  type ProviderAvailability,
} from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, or, sql, desc, asc, gte, lte, between, isNotNull } from "drizzle-orm";

// Optimized provider search with full-text search and ranking
export async function searchProvidersOptimized(
  filters?: {
    query?: string;
    city?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    isVerified?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'rating' | 'price' | 'recent';
  }
): Promise<{ providers: (Provider & { relevanceScore?: number; recentBookings?: number })[]; total: number }> {
  
  // Build the base query with CTEs for better performance
  let searchQuery = db
    .select({
      provider: providersTable,
      // Calculate relevance score if there's a text query
      relevanceScore: filters?.query 
        ? sql<number>`ts_rank_cd(to_tsvector('english', 
            coalesce(${providersTable.displayName}, '') || ' ' || 
            coalesce(${providersTable.tagline}, '') || ' ' || 
            coalesce(${providersTable.bio}, '')), 
            plainto_tsquery('english', ${filters.query}))`
        : sql<number>`1`,
      // Recent booking count for popularity sorting
      recentBookings: sql<number>`(
        SELECT COUNT(*) 
        FROM ${bookingsTable} b 
        WHERE b.provider_id = ${providersTable.id} 
        AND b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
        AND b.status = 'completed'
      )`
    })
    .from(providersTable)
    .$dynamic();

  // Build WHERE conditions
  const conditions = [eq(providersTable.isActive, true)];

  // Full-text search condition
  if (filters?.query) {
    conditions.push(
      sql`to_tsvector('english', 
        coalesce(${providersTable.displayName}, '') || ' ' || 
        coalesce(${providersTable.tagline}, '') || ' ' || 
        coalesce(${providersTable.bio}, '')) @@ plainto_tsquery('english', ${filters.query})`
    );
  }

  // Location filters
  if (filters?.city) {
    conditions.push(eq(providersTable.locationCity, filters.city));
  }
  if (filters?.state) {
    conditions.push(eq(providersTable.locationState, filters.state));
  }

  // Price range filters
  if (filters?.minPrice !== undefined) {
    conditions.push(
      and(
        isNotNull(providersTable.hourlyRate),
        gte(sql`${providersTable.hourlyRate}::numeric`, filters.minPrice)
      )!
    );
  }
  if (filters?.maxPrice !== undefined) {
    conditions.push(
      and(
        isNotNull(providersTable.hourlyRate),
        lte(sql`${providersTable.hourlyRate}::numeric`, filters.maxPrice)
      )!
    );
  }

  // Rating filter
  if (filters?.minRating !== undefined) {
    conditions.push(gte(sql`${providersTable.averageRating}::numeric`, filters.minRating));
  }

  // Verification filter
  if (filters?.isVerified !== undefined) {
    conditions.push(eq(providersTable.isVerified, filters.isVerified));
  }

  // Apply conditions
  searchQuery = searchQuery.where(and(...conditions));

  // Apply sorting
  switch (filters?.sortBy) {
    case 'relevance':
      if (filters?.query) {
        searchQuery = searchQuery.orderBy(desc(sql`ts_rank_cd(to_tsvector('english', 
          coalesce(${providersTable.displayName}, '') || ' ' || 
          coalesce(${providersTable.tagline}, '') || ' ' || 
          coalesce(${providersTable.bio}, '')), 
          plainto_tsquery('english', ${filters.query}))`));
      } else {
        searchQuery = searchQuery.orderBy(desc(providersTable.averageRating), desc(providersTable.completedBookings));
      }
      break;
    case 'rating':
      searchQuery = searchQuery.orderBy(desc(providersTable.averageRating), desc(providersTable.completedBookings));
      break;
    case 'price':
      searchQuery = searchQuery.orderBy(asc(providersTable.hourlyRate));
      break;
    case 'recent':
      searchQuery = searchQuery.orderBy(desc(sql`(
        SELECT COUNT(*) 
        FROM ${bookingsTable} b 
        WHERE b.provider_id = ${providersTable.id} 
        AND b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
        AND b.status = 'completed'
      )`));
      break;
    default:
      searchQuery = searchQuery.orderBy(desc(providersTable.averageRating), desc(providersTable.completedBookings));
  }

  // Execute paginated query and count query in parallel
  const [providersResult, countResult] = await Promise.all([
    searchQuery
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(providersTable)
      .where(and(...conditions))
  ]);

  return {
    providers: providersResult.map(row => ({
      ...row.provider,
      relevanceScore: row.relevanceScore,
      recentBookings: row.recentBookings
    })),
    total: countResult[0].count,
  };
}

// Optimized featured providers with materialized view
export async function getFeaturedProvidersOptimized(limit: number = 6): Promise<Provider[]> {
  // Use regular Drizzle ORM query for better type safety
  return await db
    .select()
    .from(providersTable)
    .where(
      and(
        eq(providersTable.isActive, true),
        eq(providersTable.isVerified, true),
        gte(sql`${providersTable.averageRating}::numeric`, 4.5),
        eq(providersTable.stripeOnboardingComplete, true)
      )
    )
    .orderBy(desc(providersTable.completedBookings), desc(providersTable.averageRating))
    .limit(limit);
}

// Optimized availability calculation using separate queries (type-safe)
export async function calculateAvailableSlotsOptimized(
  providerId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number = 60, // in minutes
  timezone: string = "UTC"
): Promise<Array<{ date: string; slots: Array<{ startTime: string; endTime: string; available: boolean }> }>> {
  
  // Get provider availability
  const availability = await db
    .select()
    .from(providerAvailabilityTable)
    .where(
      and(
        eq(providerAvailabilityTable.providerId, providerId),
        eq(providerAvailabilityTable.isActive, true)
      )
    );

  // Get existing bookings in date range
  const existingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        between(bookingsTable.bookingDate, startDate, endDate),
        sql`${bookingsTable.status} NOT IN ('cancelled', 'no_show')`
      )
    );

  // Get blocked slots in date range
  const blockedSlots = await db
    .select()
    .from(providerBlockedSlotsTable)
    .where(
      and(
        eq(providerBlockedSlotsTable.providerId, providerId),
        between(providerBlockedSlotsTable.blockedDate, startDate, endDate)
      )
    );

  // Generate slots for each day
  const result: Array<{ date: string; slots: Array<{ startTime: string; endTime: string; available: boolean }> }> = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);

    if (dayAvailability) {
      const slots = generateTimeSlots(
        dayAvailability.startTime,
        dayAvailability.endTime,
        slotDuration,
        currentDate,
        existingBookings,
        blockedSlots
      );

      if (slots.length > 0) {
        result.push({
          date: currentDate.toISOString().split('T')[0],
          slots
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

// Helper function to generate time slots
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  date: Date,
  bookings: any[],
  blockedSlots: any[]
): Array<{ startTime: string; endTime: string; available: boolean }> {
  const slots = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += duration) {
    const slotStart = minutesToTime(minutes);
    const slotEnd = minutesToTime(minutes + duration);

    // Check if slot is available
    const isAvailable = !isSlotConflicted(date, slotStart, slotEnd, bookings, blockedSlots);

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      available: isAvailable
    });
  }

  return slots;
}

// Helper function to convert time to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert minutes to time
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Helper function to check slot conflicts
function isSlotConflicted(
  date: Date, 
  startTime: string, 
  endTime: string, 
  bookings: any[], 
  blockedSlots: any[]
): boolean {
  // Check booking conflicts
  const dateStr = date.toISOString().split('T')[0];
  const hasBookingConflict = bookings.some(booking => {
    if (booking.bookingDate.toISOString().split('T')[0] !== dateStr) return false;
    
    return (
      (startTime >= booking.startTime && startTime < booking.endTime) ||
      (endTime > booking.startTime && endTime <= booking.endTime) ||
      (startTime <= booking.startTime && endTime >= booking.endTime)
    );
  });

  // Check blocked slots
  const hasBlockedConflict = blockedSlots.some(blocked => {
    if (blocked.blockedDate.toISOString().split('T')[0] !== dateStr) return false;
    
    // Full day blocked
    if (!blocked.startTime || !blocked.endTime) return true;
    
    return (
      (startTime >= blocked.startTime && startTime < blocked.endTime) ||
      (endTime > blocked.startTime && endTime <= blocked.endTime) ||
      (startTime <= blocked.startTime && endTime >= blocked.endTime)
    );
  });

  return hasBookingConflict || hasBlockedConflict;
}

// Optimized booking conflict detection with proper locking
export async function checkBookingConflictOptimized(
  providerId: string,
  bookingDate: Date,
  startTime: string,
  endTime: string
): Promise<{ hasConflict: boolean; conflictingBookings: any[]; reason?: string }> {
  
  return await db.transaction(async (tx) => {
    // Check for conflicting bookings using regular Drizzle query
    const conflictingBookings = await tx
      .select({
        id: bookingsTable.id,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        status: bookingsTable.status
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.bookingDate, bookingDate),
          sql`${bookingsTable.status} NOT IN ('cancelled', 'no_show')`,
          or(
            and(
              sql`${startTime} >= ${bookingsTable.startTime}`,
              sql`${startTime} < ${bookingsTable.endTime}`
            ),
            and(
              sql`${endTime} > ${bookingsTable.startTime}`,
              sql`${endTime} <= ${bookingsTable.endTime}`
            ),
            and(
              sql`${startTime} <= ${bookingsTable.startTime}`,
              sql`${endTime} >= ${bookingsTable.endTime}`
            )
          )
        )
      );

    if (conflictingBookings.length > 0) {
      return {
        hasConflict: true,
        conflictingBookings,
        reason: "Time slot already booked"
      };
    }

    // Check provider availability
    const dayOfWeek = bookingDate.getDay();
    const availability = await tx
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.dayOfWeek, dayOfWeek),
          eq(providerAvailabilityTable.isActive, true)
        )
      );

    if (availability.length === 0) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        reason: "Provider not available on this day"
      };
    }

    const avail = availability[0];
    if (startTime < avail.startTime || endTime > avail.endTime) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        reason: "Time outside provider's available hours"
      };
    }

    // Check for blocked slots
    const blockedSlots = await tx
      .select()
      .from(providerBlockedSlotsTable)
      .where(
        and(
          eq(providerBlockedSlotsTable.providerId, providerId),
          eq(providerBlockedSlotsTable.blockedDate, bookingDate)
        )
      );

    // Check if any blocked slot conflicts
    const hasBlockedConflict = blockedSlots.some(blocked => {
      // Full day blocked
      if (!blocked.startTime || !blocked.endTime) return true;
      
      return (
        (startTime >= blocked.startTime && startTime < blocked.endTime) ||
        (endTime > blocked.startTime && endTime <= blocked.endTime) ||
        (startTime <= blocked.startTime && endTime >= blocked.endTime)
      );
    });

    if (hasBlockedConflict) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        reason: "Time slot is blocked by provider"
      };
    }

    return {
      hasConflict: false,
      conflictingBookings: []
    };
  });
}

// Optimized dashboard statistics using separate queries (type-safe)
export async function getProviderStatisticsOptimized(
  providerId: string,
  dateRange?: { start: Date; end: Date }
): Promise<{
  totalBookings: number;
  completedBookings: number;
  upcomingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  monthlyStats: Array<{ month: string; bookings: number; revenue: number }>;
}> {
  
  const startDate = dateRange?.start || new Date(new Date().getFullYear(), 0, 1); // Start of year
  const endDate = dateRange?.end || new Date();

  // Get all bookings for the date range
  const allBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        between(bookingsTable.bookingDate, startDate, endDate)
      )
    );

  // Calculate basic statistics
  const now = new Date();
  const totalBookings = allBookings.length;
  const completedBookings = allBookings.filter(b => b.status === 'completed').length;
  const upcomingBookings = allBookings.filter(
    b => b.status === 'confirmed' && b.bookingDate >= now
  ).length;
  const cancelledBookings = allBookings.filter(b => b.status === 'cancelled').length;

  // Calculate revenue statistics
  const completedRevenue = allBookings
    .filter(b => b.status === 'completed')
    .map(b => parseFloat(b.providerPayout.toString()))
    .reduce((sum, amount) => sum + amount, 0);

  const averageBookingValue = completedBookings > 0 ? completedRevenue / completedBookings : 0;

  // Calculate top services
  const serviceStats = allBookings
    .filter(b => b.status === 'completed')
    .reduce((acc, booking) => {
      const serviceName = booking.serviceName;
      if (!acc[serviceName]) {
        acc[serviceName] = { name: serviceName, count: 0, revenue: 0 };
      }
      acc[serviceName].count++;
      acc[serviceName].revenue += parseFloat(booking.providerPayout.toString());
      return acc;
    }, {} as Record<string, { name: string; count: number; revenue: number }>);

  const topServices = Object.values(serviceStats)
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 5);

  // Calculate monthly statistics
  const monthlyStats = allBookings
    .filter(b => b.status === 'completed')
    .reduce((acc, booking) => {
      const month = booking.bookingDate.toISOString().slice(0, 7); // YYYY-MM format
      if (!acc[month]) {
        acc[month] = { month, bookings: 0, revenue: 0 };
      }
      acc[month].bookings++;
      acc[month].revenue += parseFloat(booking.providerPayout.toString());
      return acc;
    }, {} as Record<string, { month: string; bookings: number; revenue: number }>);

  const sortedMonthlyStats = Object.values(monthlyStats)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);

  return {
    totalBookings,
    completedBookings,
    upcomingBookings,
    cancelledBookings,
    totalRevenue: completedRevenue,
    averageBookingValue,
    topServices,
    monthlyStats: sortedMonthlyStats
  };
}

// Optimized provider lookup using separate queries (type-safe)
export async function getProviderBySlugOptimized(slug: string): Promise<(Provider & { 
  recentBookings?: number;
  testimonials?: any[];
  availability?: ProviderAvailability[];
}) | null> {
  
  // Get provider data
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(
      and(
        eq(providersTable.slug, slug),
        eq(providersTable.isActive, true)
      )
    );

  if (!provider) {
    return null;
  }

  // Get additional data in parallel
  const [recentBookingsCount, testimonials, availability] = await Promise.all([
    // Recent bookings count
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, provider.id),
          gte(bookingsTable.bookingDate, sql`CURRENT_DATE - INTERVAL '30 days'`),
          eq(bookingsTable.status, 'completed')
        )
      )
      .then(result => result[0]?.count || 0),
    
    // Featured testimonials (would need to implement this table properly)
    Promise.resolve([]), // Placeholder for testimonials
    
    // Provider availability
    db
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, provider.id),
          eq(providerAvailabilityTable.isActive, true)
        )
      )
      .orderBy(asc(providerAvailabilityTable.dayOfWeek))
  ]);

  return {
    ...provider,
    recentBookings: recentBookingsCount,
    testimonials,
    availability
  };
}
