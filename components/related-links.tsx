import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Website } from '@/lib/types'
import { generateWebsiteSlug } from '@/lib/slug'

interface RelatedLinksProps {
  currentWebsite?: Website
  websites: Website[]
  maxLinks?: number
  className?: string
}

export function RelatedLinks({
  currentWebsite,
  websites,
  maxLinks = 6,
  className = ''
}: RelatedLinksProps) {
  // Filter and get related websites
  const getRelatedWebsites = () => {
    if (!currentWebsite) return websites.slice(0, maxLinks)

    // Get websites from same category
    const sameCategory = websites.filter(
      w => w._id !== currentWebsite._id &&
      w.category.toLowerCase() === currentWebsite.category.toLowerCase()
    )

    // Get websites with similar tags
    const similarTags = websites.filter(
      w => w._id !== currentWebsite._id &&
      w.tags?.some(tag => currentWebsite.tags?.includes(tag))
    )

    // Combine and deduplicate
    const related = [...sameCategory, ...similarTags]
    const unique = related.filter((website, index, self) =>
      index === self.findIndex(w => w._id === website._id)
    )

    return unique.slice(0, maxLinks)
  }

  const relatedWebsites = getRelatedWebsites()

  if (relatedWebsites.length === 0) return null

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">
          {currentWebsite ? 'Related Websites' : 'Featured Websites'}
        </h3>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatedWebsites.map((website) => (
          <Link
            key={website._id}
            href={`/website/${generateWebsiteSlug(website.name)}`}
            className="group block p-4 rounded-lg border border-border/50 hover:border-border transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <img
                  src={website.image}
                  alt={`${website.name} preview`}
                  className="w-12 h-12 rounded-md object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {website.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {website.description}
                </p>
                <div className="flex items-center mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted/50 text-muted-foreground">
                    {website.category}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Category links for better internal linking */}
      <div className="pt-6 border-t border-border/50">
        <h4 className="text-lg font-medium text-foreground mb-4">Browse by Category</h4>
        <div className="flex flex-wrap gap-2">
          {[...new Set(websites.map(w => w.category))].slice(0, 8).map((category) => (
            <Link
              key={category}
              href={`/category/${category.toLowerCase()}`}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {category}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}