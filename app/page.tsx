import { Website } from "@/lib/types";
import { WebsiteCards } from "@/components/website-cards";
import { CTASection } from "@/components/cta-section";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getWebsites(): Promise<Website[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/websites`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch websites');
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching websites:', error);
    return [];
  }
}

export default async function Home() {
  const featuredWebsites = await getWebsites();


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <WebsiteCards websites={featuredWebsites} />
      <CTASection />
      <Footer />
    </div>
  );
}