import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProviderBySlugAction } from "@/actions/providers-actions";
import { ProviderProfileClient } from "@/components/provider/provider-profile-client";
import { ProviderErrorBoundary } from "@/components/error-boundaries/provider-error-boundary";

interface ProviderProfilePageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({
  params,
}: ProviderProfilePageProps): Promise<Metadata> {
  const result = await getProviderBySlugAction(params.slug);

  if (!result.isSuccess || !result.data) {
    return {
      title: "Provider Not Found",
      description: "The requested provider profile could not be found.",
    };
  }

  const provider = result.data;

  return {
    title: `${provider.displayName} - ${provider.tagline || "Service Provider"} | Ecosystem`,
    description:
      provider.bio?.substring(0, 160) ||
      `Book services with ${provider.displayName}, a trusted provider on Ecosystem. ${provider.yearsExperience ? `${provider.yearsExperience} years of experience.` : ""} ${provider.totalReviews ? `${provider.totalReviews} reviews.` : ""}`,
    openGraph: {
      title: provider.displayName,
      description: provider.tagline || provider.bio?.substring(0, 160),
      images: provider.profileImageUrl ? [provider.profileImageUrl] : undefined,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: provider.displayName,
      description: provider.tagline || provider.bio?.substring(0, 160),
      images: provider.profileImageUrl ? [provider.profileImageUrl] : undefined,
    },
  };
}

export default async function ProviderProfilePage({
  params,
}: ProviderProfilePageProps) {
  const result = await getProviderBySlugAction(params.slug);

  if (!result.isSuccess || !result.data) {
    notFound();
  }

  const provider = result.data;

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: provider.displayName,
    description: provider.bio || provider.tagline,
    provider: {
      "@type": "Person",
      name: provider.displayName,
      image: provider.profileImageUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: provider.locationCity,
        addressRegion: provider.locationState,
        addressCountry: provider.locationCountry || "US",
      },
    },
    aggregateRating: provider.averageRating
      ? {
          "@type": "AggregateRating",
          ratingValue: provider.averageRating,
          reviewCount: provider.totalReviews,
        }
      : undefined,
    offers: provider.services?.map((service: any) => ({
      "@type": "Offer",
      name: service.name,
      description: service.description,
      price: service.price,
      priceCurrency: provider.currency.toUpperCase(),
    })),
  };

  return (
    <ProviderErrorBoundary 
      providerId={provider.id}
      providerName={provider.displayName}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProviderProfileClient provider={provider} />
    </ProviderErrorBoundary>
  );
}