"use client";

/**
 * Last-resort error boundary.
 *
 * `app/error.tsx` catches errors inside a route, but it renders *within* the
 * root layout — so if the layout itself throws, nothing catches it and the user
 * gets Next.js's bare fallback. This file replaces the root layout entirely,
 * which is why it must render its own `<html>` and `<body>`.
 *
 * Styles are inline on purpose: this boundary can be reached when the layout
 * failed, and `globals.css` is imported by that layout. Depending on the design
 * tokens here would risk rendering an unstyled page at the exact moment the
 * user most needs to read it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: "#ffffff",
          color: "#141414",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Shadway failed to load
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#666",
            }}
          >
            A problem stopped the page from starting. Reloading usually fixes it.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, monospace",
                color: "#888",
              }}
            >
              ref {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              height: "2.25rem",
              padding: "0 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fafafa",
              background: "#141414",
              border: "none",
              borderRadius: "0.75rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
