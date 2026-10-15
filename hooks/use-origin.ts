"use client";

import { useEffect, useState } from "react";

/**
 * The site origin, resolved on the client.
 *
 * `window.location.origin` cannot be read during render: the server renders
 * with no `window`, so any component that inlines it produces a different
 * string on the server than on the client and Next.js throws a hydration
 * mismatch. Reading it in an effect means both passes agree on the first
 * paint, then the real origin replaces the fallback once mounted.
 */
export function useOrigin(fallback = "https://shadway.com"): string {
  const [origin, setOrigin] = useState(fallback);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return origin;
}
