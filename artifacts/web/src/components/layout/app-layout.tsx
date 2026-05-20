import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { 
  LogOut, 
  Settings, 
  LayoutDashboard, 
  Target, 
  CalendarDays, 
  Menu,
  Moon,
  Sun,
  Smartphone,
  Shield
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetMyProfile();
  const isAdminPage = location.startsWith("/admin");

  useEffect(() => {
    // Don't bounce admins out of the admin section if they happen to not have
    // onboarding finished yet — they're not really "users" of the product flow.
    if (!isLoading && profile && !profile.onboardingCompleted && !isAdminPage) {
      setLocation("/onboarding");
    }
  }, [profile, isLoading, setLocation, isAdminPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar className="hidden md:flex w-64 flex-col border-r bg-sidebar" isAdmin={profile?.isAdmin === true} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav isAdmin={profile?.isAdmin === true} />
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ className, isAdmin }: { className?: string; isAdmin: boolean }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/goals", label: "Goals", icon: Target },
    { href: `/review/${new Date().toISOString().split('T')[0]}`, label: "Today's Review", icon: CalendarDays },
    { href: "/whatsapp", label: "WhatsApp", icon: Smartphone },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className={className}>
      <div className="p-6">
        <h2 className="text-2xl font-serif font-bold tracking-tight text-sidebar-foreground">Paceify</h2>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href.startsWith("/review/") && location.startsWith("/review/")) ||
            (item.href === "/admin" && location.startsWith("/admin"));
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}

function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="flex md:hidden h-16 items-center justify-between px-4 border-b bg-sidebar">
      <h2 className="text-xl font-serif font-bold text-sidebar-foreground">Paceify</h2>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r">
          <Sidebar className="flex h-full flex-col" isAdmin={isAdmin} />
        </SheetContent>
      </Sheet>
    </header>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) return <Skeleton className="h-10 w-full" />;

  const initials = user.primaryEmailAddress?.emailAddress?.substring(0, 2).toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-3 px-2 hover:bg-sidebar-accent" data-testid="user-menu-trigger">
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={user.imageUrl} />
            <AvatarFallback className="rounded-md bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-sm truncate flex-1">
            <span className="font-medium truncate w-full text-left text-sidebar-foreground">{user.fullName || "User"}</span>
            <span className="text-xs text-sidebar-foreground/60 truncate w-full text-left">{user.primaryEmailAddress?.emailAddress}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" data-testid="user-menu-content">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/account")} className="cursor-pointer" data-testid="user-menu-account">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer" data-testid="user-menu-theme">
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          <span>Toggle Theme</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive focus:text-destructive" data-testid="user-menu-logout">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
