import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { StudioLayout } from "@/components/studio/StudioLayout";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

export default async function StudioMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Check if user is a provider
  const provider = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, userId))
    .limit(1);

  if (provider.length === 0) {
    // User is not a provider, redirect to become a provider page
    redirect("/become-a-provider");
  }

  return (
    <StudioLayout providerId={provider[0].id}>
      {children}
    </StudioLayout>
  );
}