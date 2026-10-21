import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { AccountForm } from "@/components/settings/account-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PayoutsPanel } from "@/components/settings/payouts-panel";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ensureUsername, resolveProfile } from "@/lib/db/users";
import { sessionUsername } from "@/lib/session";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { ShellToolbar } from "@/components/marketplace/shell-toolbar";

export const dynamic = "force-dynamic";

/**
 * The sections of the page, in the order they are read.
 *
 * The order is the reader's, not the code's: who you are, then what the
 * world sees, then what you get paid.
 */
const SECTIONS = [
  {
    id: "account",
    title: "Account",
    description: "Your name and your sign-in.",
  },
  {
    id: "profile",
    title: "Public profile",
    description: "What other people see.",
  },
  {
    id: "payouts",
    title: "Payouts",
    description: "Where your earnings go.",
  },
] as const;

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  const email = session.user.email;
  const handle =
    (email ? await ensureUsername(email).catch(() => null) : null) ??
    sessionUsername(session);

  /**
   * The public half of the account, read through the same `resolveProfile` the
   * profile page uses — so the values this form pre-fills are the ones a
   * visitor would actually see, and the handle here is the handle the profile
   * resolves on. Caught for the same reason `ensureUsername` above is: a
   * checkout without a database must still be able to render settings.
   */
  const profile = await resolveProfile(handle).catch(() => null);

  /**
   * Read on the server so the picker can be disabled with a sentence attached
   * instead of letting somebody choose a photo and only then failing. The
   * endpoint checks this again; neither side trusts the other to have done it.
   */
  const uploadsEnabled = isCloudinaryConfigured();

  return (
    <>
      <ShellToolbar>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/u/${handle}`}>Public profile</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/u/${handle}?tab=saved`}>Saved</Link>
          </Button>
        </div>
      </ShellToolbar>

      <div className="mx-auto w-full max-w-5xl px-3 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your public handle is{" "}
            <Link
              href={`/u/${handle}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              @{handle}
            </Link>
            . Changes apply immediately.
          </p>
        </div>

        {/*
          Two columns: what can be changed on the left, the thing itself on
          the right. The forms stay where they were — a profile form that
          unmounts when you change a section is a form that loses what you
          typed in it.
        */}
        <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
          <SettingsNav sections={SECTIONS.map((section) => ({ ...section }))} />

          <div className="space-y-8">
            <section id="account" className="scroll-mt-6 space-y-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Account
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Your name and your sign-in.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-5">
                <AccountForm
                  initialName={session.user.name || ""}
                  email={session.user.email}
                />
              </div>
            </section>

            <section id="profile" className="scroll-mt-6 space-y-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Public profile
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  What other people see when they come to your page.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-5">
                <ProfileForm
                  name={profile?.name || session.user.name || ""}
                  handle={handle}
                  avatar={profile?.avatar ?? ""}
                  bio={profile?.bio ?? ""}
                  website={profile?.website ?? ""}
                  twitter={profile?.twitter ?? ""}
                  github={profile?.github ?? ""}
                  uploadsEnabled={uploadsEnabled}
                />
              </div>
            </section>

            <section id="payouts" className="scroll-mt-6 space-y-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Payouts
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Where your earnings go, and when they are sent.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-5">
                <PayoutsPanel />
              </div>
            </section>

            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <SettingsIcon className="h-3.5 w-3.5" />
              <ShieldCheck className="h-3.5 w-3.5" />
              Account managed by Shadway. Sessions expire after 24 hours.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
