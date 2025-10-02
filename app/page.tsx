"use client"

import { useState, useEffect } from "react";
import { Website } from "@/lib/types";
import { WebsiteCards } from "@/components/website-cards";
import { CTASection } from "@/components/cta-section";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { StructuredData } from "@/components/structured-data";
import { WebsiteGridSkeleton } from "@/components/skeletons/website-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* <Navbar /> */}
        <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
          {/* Background geometric pattern */}
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="background-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#background-grid)" />
            </svg>
          </div>

          <div className="relative flex flex-col justify-start items-center w-full">
            <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
              {/* Left vertical line */}
              <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
                <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
                <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
                <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              </div>

              {/* Right vertical line */}
              <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0">
                <div className="absolute top-40 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
                <div className="absolute top-72 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
                <div className="absolute top-[400px] right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              </div>

              {/* Decorative borders */}
              <div
                className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
                }}
              ></div>

              <div
                className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
                }}
              ></div>

              <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
                <div className="pt-24 sm:pt-28 md:pt-32 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full">
                  {/* Header Section Skeleton */}
                  <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 relative">

                    {/* Product Hunt and Peerlist Badges Skeleton */}
                    <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Skeleton className="w-[250px] h-[54px]" />
                      <Skeleton className="w-[200px] h-[72px]" />
                    </div>

                    {/* Title Skeleton */}
                    <div className="w-full max-w-[600px] text-center flex justify-center flex-col px-2 sm:px-4 md:px-0">
                      <Skeleton className="h-12 w-full max-w-[500px] mx-auto mb-4" />
                    </div>

                    {/* Description Skeleton */}
                    <div className="w-full max-w-[480px] text-center flex justify-center flex-col px-2 sm:px-4 md:px-0">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                    </div>
                  </div>

                  {/* Search Section Skeleton */}
                  <div className="w-full max-w-[540px] mb-16 relative">
                    <Skeleton className="h-12 w-full rounded-full" />
                  </div>

                  {/* Horizontal separator line */}
                  <div className="w-full border-t border-dashed border-border/60 mb-12"></div>

                  {/* Website Cards Grid Skeleton */}
                  <div className="mb-8">
                    <div className="text-center mb-8">
                      <Skeleton className="h-8 w-48 mx-auto mb-2" />
                      <Skeleton className="h-4 w-64 mx-auto" />
                    </div>
                  </div>

                  <WebsiteGridSkeleton count={9} />

                  {/* Bottom separator line */}
                  <div className="w-full border-t border-dashed border-border/60 mt-16"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* <CTASection />
        <Footer /> */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData type="collection" data={{ websites }} />
      <Navbar />
      <WebsiteCards websites={websites} />
      <CTASection />
      <Footer />
    </div>
  );
}