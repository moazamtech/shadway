"use client"

import { useState, useEffect } from "react"

interface GitHubRepo {
  stargazers_count: number
  name: string
  description: string
}

export function useGitHubStars(owner: string, repo: string) {
  const [stars, setStars] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStars = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)

        if (!response.ok) {
          throw new Error("Failed to fetch repository data")
        }

        const data: GitHubRepo = await response.json()
        setStars(data.stargazers_count)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        setStars(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStars()
  }, [owner, repo])

  return { stars, loading, error }
}