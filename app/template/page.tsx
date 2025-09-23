"use client"

import React, { useState, useEffect } from "react"
import { ExternalLink, Globe, Crown, DollarSign, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Template } from "@/lib/types"
import { cn } from "@/lib/utils"

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    strokeWidth="1.5"
    stroke="currentColor"
    className={cn("text-primary size-6", className)}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
  </svg>
)

const CornerPlusIcons = () => (
  <>
    <PlusIcon className="absolute -top-3 -left-3" />
    <PlusIcon className="absolute -top-3 -right-3" />
    <PlusIcon className="absolute -bottom-3 -left-3" />
    <PlusIcon className="absolute -bottom-3 -right-3" />
  </>
)

interface TemplateCardProps {
  template: Template
  index: number
}

function TemplateCard({ template }: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false)


  const getPriceDisplay = () => {
    // Handle both number and object price formats
    const price = typeof template.price === 'object' && template.price !== null
      ? (template.price as any).amount
      : template.price;

    if (price === 0) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Free</Badge>
    }
    return (
      <div className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-2 py-1 rounded-md">
        <DollarSign className="w-3 h-3" />
        <span className="font-medium">${price}</span>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-[400px] w-full">
        {/* SVG Border with Dotted Design */}
        <div
          className={cn(
            "relative border-2 border-dashed h-full transition-all duration-300",
            "flex flex-col bg-background",
            template.featured
              ? "border-primary shadow-xl shadow-primary/10 bg-primary/5"
              : "border-border hover:border-primary/50 hover:shadow-lg"
          )}
        >
          <CornerPlusIcons />

          {/* Background Pattern */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${isHovered ? 'opacity-10' : 'opacity-5'}`}
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--primary)) 0%, transparent 50%),
                               radial-gradient(circle at 80% 20%, hsl(var(--primary)) 0%, transparent 50%)`,
            }}
          />

          {/* Featured Badge */}
          {template.featured && (
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
                <Crown className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}

          {/* Price Badge */}
          <div className="absolute top-3 right-3 z-10">
            {getPriceDisplay()}
          </div>


          {/* Image Section */}
          <div className="relative h-48 overflow-hidden">
            <img
              src={template.image}
              alt={`${template.name} preview`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 flex flex-col relative z-10">
            <div className="flex items-start gap-2 mb-3">
              <div className={cn(
                "w-3 h-3 rounded-full flex-shrink-0 mt-1",
                template.featured ? "bg-primary" : "bg-muted-foreground"
              )}></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="font-bold text-lg leading-tight text-foreground">
                    {template.name}
                  </h3>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-1">
              {template.description}
            </p>

            {/* Action Buttons */}
            <div className="mt-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                onClick={() => window.open(template.demoUrl || (template as any).links?.demo, '_blank', 'noopener,noreferrer')}
              >
                <Globe className="w-3 h-3 mr-1" />
                Demo
              </Button>
              <Button
                size="sm"
                className={cn(
                  "flex-1 text-xs text-white dark:text-gray-900 font-medium",
                  (typeof template.price === 'object' && template.price !== null ? (template.price as any).amount : template.price) === 0
                    ? "bg-green-600 hover:bg-green-700 shadow-md shadow-green-600/30"
                    : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/30"
                )}
                onClick={() => window.open(template.purchaseUrl || (template as any).links?.purchase, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {(typeof template.price === 'object' && template.price !== null ? (template.price as any).amount : template.price) === 0 ? 'Download' : 'Get Template'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      } else {
        setError('Failed to fetch templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setError('Error fetching templates')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative bg-background overflow-x-hidden">
      <Navbar />
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="template-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#template-grid)" />
        </svg>
      </div>

      <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
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

            {/* Left decorative dashed border */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            {/* Right decorative dashed border */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
              <div
                className="pt-24 sm:pt-28 md:pt-32 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full"
              >
                {/* Header Section */}
                <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 relative">
                  <div
                    className="w-full max-w-[600px] text-center flex justify-center flex-col text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif px-2 sm:px-4 md:px-0 whitespace-nowrap relative"
                  >
                    <span className="relative">
                      Website Templates
                      {/* Subtle underline decoration */}
                      <svg className="absolute -bottom-2 left-1/2 transform -translate-x-1/2" width="200" height="8" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,4 Q50,2 100,4 T200,4" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" opacity="0.3" />
                      </svg>
                    </span>
                  </div>
                  <div
                    className="w-full max-w-[480px] text-center flex justify-center flex-col text-muted-foreground sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm"
                  >
                    Discover our curated collection of premium website templates. Perfect for developers, designers, and businesses looking for modern, responsive designs.
                  </div>
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground">{error}</p>
                  </div>
                )}

                {/* Templates Grid */}
                {!loading && !error && (
                  <div
                    className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-fr"
                  >
                    {templates.length > 0 ? (
                      templates.map((template, index) => (
                        <TemplateCard
                          key={template._id}
                          template={template}
                          index={index}
                        />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-20">
                        <p className="text-muted-foreground">No templates available yet.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}