/**
 * The marks of the tools a component can be installed into.
 *
 * They are drawn here rather than pulled from an icon set because they are
 * wordmarks: a package manager is named in letters, and a letter drawn in the
 * manager's own colour is the mark people already recognise. A generic icon
 * in a generic tab is a tab nobody can scan.
 */

type MarkProps = {
  className?: string;
};

const MARK = "h-3.5 w-3.5 shrink-0";

/** npm — the red square. */
export function NpmMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#CB3837" />
      <path
        fill="#fff"
        d="M5 7h2v9h4v2H5V7Zm6 0h2.4l2.1 4.2L17.6 7H20v11h-2v-6.9l-1.9 3.7h-.2L14 11.1V18h-2V7Z"
      />
    </svg>
  );
}

/** pnpm — the orange mark. */
export function PnpmMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#F9AD00" />
      <path
        fill="#1A1A1A"
        d="M5 6h3.2l3.3 3.9V6h3.3v5.6H12.5L9.2 7.7v9.7H5V6Z"
      />
      <path fill="#1A1A1A" d="M14.8 11.6H18v5.8h-3.2v-5.8Z" />
    </svg>
  );
}

/** Bun — the warm mark, in ink so it reads on a light page. */
export function BunMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#1A1A1A" />
      <path
        fill="#FBF1DF"
        d="M6.5 9.2c0-.8.6-1.4 1.4-1.4h1.1v1.2h6.2V7.8h1.1c.8 0 1.4.6 1.4 1.4v6.4c0 1.6-1.3 2.9-2.9 2.9H9.4c-1.6 0-2.9-1.3-2.9-2.9V9.2Zm2.2 1.6v4.8c0 .4.3.7.7.7h4.4c.4 0 .7-.3.7-.7v-4.8h-1.4v1.2h-3v-1.2H8.7Z"
      />
    </svg>
  );
}

/** v0 — the wordmark in a black tile. */
export function V0Mark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#111111" />
      <path
        fill="#fff"
        d="M5.6 6.6h2.5l2.4 5.1 2.4-5.1h2.5L12.1 15h-1.3L5.6 6.6Zm9.6 0h2.3c2.3 0 3.9 1.6 3.9 4.1 0 2.5-1.6 4.1-3.9 4.1h-2.3V6.6Zm2 1.7v4.8h.3c1.3 0 2.1-1 2.1-2.4 0-1.4-.8-2.4-2.1-2.4h-.3Z"
      />
    </svg>
  );
}

/** Lovable — the heart. */
export function LovableMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#1A1A1A" />
      <path
        fill="#F26B5E"
        d="M12 17.4s-6-3.4-6-7.2A3.4 3.4 0 0 1 12 8.4a3.4 3.4 0 0 1 6 1.8c0 3.8-6 7.2-6 7.2Z"
      />
    </svg>
  );
}

/** Bolt — the bolt. */
export function BoltMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? MARK} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#1A1A1A" />
      <path
        fill="#F5C518"
        d="M13.6 5 7.4 13.2h3.8L10.4 19l6.2-8.2h-3.8L13.6 5Z"
      />
    </svg>
  );
}
