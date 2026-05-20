import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMyProfile, useListGoals } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { LogOut, Settings, Menu, Moon, Sun, Shield } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS: Record<string, string> = {
  fitness:      "#22C55E",
  health:       "#22C55E",
  wellness:     "#22C55E",
  writing:      "#3B82F6",
  work:         "#3B82F6",
  career:       "#3B82F6",
  productivity: "#3B82F6",
  reading:      "#EAB308",
  learning:     "#EAB308",
  education:    "#EAB308",
  finance:      "#F97316",
  money:        "#F97316",
  mindfulness:  "#A855F7",
  meditation:   "#A855F7",
  social:       "#EC4899",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "#94A3B8";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetMyProfile();
  const isAdminPage = location.startsWith("/admin");

  useEffect(() => {
    if (!isLoading && profile && !profile.onboardingCompleted && !isAdminPage) {
      setLocation("/onboarding");
    }
  }, [profile, isLoading, setLocation, isAdminPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAFAFA] dark:bg-background">
      <Sidebar
        className="hidden md:flex w-52 flex-col border-r border-[#EBEBEB] dark:border-border bg-white dark:bg-sidebar"
        isAdmin={profile?.isAdmin === true}
        whatsappConnected={!!profile?.whatsappNumber}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav isAdmin={profile?.isAdmin === true} />
        <main className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  className,
  isAdmin,
  whatsappConnected,
}: {
  className?: string;
  isAdmin: boolean;
  whatsappConnected: boolean;
}) {
  const [location] = useLocation();
  const { data: goalsData } = useListGoals();

  const navItems = [
    { href: "/dashboard",                                              label: "Dashboard" },
    { href: "/goals",                                                  label: "Goals"     },
    { href: `/review/${new Date().toISOString().split("T")[0]}`,       label: "Review"    },
    { href: "/whatsapp",                                               label: "WhatsApp"  },
    { href: "/account",                                                label: "Settings"  },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const categories = Array.from(
    new Map(
      (goalsData?.goals ?? [])
        .filter((g) => g.status === "active" && g.category)
        .map((g) => [g.category.toLowerCase(), g.category])
    ).values()
  ).slice(0, 6);

  return (
    <div className={className} style={{ userSelect: "none" }}>
      <div className="px-5 pt-7 pb-3">
        <ProfileButton whatsappConnected={whatsappConnected} />
      </div>

      <nav className="flex-1 px-3 mt-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href.startsWith("/review/") && location.startsWith("/review/")) ||
            (item.href === "/admin" && location.startsWith("/admin"));
          return (
            <Link key={item.href} href={item.href}>
              <div
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg mb-[2px] cursor-pointer transition-colors"
                style={{
                  fontWeight:  isActive ? 600 : 400,
                  fontSize:    14,
                  color:       isActive ? "var(--sidebar-active-text, #111827)" : "#6B7280",
                  background:  isActive ? "#F3F4F6"                             : "transparent",
                }}
              >
                <span
                  style={{
                    width:        6,
                    height:       6,
                    borderRadius: 1.5,
                    background:   isActive ? "#111827" : "#D1D5DB",
                    flexShrink:   0,
                    display:      "inline-block",
                  }}
                />
                {item.label}
              </div>
            </Link>
          );
        })}

        {categories.length > 0 && (
          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <div
              style={{
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: "0.1em",
                color:         "#9CA3AF",
                padding:       "0 10px",
                marginBottom:  8,
                textTransform: "uppercase",
              }}
            >
              Goals
            </div>
            {categories.map((cat) => (
              <Link key={cat} href="/goals">
                <div
                  className="flex items-center gap-2.5 px-2.5 py-[5px] rounded-lg mb-[2px] cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-sidebar-accent"
                  style={{ fontSize: 13, color: "#6B7280" }}
                >
                  <span
                    style={{
                      width:        7,
                      height:       7,
                      borderRadius: "50%",
                      background:   getCategoryColor(cat),
                      flexShrink:   0,
                      display:      "inline-block",
                    }}
                  />
                  <span style={{ textTransform: "capitalize" }}>{cat}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}

function ProfileButton({ whatsappConnected }: { whatsappConnected: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const initials = user.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : user.primaryEmailAddress?.emailAddress?.substring(0, 2).toUpperCase() ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu-trigger"
          className="w-full text-left focus:outline-none group"
        >
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 rounded-full flex-shrink-0">
              <AvatarImage src={user.imageUrl} />
              <AvatarFallback className="rounded-full bg-[#1C1C1E] text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              className="font-semibold truncate"
              style={{ fontSize: 14, color: "#111827", maxWidth: 120 }}
            >
              {user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 pl-[42px]">
            <span
              style={{
                width:        7,
                height:       7,
                borderRadius: "50%",
                background:   whatsappConnected ? "#22C55E" : "#D1D5DB",
                display:      "inline-block",
                flexShrink:   0,
              }}
            />
            <span
              style={{
                fontSize:   12,
                fontWeight: 500,
                color:      whatsappConnected ? "#16A34A" : "#9CA3AF",
              }}
            >
              {whatsappConnected ? "Connected" : "Not connected"}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-52" data-testid="user-menu-content">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {user.primaryEmailAddress?.emailAddress}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLocation("/account")}
          className="cursor-pointer"
          data-testid="user-menu-account"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="cursor-pointer"
          data-testid="user-menu-theme"
        >
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="user-menu-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-[#EBEBEB] dark:border-border bg-white dark:bg-sidebar">
      <span className="text-base font-semibold tracking-tight" style={{ color: "#111827" }}>Paceify</span>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-52 p-0 bg-white dark:bg-sidebar border-r border-[#EBEBEB] dark:border-border">
          <Sidebar className="flex h-full flex-col" isAdmin={isAdmin} whatsappConnected={false} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
