"use client";

import * as React from "react";

/**
 * A timestamp that becomes relative once it is running in the browser.
 *
 * The card used to call `timeAgo(item.createdAt)` straight from render, which
 * runs twice — once on the server, once on hydration — against two different
 * clocks. Everything older than an hour agreed, so it looked fine; a component
 * created a minute ago rendered "2m ago" on the server and "1m ago" a second
 * later, and React discarded the tree with a hydration error. The window is not
 * small: every publish spends its first hour in the minute bucket, which is
 * exactly when its author is looking at the feed.
 *
 * The fix is not `suppressHydrationWarning`. That would silence the warning and
 * leave a label that is stale until something else re-renders the card, which on
 * a quiet feed is never. Here the clock is not consulted at all until after
 * mount: server and first client render both produce the same absolute date,
 * computed from the ISO string alone, and the relative label arrives in an
 * effect. It also re-renders once a minute, so a page left open does not keep
 * claiming a component was published "1m ago" an hour later.
 *
 * The absolute fallback is pinned to `en-US`/UTC on purpose: a locale-dependent
 * format would reintroduce the same mismatch from the other direction, because
 * the server's locale and the reader's are not the same setting.
 */
export function RelativeTime({
  value,
  className,
}: {
  /** The serialized timestamp from the card document. */
  value?: string;
  className?: string;
}) {
  const iso = typeof value === "string" ? value : "";
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!iso) return;
    const update = () => setLabel(timeAgo(iso));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [iso]);

  if (!iso) return null;

  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;

  return (
    <time
      dateTime={iso}
      className={className}
      title={new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(parsed)}
    >
      {label ?? absoluteDate(parsed)}
    </time>
  );
}

/** Deterministic, so the server frame and the first client frame match. */
function absoluteDate(then: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(then);
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}
