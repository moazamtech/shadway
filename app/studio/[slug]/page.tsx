import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin as sessionIsAdmin } from "@/lib/session";
import { getComponentBySlugAnyStatus } from "@/lib/db/components";
import { ComponentStudio } from "@/components/studio/component-studio";
import {
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_CODE,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_CODE,
  DEFAULT_STYLE_PATH,
  storedProjectPath,
} from "@/lib/studio/starter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio | Shadway",
  robots: { index: false, follow: false },
};

/**
 * The editor for one project.
 *
 * Owners (and admins) open drafts and published components here; the studio
 * keeps working on the draft version of a published component until Publish
 * is pressed again.
 */
export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=/studio/${slug}`);
  }
  if (!process.env.MONGODB_URI) {
    notFound();
  }

  const component = await getComponentBySlugAnyStatus(slug);
  if (!component) {
    notFound();
  }

  const isOwner = component.author.userId === session.user.id;
  const isAdmin = sessionIsAdmin(session);
  if (!isOwner && !isAdmin) {
    notFound();
  }

  const files: Record<string, string> = {};
  for (const file of component.files ?? []) {
    if (!file?.content) continue;
    files[storedProjectPath(file.path)] = file.content;
  }
  files[DEFAULT_COMPONENT_PATH] = component.code;
  files[DEFAULT_DEMO_PATH] = component.demoCode?.trim()
    ? component.demoCode
    : DEFAULT_DEMO_CODE;
  files[DEFAULT_STYLE_PATH] = component.styleCode?.trim()
    ? component.styleCode
    : DEFAULT_STYLE_CODE;

  return (
    <ComponentStudio
      slug={component.slug}
      initial={{
        title: component.title,
        description: component.description || "",
        tags: component.tags ?? [],
        category: component.category || "ui",
        visibility: component.visibility === "unlisted" ? "unlisted" : "public",
        status: component.status,
        files,
        dependencies: component.dependencies ?? [],
      }}
    />
  );
}
