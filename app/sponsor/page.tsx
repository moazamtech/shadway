"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { PricingSection } from "@/components/pricing-section"

export default function SponsorPage() {

  const sponsorshipPlans = [
    {
      name: "Basic Promotion",
      info: "Get noticed with enhanced listing",
      price: {
        monthly: 20,
      },
      features: [
        { text: "Enhanced card styling" },
        { text: "Top 10 position guarantee" },
        { text: "Sponsor badge" },
        { text: "Basic analytics" },
        { text: "Email support" },
      ],
      btn: {
        text: "Get Now",
        href: "https://x.com/loxtmozzi",
      },
    },
    {
      name: "Premium Spotlight",
      info: "Enhanced visibility with special card styling",
      price: {
        monthly: 50,
      },
      features: [
        { text: "Special sponsor card design" },
        { text: "Top 3 position guarantee" },
        { text: "Enhanced card animations" },
        { text: "Sponsor badge display" },
        { text: "Priority in search results" },
        { text: "Monthly analytics report" },
      ],
      btn: {
        text: "Get Now",
        href: "https://x.com/loxtmozzi",
      },
      highlighted: true,
    },
    {
      name: "Featured Banner",
      info: "Premium placement at the top of our homepage",
      price: {
        monthly: 39,
      },
      features: [
        { text: "Top banner placement on homepage" },
        { text: "Custom promotional card design" },
        { text: "Priority listing in website grid" },
        { text: "Direct traffic analytics" },
        { text: "Social media mentions" },
        { text: "Newsletter feature" },
      ],
      btn: {
        text: "Get Now",
        href: "https://x.com/loxtmozzi",
      },
    },
  ]

  return (
    <div className="min-h-screen relative bg-background overflow-x-hidden">
      <Navbar />
      {/* Background geometric pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sponsor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sponsor-grid)" />
        </svg>
      </div>

      <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Enhanced Left vertical line with geometric elements */}
            <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
              {/* Decorative elements along the line */}
              <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            </div>

            {/* Enhanced Right vertical line with geometric elements */}
            <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0">
              {/* Decorative elements along the line */}
              <div className="absolute top-40 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              <div className="absolute top-72 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
              <div className="absolute top-[400px] right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            </div>

            {/* Left decorative dashed border - outside of main lines */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            {/* Right decorative dashed border - outside of main lines */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
              <div
                className="pt-16 sm:pt-20 md:pt-24 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full"
              >
                {/* Header Section */}
                <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 relative">
                  <div
                    className="w-full max-w-[600px] text-center flex justify-center flex-col text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif px-2 sm:px-4 md:px-0 whitespace-nowrap relative"
                  >
                    <span className="relative">
                      Sponsor Your Website
                      {/* Subtle underline decoration */}
                      <svg className="absolute -bottom-2 left-1/2 transform -translate-x-1/2" width="200" height="8" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,4 Q50,2 100,4 T200,4" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" opacity="0.3" />
                      </svg>
                    </span>
                  </div>
                  <div
                    className="w-full max-w-[480px] text-center flex justify-center flex-col text-muted-foreground sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm"
                  >
                    Get your website in front of thousands of developers and designers. Increase your visibility with our premium sponsorship opportunities.
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="w-full">
                  <PricingSection
                    plans={sponsorshipPlans}
                    heading="Choose Your Plan"
                    description="Select the perfect sponsorship tier to maximize your website's exposure"
                  />
                </div>

                {/* Contact Section */}
                <div className="w-full max-w-4xl mt-16">
                  <div className="text-center p-12 space-y-6 border border-border/50 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      Ready to Get Started?
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Contact us on X to discuss sponsorship opportunities and get your website featured.
                    </p>
                    <div className="flex justify-center">
                      <Button
                        size="lg"
                        className="px-8 py-3 text-lg bg-black hover:bg-black text-white"
                        onClick={() => window.open('https://x.com/loxtmozzi', '_blank')}
                      >
<img src="https://img.freepik.com/free-vector/new-2023-twitter-logo-x-icon-design_1017-45418.jpg?t=st=1758552766~exp=1758556366~hmac=d9ff239bda740473d06ef101dcb94dde3d9d48a1b897020db528e22f4b1b2b52&w=1480" height={30} width={30} alt="" />
                        Contact Moazam
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}