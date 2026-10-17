/**
 * The version of the preview build.
 *
 * Bumped whenever the build changes in a way that invalidates what is already
 * stored or cached: a published component carries the version it was built
 * with, so a deploy that fixes the build repairs the catalogue on the next view
 * instead of serving yesterday's output forever.
 *
 * It lives apart from the builder so the client can name it too — the preview
 * frame is requested at a versioned URL, which is what keeps a stale frame from
 * outliving the build that produced it.
 *
 * 2 — import maps keyed on the specifiers the code actually wrote, and one
 *     shared React for everything the CDN has to serve.
 */
export const PREVIEW_BUILD_VERSION = 2;
