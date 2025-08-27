import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eventsTable } from "@/db/schema/events-schema";
import { spacesTable } from "@/db/schema/spaces-schema";
import { thingsTable } from "@/db/schema/things-schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ListingsTable } from "@/components/studio/ListingsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Package, Calendar, MapPin, ShoppingBag, Search, Filter } from "lucide-react";
import Link from "next/link";

async function getProviderListings(providerId: string) {
  // Get all services from provider (services are stored in the provider record)
  const [provider] = await db
    .select({
      id: providersTable.id,
      services: providersTable.services,
      displayName: providersTable.displayName,
    })
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  // Get all events
  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.providerId, providerId))
    .orderBy(desc(eventsTable.createdAt));

  // Get all spaces
  const spaces = await db
    .select()
    .from(spacesTable)
    .where(eq(spacesTable.providerId, providerId))
    .orderBy(desc(spacesTable.createdAt));

  // Get all things
  const things = await db
    .select()
    .from(thingsTable)
    .where(eq(thingsTable.providerId, providerId))
    .orderBy(desc(thingsTable.createdAt));

  return {
    services: provider?.services || [],
    events,
    spaces,
    things,
    totals: {
      services: provider?.services?.length || 0,
      events: events.length,
      spaces: spaces.length,
      things: things.length,
    },
  };
}

export default async function ListingsPage() {
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

  const listings = await getProviderListings(provider.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Listings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all your services, events, spaces, and things in one place
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link href="/studio/listings/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New Listing
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search listings..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different listing types */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="all">
            All ({listings.totals.services + listings.totals.events + listings.totals.spaces + listings.totals.things})
          </TabsTrigger>
          <TabsTrigger value="services">
            <Package className="mr-2 h-4 w-4" />
            Services ({listings.totals.services})
          </TabsTrigger>
          <TabsTrigger value="events">
            <Calendar className="mr-2 h-4 w-4" />
            Events ({listings.totals.events})
          </TabsTrigger>
          <TabsTrigger value="spaces">
            <MapPin className="mr-2 h-4 w-4" />
            Spaces ({listings.totals.spaces})
          </TabsTrigger>
          <TabsTrigger value="things">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Things ({listings.totals.things})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Listings</CardTitle>
            </CardHeader>
            <CardContent>
              <ListingsTable 
                listings={[
                  ...listings.services.map(s => ({ ...s, type: 'service' as const, id: s.name })),
                  ...listings.events.map(e => ({ ...e, type: 'event' as const })),
                  ...listings.spaces.map(s => ({ ...s, type: 'space' as const })),
                  ...listings.things.map(t => ({ ...t, type: 'thing' as const })),
                ]}
                providerId={provider.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Service Listings</CardTitle>
              <Link href="/studio/listings/services">
                <Button variant="outline" size="sm">Manage Services</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {listings.services.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No services yet</p>
                  <Link href="/studio/listings/create?type=service">
                    <Button className="mt-4" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Service
                    </Button>
                  </Link>
                </div>
              ) : (
                <ListingsTable 
                  listings={listings.services.map(s => ({ ...s, type: 'service' as const, id: s.name }))}
                  providerId={provider.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Event Listings</CardTitle>
              <Link href="/studio/listings/events">
                <Button variant="outline" size="sm">Manage Events</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {listings.events.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No events yet</p>
                  <Link href="/studio/listings/create?type=event">
                    <Button className="mt-4" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Event
                    </Button>
                  </Link>
                </div>
              ) : (
                <ListingsTable 
                  listings={listings.events.map(e => ({ ...e, type: 'event' as const }))}
                  providerId={provider.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spaces">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Space Listings</CardTitle>
              <Link href="/studio/listings/spaces">
                <Button variant="outline" size="sm">Manage Spaces</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {listings.spaces.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No spaces yet</p>
                  <Link href="/studio/listings/create?type=space">
                    <Button className="mt-4" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      List Your First Space
                    </Button>
                  </Link>
                </div>
              ) : (
                <ListingsTable 
                  listings={listings.spaces.map(s => ({ ...s, type: 'space' as const }))}
                  providerId={provider.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="things">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Thing Listings</CardTitle>
              <Link href="/studio/listings/things">
                <Button variant="outline" size="sm">Manage Things</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {listings.things.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No things listed yet</p>
                  <Link href="/studio/listings/create?type=thing">
                    <Button className="mt-4" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      List Your First Item
                    </Button>
                  </Link>
                </div>
              ) : (
                <ListingsTable 
                  listings={listings.things.map(t => ({ ...t, type: 'thing' as const }))}
                  providerId={provider.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}