import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'
import { generateWebsitePageSEO, generateBreadcrumbSchema } from '@/lib/seo'
import { generateWebsiteSlug } from '@/lib/slug'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { StructuredData } from '@/components/structured-data'
import { VisitWebsiteButton } from '@/components/visit-website-button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Globe, Tag, Sparkles, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Helper to generate unique content based on website data
function generateUniqueContent(website: Website) {
  const hasReact = website.tags?.some(tag => tag.toLowerCase().includes('react'))
  const hasNext = website.tags?.some(tag => tag.toLowerCase().includes('next'))
  const hasTypeScript = website.tags?.some(tag => tag.toLowerCase().includes('typescript'))
  const hasTailwind = website.tags?.some(tag => tag.toLowerCase().includes('tailwind'))

  const categoryDescriptions: Record<string, string> = {
    'component library': 'component collection offers reusable UI elements',
    'dashboard': 'dashboard provides comprehensive data visualization',
    'landing page': 'landing page delivers compelling user experiences',
    'portfolio': 'portfolio showcases professional work beautifully',
    'saas': 'SaaS platform demonstrates enterprise-grade functionality',
    'e-commerce': 'e-commerce solution features robust shopping capabilities',
    'documentation': 'documentation site presents information clearly',
    'blog': 'blog platform enables rich content presentation',
    'admin': 'admin interface streamlines management tasks',
    'marketing': 'marketing site drives user engagement effectively'
  }

  const techStack: string[] = []
  if (hasReact) techStack.push('React')
  if (hasNext) techStack.push('Next.js')
  if (hasTypeScript) techStack.push('TypeScript')
  if (hasTailwind) techStack.push('Tailwind CSS')

  const categoryDesc = categoryDescriptions[website.category.toLowerCase()] ||
    `${website.category.toLowerCase()} showcases modern web design`

  return {
    intro: `${website.name} is a meticulously crafted ${website.category.toLowerCase()} built with Shadcn UI components. This ${categoryDesc} while maintaining the highest standards of accessibility and user experience.`,

    techSection: techStack.length > 0
      ? `Built with a modern stack including ${techStack.join(', ')}, ${website.name} leverages ${website.tags?.slice(0, 3).join(', ')} to deliver exceptional performance and developer experience. The implementation demonstrates best practices in ${website.category.toLowerCase()} development.`
      : `${website.name} showcases expertise in ${website.tags?.slice(0, 4).join(', ') || 'modern web technologies'}, making it an excellent reference for developers building similar projects with Shadcn UI.`,

    designSection: `The design of ${website.name} exemplifies attention to detail with carefully considered typography, spacing, and color schemes. Every component is crafted to provide intuitive interactions while maintaining visual consistency throughout the interface.`,

    whyFeatured: `We featured ${website.name} in our collection because it represents exceptional ${website.category.toLowerCase()} design and implementation. The project serves as an inspiring example of what's possible when combining Shadcn UI's flexibility with thoughtful design decisions and modern development practices.`
  }
}

async function getWebsiteBySlug(slug: string): Promise<Website | null> {
  try {
    const { db } = await connectToDatabase()

    // Find website by matching the slug generated from name
    const websites = await db
      .collection<Website>('websites')
      .find({})
      .toArray()

    const website = websites.find(w => generateWebsiteSlug(w.name) === slug)

    if (!website) return null

    // Convert MongoDB document to plain object
    return {
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
    }
  } catch (error) {
    console.error('Error fetching website:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const website = await getWebsiteBySlug(slug)

  if (!website) {
    return {
      title: 'Website Not Found | Shadway',
      description: 'The requested website could not be found.',
    }
  }

  return generateWebsitePageSEO(website)
}

export default async function WebsitePage({ params }: PageProps) {
  const { slug } = await params
  const website = await getWebsiteBySlug(slug)

  if (!website) {
    notFound()
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Websites', url: '/' },
    { name: website.name, url: `/website/${slug}` }
  ])

  const content = generateUniqueContent(website)

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <StructuredData type="creativework" data={{ website }} />
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
            <pattern id="background-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#background-grid)" />
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
            <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">{website.name}</span>
        </nav>

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="secondary" className="text-sm">
              {website.category}
            </Badge>
            {website.featured && (
              <Badge variant="default" className="text-sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
            {website.sponsor?.active && (
              <Badge variant="outline" className="text-sm">
                <Zap className="w-3 h-3 mr-1" />
                Sponsored
              </Badge>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            {website.name}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-6">
            {website.description}
          </p>
        </div>

        {/* Featured Image with Card Border */}
        <div className="relative mb-12">
          <div className="relative p-1">
            {/* SVG Decorative Border */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                rx="2"
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                fill="none"
                className="opacity-60"
              />

              {/* Corner decorations */}
              <g className="opacity-40">
                <line x1="0" y1="6" x2="6" y2="6" stroke="hsl(var(--border))" strokeWidth="0.3" />
                <line x1="6" y1="0" x2="6" y2="6" stroke="hsl(var(--border))" strokeWidth="0.3" />

                <line x1="94" y1="0" x2="94" y2="6" stroke="hsl(var(--border))" strokeWidth="0.3" />
                <line x1="94" y1="6" x2="100" y2="6" stroke="hsl(var(--border))" strokeWidth="0.3" />

                <line x1="0" y1="94" x2="6" y2="94" stroke="hsl(var(--border))" strokeWidth="0.3" />
                <line x1="6" y1="94" x2="6" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />

                <line x1="94" y1="94" x2="100" y2="94" stroke="hsl(var(--border))" strokeWidth="0.3" />
                <line x1="94" y1="94" x2="94" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />
              </g>
            </svg>

            {/* Image container with exact aspect ratio */}
            <div className="relative aspect-video w-full bg-muted rounded-lg overflow-hidden">
              <Image
                src={website.image}
                alt={`${website.name} preview`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                priority
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Meta Information */}
        <div className="flex items-center gap-6 mb-8 flex-wrap text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              Added {website.createdAt ? new Date(website.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recently'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>{new URL(website.url).hostname}</span>
          </div>
        </div>

        {/* Tags */}
        {website.tags && website.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-8">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {website.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <div className="mb-12">
          <VisitWebsiteButton
            url={website.url}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md"
          />
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border/50 mb-12"></div>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* About Section */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              About {website.name}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-base">
              {content.intro}
            </p>
          </section>

          {/* Tech Stack Section */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Technology Stack & Implementation
            </h2>
            <p className="text-muted-foreground leading-relaxed text-base">
              {content.techSection}
            </p>
          </section>

          {/* Design Section */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Design Philosophy
            </h2>
            <p className="text-muted-foreground leading-relaxed text-base">
              {content.designSection}
            </p>
          </section>

          {/* Why Featured Section */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Why We Featured This
            </h2>
            <p className="text-muted-foreground leading-relaxed text-base">
              {content.whyFeatured}
            </p>
          </section>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 p-8 rounded-lg border border-border bg-muted/30">
          <h3 className="text-xl font-semibold text-foreground mb-3">
            Ready to explore {website.name}?
          </h3>
          <p className="text-muted-foreground mb-6">
            Visit the live website to experience all features and see the implementation in action.
          </p>
          <VisitWebsiteButton
            url={website.url}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200"
          />
        </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
