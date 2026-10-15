import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account | Shadway",
  description:
    "Create a free Shadway account to publish shadcn/ui components, build bundles and showcase your work.",
  robots: { index: false, follow: false },
};

/** Keep the post-auth redirect on-site so callbackUrl cannot become an open redirect. */
function safeCallback(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the marketplace to publish components, build bundles and showcase your work."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
