import { OG_IMAGE_FALLBACK } from './og-image';

export interface SiteMetadata {
  title: string;
  description: string;
  ogImage: string;
  favicon?: string;
}

export async function fetchSiteMetadata(url: string): Promise<SiteMetadata> {
  try {
    const response = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.error('Error fetching site metadata:', error);

    // The fetch failed, so there is no image to report and nothing to upload
    // one to Cloudinary. This string is what the admin form saves as the
    // website's image, which is later read back as that page's og:image — so it
    // has to be a real path in `public/`, not a wish. It used to be
    // `/placeholder-image.jpg`, which was never committed: the form saved it,
    // and the website page then emitted an og:image pointing at a 404.
    return {
      title: new URL(url).hostname,
      description: 'No description available',
      ogImage: OG_IMAGE_FALLBACK,
    };
  }
}