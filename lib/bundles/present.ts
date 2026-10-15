import { isBundleFree } from "@/lib/db/bundles";
import type { BundleDocument, BundlePlanDocument, BundlePurchaseDocument } from "@/lib/db/bundles";
/**
 * Plain, JSON-safe shapes handed to client components.
 *
 * Mongo documents carry an `ObjectId` that must not cross the server/client
 * boundary, so every bundle crosses as its slug plus a string id.
 */

export type PresentedPlan = {
  type: BundlePlanDocument["type"];
  description: string;
  price: number;
  features: string[];
};

export type PresentedPurchase = {
  status: BundlePurchaseDocument["status"];
  planType?: BundlePurchaseDocument["planType"];
  price: number;
  createdAt: string;
};

export type PresentedBundle = {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImageUrl?: string;
  componentSlugs: string[];
  author: BundleDocument["author"];
  isPublic: boolean;
  featured: boolean;
  createdAt: string;
  plans: PresentedPlan[];
  purchase: PresentedPurchase | null;
  isFree: boolean;
  /** Set on the detail payload; absent on list summaries. */
  canReadSource?: boolean;
  isAuthor?: boolean;
};

export type PresentedComponent = {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  category: string;
  tags: string[];
  installs: number;
  views: number;
  likes: number;
  author: BundleDocument["author"];
  dependencies: string[];
  registryDependencies: string[];
  /** Only populated when the viewer may read the source. */
  code?: string;
};

/** A bundle is free when it has no priced plans. */
export function isFreeBundle(plans: BundlePlanDocument[]): boolean {
  return isBundleFree(plans);
}

export function presentBundle(
  bundle: BundleDocument,
  plans: BundlePlanDocument[],
  purchase: BundlePurchaseDocument | null
): PresentedBundle {
  return {
    id: bundle._id?.toString() ?? bundle.slug,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    coverImageUrl: bundle.coverImageUrl,
    componentSlugs: bundle.componentSlugs,
    author: bundle.author,
    isPublic: bundle.isPublic,
    featured: bundle.featured,
    createdAt: bundle.createdAt.toISOString(),
    plans: plans.map((plan) => ({
      type: plan.type,
      description: plan.description,
      price: plan.price,
      features: plan.features,
    })),
    purchase: purchase
      ? {
          status: purchase.status,
          planType: purchase.planType,
          price: purchase.price,
          createdAt: purchase.createdAt.toISOString(),
        }
      : null,
    isFree: isFreeBundle(plans),
  };
}

/**
 * The paywall, matching 21st's `getBundlesAction`: without access we drop the
 * source but keep imagery so the pack still browses.
 */
export function presentComponent(
  component: {
    slug: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    category: string;
    tags: string[];
    installs: number;
    views: number;
    likes: number;
    author: BundleDocument["author"];
    code: string;
    demoCode?: string;
    dependencies: string[];
    registryDependencies: string[];
  },
  canReadSource: boolean
): PresentedComponent {
  const base: PresentedComponent = {
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
  };

  return canReadSource ? { ...base, code: component.code } : base;
}
