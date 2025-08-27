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
        category: providersTable.serviceCategory,
      },
      // Event details
      event: {
        id: eventsTable.id,
        name: eventsTable.name,
        description: eventsTable.description,
        image: eventsTable.imageUrl,
        price: eventsTable.price,
        date: eventsTable.date,
        location: eventsTable.location,
      },
      // Space details
      space: {
        id: spacesTable.id,
        name: spacesTable.name,
        description: spacesTable.description,
        image: spacesTable.imageUrl,
        hourlyRate: spacesTable.hourlyRate,
        dailyRate: spacesTable.dailyRate,
        location: spacesTable.location,
        capacity: spacesTable.capacity,
      },
      // Thing details
      thing: {
        id: thingsTable.id,
        name: thingsTable.name,
        description: thingsTable.description,
        image: thingsTable.imageUrl,
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

  // Transform favorites into a consistent format
  const transformedFavorites = favorites.map((fav) => {
    let itemData;
    let href = "/marketplace";
    
    switch (fav.type) {
      case "provider":
        itemData = {
          id: fav.provider?.id,
          name: fav.provider?.name,
          description: fav.provider?.description,
          image: fav.provider?.image,
          price: null,
          rating: fav.provider?.rating,
          category: fav.provider?.category,
        };
        href = `/providers/${fav.provider?.id}`;
        break;
        
      case "event":
        itemData = {
          id: fav.event?.id,
          name: fav.event?.name,
          description: fav.event?.description,
          image: fav.event?.image,
          price: fav.event?.price,
          rating: null,
          category: "Event",
          date: fav.event?.date,
          location: fav.event?.location,
        };
        href = `/events/${fav.event?.id}`;
        break;
        
      case "space":
        itemData = {
          id: fav.space?.id,
          name: fav.space?.name,
          description: fav.space?.description,
          image: fav.space?.image,
          price: fav.space?.hourlyRate,
          rating: null,
          category: "Space",
          capacity: fav.space?.capacity,
          location: fav.space?.location,
        };
        href = `/spaces/${fav.space?.id}`;
        break;
        
      case "thing":
        itemData = {
          id: fav.thing?.id,
          name: fav.thing?.name,
          description: fav.thing?.description,
          image: fav.thing?.image,
          price: fav.thing?.price,
          rating: null,
          category: fav.thing?.category,
          condition: fav.thing?.condition,
        };
        href = `/things/${fav.thing?.id}`;
        break;
        
      default:
        // Use cached data as fallback
        itemData = fav.cachedData || {};
        break;
    }
    
    return {
      id: fav.id,
      type: fav.type,
      notes: fav.notes,
      createdAt: fav.createdAt,
      href,
      ...itemData,
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