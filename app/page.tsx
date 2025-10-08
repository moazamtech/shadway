"use client"

import { useState, useEffect } from "react";
import { Website } from "@/lib/types";
import { WebsiteCards } from "@/components/website-cards";
import { CTASection } from "@/components/cta-section";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { StructuredData } from "@/components/structured-data";

async function getWebsites(): Promise<Website[]> {
  try {
    const response = await fetch('/api/websites', {
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

export default function Home() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchWebsites = async () => {
      try {
        setLoading(true);
        const data = await getWebsites();

        // Preload first few images for better performance
        if (data.length > 0) {
          data.slice(0, 6).forEach(website => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = website.image;
            document.head.appendChild(link);
          });
        }

        setWebsites(data);
      } catch (error) {
        console.error('Error fetching websites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWebsites();
  }, [mounted]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData type="collection" data={{ websites }} />
      <Navbar />
      <WebsiteCards websites={websites} loading={loading} />
      <CTASection />
      <Footer />
    </div>
  );
}
