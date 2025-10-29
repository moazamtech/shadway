"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, Variants } from "framer-motion"
import { Search, Globe, ExternalLink, ImageIcon, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Website } from "@/lib/types"
import { addRefParameter } from "@/lib/utils/url"
import { SponsorBanner } from "./sponsor-banner"
import { SponsorCard } from "./sponsor-card"

interface WebsiteCardsProps {
  websites: Website[]
  loading?: boolean
}

export function WebsiteCards({ websites, loading = false }: WebsiteCardsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") || ""

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  // Update URL when search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        router.push(`?search=${encodeURIComponent(searchQuery)}`, { scroll: false })
      } else {
        router.push("/", { scroll: false })
      }
    }, 300) // Debounce by 300ms to avoid too many URL updates

    return () => clearTimeout(timer)
  }, [searchQuery, router])

  const handleImageError = (imageUrl: string) => {
    setFailedImages(prev => new Set(prev).add(imageUrl))
  }


  const { bannerSponsor, sponsorWebsites, regularWebsites } = useMemo(() => {
    // Separate sponsors from regular websites
    const bannerSponsor = websites.find(w => w.sponsor?.tier === 'banner' && w.sponsor?.active)
    const sponsors = websites.filter(w =>
      w.sponsor?.active &&
      (w.sponsor?.tier === 'premium' || w.sponsor?.tier === 'basic') &&
      w._id !== bannerSponsor?._id
    )
    const regular = websites.filter(w =>
      !w.sponsor?.active &&
      w._id !== bannerSponsor?._id
    )

    // Apply search filter if there's a query
    if (!searchQuery.trim()) {
      return {
        bannerSponsor,
        sponsorWebsites: sponsors,
        regularWebsites: regular
      }
    }

    const query = searchQuery.toLowerCase()
    const searchFilter = (website: Website) =>
      website.name.toLowerCase().includes(query) ||
      website.description.toLowerCase().includes(query) ||
      website.category.toLowerCase().includes(query)

    return {
      bannerSponsor: bannerSponsor && searchFilter(bannerSponsor) ? bannerSponsor : undefined,
      sponsorWebsites: sponsors.filter(searchFilter),
      regularWebsites: regular.filter(searchFilter)
    }
  }, [websites, searchQuery])

  const allFilteredWebsites = [
    ...(bannerSponsor ? [bannerSponsor] : []),
    ...sponsorWebsites,
    ...regularWebsites
  ]

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.15,
        staggerChildren: 0.02,
      },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 2 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.15,
        ease: "easeOut",
      },
    },
  }

  return (
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
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="pt-24 sm:pt-28 md:pt-32 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full"
            >
              <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 relative">

                <motion.div
                  variants={cardVariants}
                  className="w-full max-w-[700px] text-center flex justify-center flex-col text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif px-2 sm:px-4 md:px-0 relative"
                >
                  <span className="relative">
                    Shadcn UI Websites Collection
                    <svg className="absolute -bottom-2 left-1/2 transform -translate-x-1/2" width="200" height="8" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0,4 Q50,2 100,4 T200,4" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" opacity="0.3" />
                    </svg>
                  </span>
                </motion.div>
                <motion.div
                  variants={cardVariants}
                  className="w-full max-w-[650px] text-center flex justify-center flex-col text-muted-foreground sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm"
                >
                  Your ultimate collection of Shadcn UI websites and components. Discover beautiful, accessible, and customizable interfaces from open-source libraries to premium collections — all in one place to help you build stunning UIs faster.
                </motion.div>
              </div>

              {/* Search Section */}
              <motion.div
                variants={cardVariants}
                className="w-full max-w-[540px] mb-16 relative"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search websites, categories, or descriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base bg-background border-border/50 rounded-full shadow-sm focus:bg-background focus:border-border transition-all duration-200"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Horizontal separator line */}
              <div className="w-full border-t border-dashed border-border/60 mb-12"></div>

              {/* Banner Sponsor */}
              {bannerSponsor && (
                <motion.div variants={containerVariants}>
                  <SponsorBanner website={bannerSponsor} />
                </motion.div>
              )}

              {/* Sponsor websites section */}
              {sponsorWebsites.length > 0 && (
                <motion.div variants={containerVariants} className="mb-12">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-foreground mb-2">Featured Sponsors</h2>
                    <p className="text-muted-foreground">Premium websites from our valued partners</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sponsorWebsites.map((website, index) => (
                      <SponsorCard
                        key={website._id || index}
                        website={website}
                        tier={website.sponsor?.tier === 'premium' ? 'premium' : 'basic'}
                        index={index}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Regular Website Cards Grid */}
              {regularWebsites.length > 0 && (
                <>
                  {sponsorWebsites.length > 0 && (
                    <div className="w-full border-t border-dashed border-border/60 mb-12"></div>
                  )}
                  <motion.div variants={containerVariants} className="mb-8">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-foreground mb-2">All Websites</h2>
                      <p className="text-muted-foreground">Discover amazing Shadcn UI implementations</p>
                    </div>
                  </motion.div>
                </>
              )}

              <motion.div
                variants={containerVariants}
                className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                style={{ willChange: 'opacity' }}
              >
                {loading ? (
                  // Skeleton loading cards
                  Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="group cursor-pointer">
                      <div className="relative h-[340px] w-full">
                        {/* Main SVG Border with geometric elements */}
                        <svg
                          className="absolute inset-0 w-full h-full"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                        >
                          {/* Main border rectangle - full edge to edge */}
                          <rect
                            x="0"
                            y="0"
                            width="100"
                            height="100"
                            rx="3"
                            stroke="hsl(var(--border))"
                            strokeWidth="0.5"
                            strokeDasharray="2 2"
                            fill="none"
                            className="opacity-60"
                          />

                          {/* Corner geometric elements */}
                          <g className="opacity-40">
                            {/* Top-left corner */}
                            <line x1="0" y1="8" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
                            <line x1="8" y1="0" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

                            {/* Top-right corner */}
                            <line x1="92" y1="0" x2="92" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
                            <line x1="92" y1="8" x2="100" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

                            {/* Bottom-left corner */}
                            <line x1="0" y1="92" x2="8" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
                            <line x1="8" y1="92" x2="8" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />

                            {/* Bottom-right corner */}
                            <line x1="92" y1="92" x2="100" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
                            <line x1="92" y1="92" x2="92" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />
                          </g>

                          {/* Grid pattern overlay */}
                          <defs>
                            <pattern id={`grid-skeleton-${index}`} width="10" height="10" patternUnits="userSpaceOnUse">
                              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(var(--border))" strokeWidth="0.2" className="opacity-20"/>
                            </pattern>
                          </defs>
                          <rect width="100" height="100" fill={`url(#grid-skeleton-${index})`} className="opacity-30" />
                        </svg>

                        {/* Card Content */}
                        <div className="relative h-full w-full p-1">
                          <div className="h-full w-full bg-muted/50 backdrop-blur-sm rounded-xl overflow-hidden transition-all dark:bg-muted/50 duration-300 flex flex-col animate-pulse">
                            {/* Image placeholder */}
                            <div className="relative h-44 bg-muted/70"></div>

                            {/* Content placeholder */}
                            <div className="flex-1 p-4 flex flex-col">
                              <div className="flex items-start gap-2 mb-3">
                                <div className="w-4 h-4 rounded-full bg-muted flex-shrink-0 mt-1"></div>
                                <div className="flex-1">
                                  <div className="h-5 bg-muted rounded mb-2 w-3/4"></div>
                                </div>
                              </div>
                              <div className="space-y-2 mb-4 flex-1">
                                <div className="h-3 bg-muted rounded w-full"></div>
                                <div className="h-3 bg-muted rounded w-2/3"></div>
                              </div>
                              <div className="mt-auto">
                                <div className="h-8 bg-muted rounded"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  regularWebsites.map((website, index) => (
                  <motion.div
                    key={website._id || index}
                    variants={cardVariants}
                    className="group cursor-pointer"
                    style={{ willChange: 'transform, opacity' }}
                  >
                    {/* Enhanced SVG border container with geometric patterns */}
                    <div className="relative h-[340px] w-full">
                      {/* Main SVG Border with geometric elements */}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        {/* Main border rectangle - full edge to edge */}
                        <rect
                          x="0"
                          y="0"
                          width="100"
                          height="100"
                          rx="3"
                          stroke="hsl(var(--border))"
                          strokeWidth="0.5"
                          strokeDasharray="2 2"
                          fill="none"
                          className="opacity-60"
                        />

                        {/* Corner geometric elements */}
                        <g className="opacity-40">
                          {/* Top-left corner */}
                          <line x1="0" y1="8" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
                          <line x1="8" y1="0" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

                          {/* Top-right corner */}
                          <line x1="92" y1="0" x2="92" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
                          <line x1="92" y1="8" x2="100" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

                          {/* Bottom-left corner */}
                          <line x1="0" y1="92" x2="8" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
                          <line x1="8" y1="92" x2="8" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />

                          {/* Bottom-right corner */}
                          <line x1="92" y1="92" x2="100" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
                          <line x1="92" y1="92" x2="92" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />
                        </g>

                        {/* Grid pattern overlay */}
                        <defs>
                          <pattern id={`grid-${index}`} width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(var(--border))" strokeWidth="0.2" className="opacity-20"/>
                          </pattern>
                        </defs>
                        <rect width="100" height="100" fill={`url(#grid-${index})`} className="opacity-30" />
                      </svg>

                      {/* Card Content */}
                      <div className="relative h-full w-full p-1">
                        <div className="h-full w-full bg-muted/50 backdrop-blur-sm rounded-xl overflow-hidden group-hover:bg-muted/50 transition-all dark:bg-muted/50 duration-300 flex flex-col">
                          {/* Image Section - OG Image proportions (16:9) */}
                          <div className="relative h-44 bg-muted/50 overflow-hidden">
                            {failedImages.has(website.image) ? (
                              <div className="w-full h-full flex items-center justify-center bg-muted/70">
                                <div className="text-center text-muted-foreground">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-xs">Image unavailable</p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full overflow-hidden">
                                <Image
                                  src={website.image}
                                  alt={`${website.name} preview`}
                                  width={400}
                                  height={225}
                                  className="w-full h-full object-cover transition-colors duration-500 ease-out group-hover:scale-105"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  onError={() => handleImageError(website.image)}
                                  style={{ aspectRatio: '16/9' }}
                                  loading={index < 6 ? "eager" : "lazy"}
                                  placeholder="blur"
                                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                                  priority={index < 6}
                                  unoptimized={true}
                                />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                          </div>

                          {/* Content Section */}
                          <div className="flex-1 p-4 flex flex-col">
                            <div className="flex items-start gap-2 mb-3">
                              <Globe className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-base leading-tight text-foreground">
                                    {website.name}
                                  </h3>
                                  <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-black/20 dark:bg-white/20 rounded-md">
                                    {website.category}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-1">
                              {website.description}
                            </p>

                            {/* Action Button */}
                            <div className="mt-auto">
                              <a
                                href={addRefParameter(website.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 text-sm font-medium bg-background/80 hover:bg-primary hover:text-primary-foreground border border-border/50 rounded-md transition-all duration-200 group/btn"
                              >
                                <span>Visit Site</span>
                                <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-200" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  ))
                )}
              </motion.div>

              {/* No results message */}
              {!loading && allFilteredWebsites.length === 0 && (
                <motion.div
                  variants={cardVariants}
                  className="w-full text-center py-16"
                >
                  <div className="text-muted-foreground text-lg font-medium mb-2">
                    No websites found
                  </div>
                  <div className="text-muted-foreground/70 text-sm">
                    Try adjusting your search query
                  </div>
                </motion.div>
              )}

              {/* Bottom separator line */}
              <div className="w-full border-t border-dashed border-border/60 mt-16"></div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}