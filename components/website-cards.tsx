"use client"

import { useState, useMemo } from "react"
import { motion, Variants } from "framer-motion"
import { Search, Globe, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Website } from "@/lib/types"

interface WebsiteCardsProps {
  websites: Website[]
}

export function WebsiteCards({ websites }: WebsiteCardsProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredWebsites = useMemo(() => {
    if (!searchQuery.trim()) return websites

    const query = searchQuery.toLowerCase()
    return websites.filter(
      (website) =>
        website.name.toLowerCase().includes(query) ||
        website.description.toLowerCase().includes(query) ||
        website.category.toLowerCase().includes(query)
    )
  }, [websites, searchQuery])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.08,
      },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  }

  return (
    <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
      <div className="relative flex flex-col justify-start items-center w-full">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
          {/* Left vertical line */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0"></div>
          {/* Right vertical line */}
          <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0"></div>

          <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="pt-16 sm:pt-20 md:pt-24 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full"
            >
              {/* Header Section */}
              <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12">
                <motion.div
                  variants={cardVariants}
                  className="w-full max-w-[600px] text-center flex justify-center flex-col text-foreground text-[28px] xs:text-[32px] sm:text-[42px] md:text-[48px] lg:text-[56px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif px-2 sm:px-4 md:px-0"
                >
                  Shadcn UI Website Collection
                </motion.div>
                <motion.div
                  variants={cardVariants}
                  className="w-full max-w-[480px] text-center flex justify-center flex-col text-muted-foreground sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm"
                >
                  Discover beautiful websites and components built with Shadcn UI
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
                    className="pl-10 h-12 text-base bg-background/60 backdrop-blur-sm border-border/50 rounded-full shadow-sm focus:bg-background focus:border-border transition-all duration-200"
                  />
                </div>
              </motion.div>

              {/* Horizontal separator line */}
              <div className="w-full border-t border-dashed border-border/60 mb-12"></div>

              {/* Website Cards Grid */}
              <motion.div
                variants={containerVariants}
                className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredWebsites.map((website, index) => (
                  <motion.div
                    key={website._id || index}
                    variants={cardVariants}
                    className="group cursor-pointer"
                  >
                    {/* SVG dotted border container */}
                    <div className="relative h-[340px] w-full">
                      {/* SVG Border */}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                      >
                        <rect
                          x="1"
                          y="1"
                          width="calc(100% - 2px)"
                          height="calc(100% - 2px)"
                          rx="8"
                          stroke="hsl(var(--border))"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          fill="none"
                        />
                      </svg>

                      {/* Card Content */}
                      <div className="relative h-full w-full p-1">
                        <div className="h-full w-full bg-muted/50 backdrop-blur-sm rounded-xl overflow-hidden group-hover:bg-muted/50 transition-all dark:bg-muted/50 duration-300 flex flex-col">
                          {/* Image Section - OG Image proportions (16:9) */}
                          <div className="relative h-44 bg-muted/50 overflow-hidden ">
                            <Image
                              src={website.image}
                              alt={`${website.name} preview`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              priority={index < 6}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
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
                                href={website.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 text-sm font-medium bg-background/80 hover:bg-primary hover:text-primary-foreground border border-border/50 rounded-md transition-all duration-200 group/btn"
                              >
                                <span>Visit</span>
                                <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-200" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* No results message */}
              {filteredWebsites.length === 0 && (
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