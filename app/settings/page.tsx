import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { AccountForm } from "@/components/settings/account-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ensureUsername, resolveProfile } from "@/lib/db/users";
import { sessionUsername } from "@/lib/session";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/marketplace/app-shell";

export const dynamic = "force-dynamic";

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
   * checkout without `MONGODB_URI` must still be able to render settings.
   */
  const profile = await resolveProfile(handle).catch(() => null);

  /**
   * Read on the server so the picker can be disabled with a sentence attached
   * instead of letting somebody choose a photo and only then failing. The
   * endpoint checks this again; neither side trusts the other to have done it.
   */
  const uploadsEnabled = isCloudinaryConfigured();

  return (
    <AppShell
      toolbar={
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/u/${handle}`}>Public profile</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile">Your work</Link>
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Account settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your public handle is{" "}
            <Link
              href={`/u/${handle}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              @{handle}
            </Link>
            . Update your name, password and public profile below — changes apply
            immediately.
          </p>
        </div>

        <div className="raised rounded-lg border border-border bg-card p-6">
          <AccountForm
            initialName={session.user.name || ""}
            email={session.user.email}
          />
        </div>

        <div className="raised rounded-lg border border-border bg-card p-6">
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SettingsIcon className="h-3.5 w-3.5" />
          <ShieldCheck className="h-3.5 w-3.5" />
          Account managed by Shadway. Sessions expire after 24 hours.
        </div>
      </div>
    </AppShell>
  );
}
