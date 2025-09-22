/**
 * Adds a referral parameter to a URL
 * @param url - The original URL
 * @param ref - The referral value (defaults to 'shadway')
 * @returns The URL with the referral parameter added
 */
export function addRefParameter(url: string, ref: string = 'shadway'): string {
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('ref', ref)
    return urlObj.toString()
  } catch (error) {
    // If URL parsing fails, append parameter manually
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}ref=${encodeURIComponent(ref)}`
  }
}

/**
 * Opens a URL in a new tab with referral parameter
 * @param url - The URL to open
 * @param ref - The referral value (defaults to 'shadway')
 */
export function openWithRef(url: string, ref: string = 'shadway'): void {
  const urlWithRef = addRefParameter(url, ref)
  window.open(urlWithRef, '_blank', 'noopener,noreferrer')
}