"use client"

import { motion } from "framer-motion"
import { ExternalLink, Sparkles, Crown, Star, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Website } from "@/lib/types"
import { addRefParameter } from "@/lib/utils/url"

interface SponsorCardProps {
  website: Website
  tier: 'premium' | 'basic'
  index: number
}

export function SponsorCard({ website, tier, index }: SponsorCardProps) {
  const isPremium = tier === 'premium'

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut",
      },
    },
  }

  return (
    <motion.div
      variants={cardVariants}
      className="group cursor-pointer relative"
    >
      {/* Special glow effect for premium sponsors */}
      {isPremium && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
      )}

      {/* Enhanced SVG border container */}
      <div className={`relative h-[380px] w-full ${isPremium ? 'transform hover:scale-105' : ''} transition-transform duration-300`}>
        {/* Main SVG Border with sponsor styling */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Enhanced border for sponsors */}
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx="3"
            stroke={isPremium ? "url(#premiumGradient)" : "url(#basicGradient)"}
            strokeWidth={isPremium ? "1" : "0.5"}
            strokeDasharray={isPremium ? "none" : "3 3"}
            fill="none"
            className={isPremium ? "opacity-80" : "opacity-60"}
          />

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="premiumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(168, 85, 247)" />
              <stop offset="50%" stopColor="rgb(236, 72, 153)" />
              <stop offset="100%" stopColor="rgb(239, 68, 68)" />
            </linearGradient>
            <linearGradient id="basicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" />
            </linearGradient>
          </defs>

          {/* Enhanced corner elements for premium */}
          {isPremium && (
            <g className="opacity-60">
              <circle cx="8" cy="8" r="2" fill="rgb(168, 85, 247)" />
              <circle cx="92" cy="8" r="2" fill="rgb(236, 72, 153)" />
              <circle cx="8" cy="92" r="2" fill="rgb(16, 185, 129)" />
              <circle cx="92" cy="92" r="2" fill="rgb(239, 68, 68)" />
            </g>
          )}

          {/* Animated background pattern for premium */}
          {isPremium && (
            <defs>
              <pattern id={`sponsor-pattern-${index}`} width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="rgb(168, 85, 247)" opacity="0.1">
                  <animate attributeName="opacity" values="0.1;0.3;0.1" dur="3s" repeatCount="indefinite" />
                </circle>
              </pattern>
            </defs>
          )}
          {isPremium && <rect width="100" height="100" fill={`url(#sponsor-pattern-${index})`} />}
        </svg>

        {/* Card Content */}
        <div className="relative h-full w-full p-1">
          <div className={`h-full w-full backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 flex flex-col ${
            isPremium
              ? 'bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-red-50/50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-red-950/30 group-hover:from-purple-50/70 group-hover:via-pink-50/70 group-hover:to-red-50/70 dark:group-hover:from-purple-950/40 dark:group-hover:via-pink-950/40 dark:group-hover:to-red-950/40'
              : 'bg-gradient-to-br from-blue-50/50 via-cyan-50/50 to-green-50/50 dark:from-blue-950/30 dark:via-cyan-950/30 dark:to-green-950/30 group-hover:from-blue-50/70 group-hover:via-cyan-50/70 group-hover:to-green-50/70 dark:group-hover:from-blue-950/40 dark:group-hover:via-cyan-950/40 dark:group-hover:to-green-950/40'
          }`}>

            {/* Sponsor badges */}
            <div className="absolute top-3 left-3 z-10">
              <Badge className={`${
                isPremium
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-green-500 text-white'
              } font-medium`}>
                {isPremium ? (
                  <>
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Sponsor
                  </>
                )}
              </Badge>
            </div>

            {/* Floating animation elements */}
            {isPremium && (
              <>
                <div className="absolute top-6 right-6 animate-bounce delay-100">
                  <Star className="w-4 h-4 text-purple-500 opacity-60" />
                </div>
                <div className="absolute bottom-20 left-6 animate-bounce delay-300">
                  <Zap className="w-3 h-3 text-pink-500 opacity-60" />
                </div>
              </>
            )}

            {/* Image Section */}
            <div className="relative h-48 overflow-hidden">
              <img
                src={website.image}
                alt={`${website.name} preview`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />

              {/* Enhanced gradient overlay */}
              <div className={`absolute inset-0 ${
                isPremium
                  ? 'bg-gradient-to-t from-purple-900/20 via-transparent to-transparent'
                  : 'bg-gradient-to-t from-blue-900/20 via-transparent to-transparent'
              }`} />

              {/* Shimmer effect for premium */}
              {isPremium && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-1000"></div>
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex items-start gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                  isPremium ? 'bg-purple-500 animate-pulse' : 'bg-blue-500'
                }`}></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold text-lg leading-tight text-foreground">
                      {website.name}
                    </h3>
                    <Badge variant="outline" className={`text-xs ${
                      isPremium
                        ? 'border-purple-500/50 text-purple-600 dark:text-purple-400'
                        : 'border-blue-500/50 text-blue-600 dark:text-blue-400'
                    }`}>
                      {website.category}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-1">
                {website.description}
              </p>

              {/* Enhanced Action Button */}
              <div className="mt-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(addRefParameter(website.url), '_blank', 'noopener,noreferrer');
                  }}
                  className={`inline-flex items-center justify-center gap-2 w-full h-10 px-4 text-sm font-medium rounded-lg transition-all duration-200 group/btn ${
                    isPremium
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg shadow-blue-500/30'
                  }`}
                >
                  <span>Visit Site</span>
                  <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}