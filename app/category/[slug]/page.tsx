import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'
import { generateCategoryPageSEO, generateBreadcrumbSchema } from '@/lib/seo'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { StructuredData } from '@/components/structured-data'
import { WebsiteCards } from '@/components/website-cards'
import { addRefParameter } from '@/lib/utils/url'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getCategoryWebsites(category: string): Promise<{ websites: Website[]; count: number }> {
  try {
    const { db } = await connectToDatabase()

    // Case-insensitive search for category
    const websitesDocs = await db
      .collection<Website>('websites')
      .find({
        category: { $regex: new RegExp(`^${category}$`, 'i') }
      })
      .sort({ sequence: 1, createdAt: -1 })
      .toArray()

    // Convert MongoDB documents to plain objects
    const websites = websitesDocs.map(website => ({
      _id: website._id?.toString(),
      name: website.name,
      description: website.description,
      url: website.url,
      image: website.image,
      category: website.category,
      tags: website.tags,
      featured: website.featured,
      sequence: website.sequence,
      sponsor: website.sponsor,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
    }))

    return {
      websites,
      count: websites.length
    }
  } catch (error) {
    console.error('Error fetching category websites:', error)
    return { websites: [], count: 0 }
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = decodeURIComponent(slug)
  const { count } = await getCategoryWebsites(category)

  if (count === 0) {
    return {
      title: `${category} Websites Not Found | Shadway`,
      description: `No websites found in the ${category} category.`,
    }
  }

  return generateCategoryPageSEO(category, count)
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const category = decodeURIComponent(slug)
  const { websites, count } = await getCategoryWebsites(category)

  if (count === 0) {
    notFound()
  }

  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1)

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Categories', url: '/' },
    { name: categoryTitle, url: `/category/${slug}` }
  ])

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <StructuredData type="collection" data={{ websites }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema, null, 2)
        }}
      />

      {/* Background geometric pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="category-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#category-grid)" />
        </svg>
      </div>

      <div className="relative flex flex-col justify-start items-center w-full">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
          {/* Left vertical line with geometric elements */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
            <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Right vertical line with geometric elements */}
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

          <Navbar />

          <main className="w-full relative z-10 pt-32 pb-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
            <a href="/" className="hover:text-foreground transition-colors">Home</a>
            <span>/</span>
            <span>Categories</span>
            <span>/</span>
            <span>{categoryTitle}</span>
          </nav>

          {/* Header Section with geometric decorations */}
          <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 mx-auto relative">
            <div className="w-full max-w-[600px] text-center flex justify-center flex-col text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif px-2 sm:px-4 md:px-0 whitespace-nowrap relative">
              <span className="relative">
                {categoryTitle} Websites
                {/* Subtle underline decoration */}
                <svg className="absolute -bottom-2 left-1/2 transform -translate-x-1/2" width="280" height="8" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0,4 Q70,2 140,4 T280,4" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" opacity="0.3" />
                </svg>
              </span>
            </div>
            <div className="w-full max-w-[520px] text-center flex justify-center flex-col text-muted-foreground sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm">
              Discover {count} amazing {category.toLowerCase()} websites built with Shadcn UI.
              Get inspired by modern {category.toLowerCase()} interfaces and design patterns.
            </div>
          </div>

          {/* Stats with enhanced styling */}
          <div className="flex justify-center mb-16">
            <div className="relative">
              <div className="bg-muted/50 backdrop-blur-sm border border-border/50 rounded-xl px-8 py-4 text-center shadow-sm">
                <div className="text-3xl font-bold text-primary mb-1">{count}</div>
                <div className="text-sm text-muted-foreground font-medium">
                  {categoryTitle} {count === 1 ? 'Website' : 'Websites'}
                </div>
              </div>
              {/* Decorative corners */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-primary/30 rounded-tl"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 border-r-2 border-t-2 border-primary/30 rounded-tr"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-l-2 border-b-2 border-primary/30 rounded-bl"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-r-2 border-b-2 border-primary/30 rounded-br"></div>
            </div>
          </div>

          {/* Horizontal separator line */}
          <div className="w-full border-t border-dashed border-border/60 mb-12"></div>

          {/* Website Cards Grid */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {websites.map((website, index) => (
              <div key={website._id || index} className="group cursor-pointer">
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
                        <img
                          src={website.image}
                          alt={`${website.name} preview`}
                          width={400}
                          height={225}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 p-4 flex flex-col">
                        <div className="flex items-start gap-2 mb-3">
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
                            className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 text-sm font-medium bg-background/80 hover:bg-primary hover:text-primary-foreground border border-border/50 rounded-md transition-all duration-200 group/btn"
                          >
                            <span>Visit Site</span>
                            <svg className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom separator line */}
          <div className="w-full border-t border-dashed border-border/60 mt-16"></div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}