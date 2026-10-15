import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | Shadway",
  description:
    "Sign in to your Shadway account to publish and manage shadcn/ui components and bundles.",
  robots: { index: false, follow: false },
};

/** Keep the post-auth redirect on-site so callbackUrl cannot become an open redirect. */
function safeCallback(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const registerHref = callbackUrl
    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/register";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to publish components, manage bundles and keep your work in one place."
      footer={
        <>
          New to Shadway?{" "}
          <Link
            href={registerHref}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
