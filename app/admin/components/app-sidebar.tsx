"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import {
  Bell,
  ChevronsUpDown,
  ClipboardCheck,
  CreditCard,
  LogOut,
  Sparkles,
  Globe,
  FileText,
  Settings,
  Home,
  Layers,
  Code,
  Eye,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "Admin",
    email: "admin@shadway.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: Home,
    },
    {
      title: "Websites",
      url: "/admin/websites",
      icon: Globe,
    },
    {
      title: "Templates",
      url: "/admin/templates",
      icon: Code,
    },
    {
      title: "Submissions",
      url: "/admin/submissions",
      icon: FileText,
      badge: true,
    },
    {
      title: "Review Queue",
      url: "/admin/review",
      icon: ClipboardCheck,
    },
    {
      title: "Payouts",
      url: "/admin/payouts",
      icon: CreditCard,
    },
    {
      title: "Components Admin",
      url: "/admin/components",
      icon: Code,
    },
    {
      title: "Vibe Components",
      url: "/admin/vibe-components",
      icon: Layers,
    },
    {
      title: "View Library",
      url: "/docs",
      icon: Eye,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
    },
    {
      title: "AI Model",
      url: "/admin/ai-models",
      icon: Sparkles,
    },
  ],
};

interface AppSidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppSidebar({
  user,
  ...props
}: AppSidebarProps & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/submissions")
      .then((response) => (response.ok ? response.json() : null))
      .then((submissions) => {
        if (cancelled || !Array.isArray(submissions)) return;
        setPendingSubmissions(
          submissions.filter((item: { status?: string }) => item.status === "pending").length
        );
      })
      .catch((error) => {
        console.error("Error fetching pending submissions:", error);
      });

    fetch("/api/admin/review", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.count === "number") setPendingReviews(data.count);
      })
      .catch((error) => {
        console.error("Error fetching pending reviews:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/admin/login" });
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Globe className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">ShadWay</span>
                  <span className="truncate text-xs">Admin Panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                const isActive = pathname === item.url;
                const showBadge =
                  item.url === "/admin/review"
                    ? pendingReviews > 0
                    : item.badge && pendingSubmissions > 0;
                const badgeCount =
                  item.url === "/admin/review" ? pendingReviews : pendingSubmissions;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {showBadge && (
                      <SidebarMenuBadge className="bg-red-500 text-white">
                        {badgeCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user?.image || data.user.avatar}
                      alt={user?.name || data.user.name}
                    />
                    <AvatarFallback className="rounded-lg">
                      {(user?.name || data.user.name)
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name || data.user.name}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email || data.user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user?.image || data.user.avatar}
                        alt={user?.name || data.user.name}
                      />
                      <AvatarFallback className="rounded-lg">
                        {(user?.name || data.user.name)
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "AD"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || data.user.name}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email || data.user.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/dashboard">
                      <Sparkles />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <Settings />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
