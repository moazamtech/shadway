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

    return {
      title: new URL(url).hostname,
      description: 'No description available',
      ogImage: '/placeholder-image.jpg',
    };
  }
}