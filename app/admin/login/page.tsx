import { redirect } from "next/navigation";

/**
 * Retired in favour of the single shared /login page.
 *
 * Kept as a redirect so existing links and bookmarks to the old admin login
 * still land somewhere sensible.
 */
export default function AdminLoginRedirect() {
  redirect("/login?callbackUrl=/admin/dashboard");
}
