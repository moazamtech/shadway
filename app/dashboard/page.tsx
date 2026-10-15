import type { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";
import { StudioDashboard } from "@/components/marketplace/studio-dashboard";

export const metadata: Metadata = generateSEOMetadata({
  title: "Dashboard",
  description:
    "Your Shadway dashboard: manage published components, bundles, saved items and marketplace activity.",
  url: "/dashboard",
  noIndex: true,
});

export default function DashboardPage() {
  return <StudioDashboard />;
}
