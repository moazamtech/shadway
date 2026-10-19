import { BrandLoader } from "@/components/brand-loader";

/**
 * The wait between pages.
 *
 * Every route in the app answers with the same thing while it is thinking:
 * the mark, lit, on a dark stage. It is the one moment the site is not
 * showing content, and it is the moment it should look most like itself.
 */
export default function Loading() {
  return <BrandLoader className="min-h-dvh" />;
}
