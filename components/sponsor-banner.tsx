"use client"

import { motion } from "framer-motion"
import { ExternalLink, Crown, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Website } from "@/lib/types"
import { addRefParameter } from "@/lib/utils/url"
import Image from "next/image"

interface SponsorBannerProps {
  website: Website
}

export function SponsorBanner({ website }: SponsorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full mb-12"
    >
      {/* Enhanced container with multiple layers */}
      <div className="relative">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 rounded-3xl blur-xl animate-pulse"></div>

        {/* Main banner container */}
        <div className="relative bg-gradient-to-r from-background/95 to-background/90 backdrop-blur-sm border-2 border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-amber-500/20">
          {/* Decorative elements */}
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium">
                Featured Sponsor
              </Badge>
            </div>
          </div>

          {/* Floating sparkles */}
          <div className="absolute top-8 left-8 animate-bounce delay-100">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="absolute bottom-8 right-16 animate-bounce delay-300">
            <Star className="w-3 h-3 text-orange-400" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12">
            {/* Left side - Content */}
            <div className="space-y-6 flex flex-col justify-center">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400 tracking-wide uppercase">
                    Premium Partner
                  </span>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent leading-tight">
                  {website.name}
                </h2>

                <p className="text-lg text-muted-foreground leading-relaxed">
                  {website.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                  {website.category}
                </Badge>
                {website.tags?.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
                    {tag}
                  </Badge>
                ))}
              </div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="pt-4"
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium px-8 py-3 shadow-lg shadow-amber-500/30"
                  onClick={() => window.open(addRefParameter(website.url), '_blank', 'noopener,noreferrer')}
                >
                  <span>Visit {website.name}</span>
                  <ExternalLink className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </div>

            {/* Right side - Enhanced Image */}
            <div className="relative">
              <div className="relative group">
                {/* Image glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>

                {/* Main image container */}
                <div className="relative bg-background border-2 border-amber-500/20 rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src={website.image}
                    alt={`${website.name} preview`}
                    className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Image overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

                  {/* Floating badge on image */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-black/50 text-white backdrop-blur-sm">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom decorative border */}
          <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
        </div>
      </div>
    </motion.div>
  )
}