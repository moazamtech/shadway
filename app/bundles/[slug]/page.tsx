import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Layers } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { generateSEOMetadata } from "@/lib/seo";
import {
  getBundleBySlug,
  getBundleComponents,
  hasBundleAccess,
  isBundleFree,
} from "@/lib/db/bundles";
import { BundleDetail } from "@/components/marketplace/bundle-detail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const bundle = await getBundleBySlug(decoded).catch(() => null);

  // Missing or private bundles are never indexed.
  if (!bundle || !bundle.isPublic) {
    return generateSEOMetadata({
      title: "Bundle not found",
      description: "This bundle could not be found on Shadway.",
      url: `/bundles/${encodeURIComponent(decoded)}`,
      noIndex: true,
    });
  }

  return generateSEOMetadata({
    title: `${bundle.name} - Shadcn UI Bundle`,
    description:
      bundle.description ||
      `Install ${bundle.name}, a curated shadcn/ui bundle, with a single shadcn add command.`,
    url: `/bundles/${encodeURIComponent(bundle.slug)}`,
    image: bundle.coverImageUrl,
    keywords: ["shadcn bundle", bundle.name, "shadcn ui bundle"],
    type: "article",
  });
}

export default async function BundlePage({ params }: Props) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;

  const bundle = await getBundleBySlug(decoded, viewerId).catch(() => null);
  if (!bundle) notFound();

  const isAuthor = Boolean(viewerId && bundle.author.userId === viewerId);
  if (!bundle.isPublic && !isAuthor) notFound();

  const components = await getBundleComponents(bundle.componentSlugs).catch(() => []);
  const canReadSource = hasBundleAccess(bundle, bundle.plans, bundle.purchase, viewerId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <Link
            href="/bundles"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Bundles
          </Link>
        </div>
      </header>

      <BundleDetail
        bundle={{
          slug: bundle.slug,
          name: bundle.name,
          description: bundle.description,
          coverImageUrl: bundle.coverImageUrl,
          author: bundle.author,
          plans: bundle.plans.map((plan) => ({
            type: plan.type,
            description: plan.description,
            price: plan.price,
            features: plan.features,
          })),
          purchase: bundle.purchase
            ? {
                status: bundle.purchase.status,
                planType: bundle.purchase.planType,
                price: bundle.purchase.price,
                createdAt: bundle.purchase.createdAt.toISOString(),
              }
            : null,
          isFree: isBundleFree(bundle.plans),
          isPublic: bundle.isPublic,
          canReadSource,
          isAuthor,
        }}
        components={components.map((component) => ({
          slug: component.slug,
          title: component.title,
          description: component.description,
          thumbnailUrl: component.thumbnailUrl,
          videoUrl: component.videoUrl,
          category: component.category,
          tags: component.tags,
          installs: component.installs,
          views: component.views,
          likes: component.likes,
          author: component.author,
          dependencies: canReadSource ? component.dependencies : [],
          registryDependencies: canReadSource ? component.registryDependencies : [],
        }))}
      />
    </main>
  );
}
