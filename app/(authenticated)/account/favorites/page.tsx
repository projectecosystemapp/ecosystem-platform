import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { favoritesTable } from "@/db/schema/favorites-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eventsTable } from "@/db/schema/events-schema";
import { spacesTable } from "@/db/schema/spaces-schema";
import { thingsTable } from "@/db/schema/things-schema";
import { eq, desc, sql } from "drizzle-orm";
import { FavoritesClient } from "./FavoritesClient";

export default async function FavoritesPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Fetch all favorites with their related data
  const favorites = await db
    .select({
      id: favoritesTable.id,
      type: favoritesTable.type,
      cachedData: favoritesTable.cachedData,
      notes: favoritesTable.notes,
      createdAt: favoritesTable.createdAt,
      // Provider details
      provider: {
        id: providersTable.id,
        name: providersTable.displayName,
        description: providersTable.bio,
        image: providersTable.profileImageUrl,
        rating: sql<number>`4.5`,
        category: sql<string>`''`,  // serviceCategory doesn't exist in schema
      },
      // Event details
      event: {
        id: eventsTable.id,
        name: eventsTable.title,
        description: eventsTable.description,
        image: sql<string>`''`,  // imageUrl doesn't exist in events schema
        price: sql<number>`0`,  // price doesn't exist in events schema
        date: eventsTable.startDateTime,
        location: sql<string>`''`,  // location is complex nested object in schema
      },
      // Space details
      space: {
        id: spacesTable.id,
        name: spacesTable.name,
        description: spacesTable.description,
        image: sql<string>`''`,  // imageUrl doesn't exist in spaces schema
        hourlyRate: spacesTable.hourlyRate,
        dailyRate: spacesTable.dailyRate,
        location: sql<string>`''`,  // location is complex object in schema
        capacity: spacesTable.capacity,
      },
      // Thing details
      thing: {
        id: thingsTable.id,
        name: thingsTable.title,
        description: thingsTable.description,
        image: thingsTable.thumbnailUrl,
        price: thingsTable.price,
        condition: thingsTable.condition,
        category: thingsTable.category,
      },
    })
    .from(favoritesTable)
    .leftJoin(providersTable, eq(favoritesTable.providerId, providersTable.id))
    .leftJoin(eventsTable, eq(favoritesTable.eventId, eventsTable.id))
    .leftJoin(spacesTable, eq(favoritesTable.spaceId, spacesTable.id))
    .leftJoin(thingsTable, eq(favoritesTable.thingId, thingsTable.id))
    .where(eq(favoritesTable.userId, userId))
    .orderBy(desc(favoritesTable.createdAt));

  // Transform favorites into a consistent format matching the Favorite interface
  const transformedFavorites = favorites.filter((fav) => 
    (fav.provider?.id && fav.type === "provider") ||
    (fav.event?.id && fav.type === "event") ||
    (fav.space?.id && fav.type === "space") ||
    (fav.thing?.id && fav.type === "thing")
  ).map((fav) => {
    let name: string | undefined;
    let description: string | undefined;
    let image: string | null = null;
    let price: string | number | null = null;
    let rating: number | null = null;
    let category: string | undefined;
    let date: Date | undefined;
    let location: string | undefined;
    let capacity: number | undefined;
    let condition: string | undefined;
    let href = "/marketplace";
    
    switch (fav.type) {
      case "provider":
        name = fav.provider?.name || undefined;
        description = fav.provider?.description || undefined;
        image = fav.provider?.image || null;
        rating = fav.provider?.rating || null;
        category = fav.provider?.category || undefined;
        href = `/providers/${fav.provider!.id}`;
        break;
        
      case "event":
        name = fav.event?.name || undefined;
        description = fav.event?.description || undefined;
        image = fav.event?.image || null;
        price = fav.event?.price || null;
        category = "Event";
        date = fav.event?.date || undefined;
        location = fav.event?.location || undefined;
        href = `/events/${fav.event!.id}`;
        break;
        
      case "space":
        name = fav.space?.name || undefined;
        description = fav.space?.description || undefined;
        image = fav.space?.image || null;
        price = fav.space?.hourlyRate || null;
        category = "Space";
        capacity = fav.space?.capacity || undefined;
        location = fav.space?.location || undefined;
        href = `/spaces/${fav.space!.id}`;
        break;
        
      case "thing":
        name = fav.thing?.name || undefined;
        description = fav.thing?.description || undefined;
        image = fav.thing?.image || null;
        price = fav.thing?.price || null;
        category = fav.thing?.category || undefined;
        condition = fav.thing?.condition || undefined;
        href = `/things/${fav.thing!.id}`;
        break;
        
      default:
        // Use cached data as fallback
        const cached = fav.cachedData as any || {};
        name = cached.name;
        description = cached.description;
        image = cached.image;
        price = cached.price;
        rating = cached.rating;
        category = cached.category;
        break;
    }
    
    return {
      id: fav.id,
      type: fav.type,
      notes: fav.notes,
      createdAt: fav.createdAt,
      href,
      name,
      description,
      image,
      price,
      rating,
      category,
      date,
      location,
      capacity,
      condition,
    };
  });

  // Group favorites by type for statistics
  const stats = {
    total: favorites.length,
    providers: favorites.filter((f) => f.type === "provider").length,
    services: favorites.filter((f) => f.type === "service").length,
    events: favorites.filter((f) => f.type === "event").length,
    spaces: favorites.filter((f) => f.type === "space").length,
    things: favorites.filter((f) => f.type === "thing").length,
  };

  return <FavoritesClient favorites={transformedFavorites} stats={stats} />;
}