"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  ClipboardCheck,
  Code,
  CreditCard,
  Eye,
  FileText,
  Globe,
  Home,
  Layers,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/marketplace/app-shell";
import { BrandLoader } from "@/components/brand-loader";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * The admin is a set of places in the same column.
 *
 * It used to be a second application: its own sidebar primitive, its own
 * header, its own spacing, a different accent, and a different idea of what a
 * page looks like. An administrator moving between the marketplace and the
 * panel should be moving between two rooms of the same building — the same
 * rail, the same panel, the same palette, the same account menu at the foot.
 *
 * So the admin is now the marketplace's shell with a different set of places
 * in it, and the rail that carries them is the same rail.
 */
const ADMIN_NAV: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: Home },
  { title: "Review queue", href: "/admin/review", icon: ClipboardCheck },
  { title: "Submissions", href: "/admin/submissions", icon: FileText },
  { title: "Components", href: "/admin/components", icon: Code },
  { title: "Vibe components", href: "/admin/vibe-components", icon: Layers },
  { title: "Websites", href: "/admin/websites", icon: Globe },
  { title: "Templates", href: "/admin/templates", icon: Code },
  { title: "Payouts", href: "/admin/payouts", icon: CreditCard },
  { title: "AI models", href: "/admin/ai-models", icon: Sparkles },
  { title: "Library", href: "/docs", icon: Eye },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();

  // The session is still being read: the panel is not drawn on a guess.
  if (status === "loading" || !session) {
    return (
      <BrandLoader
        className="min-h-dvh"
        label={status === "loading" ? "Loading" : "Authenticating"}
      />
    );
  }

  return (
    <AppShell
      nav={ADMIN_NAV}
      toolbar={
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Admin
          </p>
          <p className="truncate text-sm font-semibold tracking-tight">
            {session.user.name || session.user.email}
          </p>
        </div>
      }
    >
      <div className="space-y-6 p-4 lg:p-6">{children}</div>
    </AppShell>
  );
}
