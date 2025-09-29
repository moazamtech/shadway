"use client"

import { useState, useEffect } from "react"

interface GitHubRepo {
  stargazers_count: number
  name: string
  description: string
}

// In-memory cache for GitHub stars
const starsCache = new Map<string, { data: number; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useGitHubStars(owner: string, repo: string) {
  const [stars, setStars] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const cacheKey = `${owner}/${repo}`
    const cached = starsCache.get(cacheKey)

    // Check if we have valid cached data
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setStars(cached.data)
      setLoading(false)
      return
    }

    const fetchStars = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          next: { revalidate: 300 } // Cache for 5 minutes
        })

        if (!response.ok) {
          throw new Error("Failed to fetch repository data")
        }

        const data: GitHubRepo = await response.json()

        // Cache the result
        starsCache.set(cacheKey, {
          data: data.stargazers_count,
          timestamp: Date.now()
        })

        setStars(data.stargazers_count)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        setStars(null)
      } finally {
        setLoading(false)
      }
    }

    // Debounce the fetch to prevent rapid requests
    const timeoutId = setTimeout(fetchStars, 100)

    return () => clearTimeout(timeoutId)
  }, [owner, repo, mounted])

  return { stars, loading, error }
}