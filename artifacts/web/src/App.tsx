import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { setTokenGetter } from "./lib/api";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import PricingPage from "@/pages/pricing";
import FaqPage from "@/pages/faq";
import ContactPage from "@/pages/contact";
import TermsPage from "@/pages/terms";
import CookiesPage from "@/pages/cookies";
import DataPolicyPage from "@/pages/data-policy";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import GoalsPage from "@/pages/goals";
import GoalDetailPage from "@/pages/goal-detail";
import ReviewPage from "@/pages/review";
import AccountPage from "@/pages/account";
import WhatsAppPage from "@/pages/whatsapp";
import SharePage from "@/pages/share";
import AdminOverviewPage from "@/pages/admin";
import AdminUsersPage from "@/pages/admin/users";
import AdminUserDetailPage from "@/pages/admin/user-detail";
import AdminPlansPage from "@/pages/admin/plans";
import AdminStripePage from "@/pages/admin/stripe";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function SignInPage() {
  return (
    <div className="flex justify-center mt-8">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex justify-center mt-8">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
      />
    </div>
  );
}

function ClerkAuthSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    const getter = () => getToken();
    setAuthTokenGetter(getter);
    setTokenGetter(getter);
    return () => {
      setAuthTokenGetter(null);
      setTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomePage() {
  const { isSignedIn, isLoaded } = useUser();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <LandingPage />;
}

/**
 * Wraps admin-only routes. Fetches the user from our own API (not Clerk)
 * because isAdmin lives in our DB, not in the Clerk session.
 * Redirects non-admins to "/" silently — the API enforces this too, but
 * this prevents the page shell from rendering for a regular signed-in user.
 */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    import("./lib/api").then(({ apiFetch }) =>
      apiFetch("/api/users/me")
        .then((r) => r.json())
        .then((u: { isAdmin?: boolean }) => setIsAdmin(u.isAdmin === true))
        .catch(() => setIsAdmin(false)),
    );
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return <Redirect to="/" />;
  if (isAdmin === null) return null; // loading — render nothing briefly
  if (!isAdmin) return <Redirect to="/" />;
  return <>{children}</>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthSetup />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          {/* Public marketing pages */}
          <Route path="/" component={HomePage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/faq" component={FaqPage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/cookies" component={CookiesPage} />
          <Route path="/data-policy" component={DataPolicyPage} />

          {/* Auth */}
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          {/* App (authenticated) */}
          <Route path="/onboarding">
            <Show when="signed-in"><OnboardingPage /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/dashboard">
            <Show when="signed-in"><DashboardPage /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/goals">
            <Show when="signed-in"><GoalsPage /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/goal/:goalId">
            {(params) => (
              <>
                <Show when="signed-in"><GoalDetailPage id={params.goalId} /></Show>
                <Show when="signed-out"><Redirect to="/" /></Show>
              </>
            )}
          </Route>

          <Route path="/review/:date">
            {(params) => (
              <>
                <Show when="signed-in"><ReviewPage date={params.date} /></Show>
                <Show when="signed-out"><Redirect to="/" /></Show>
              </>
            )}
          </Route>

          <Route path="/account">
            <Show when="signed-in"><AccountPage /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/whatsapp">
            <Show when="signed-in"><WhatsAppPage /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/share/:token">
            {(params) => <SharePage token={params.token} />}
          </Route>

          <Route path="/admin">
            <AdminGuard><AdminOverviewPage /></AdminGuard>
          </Route>

          <Route path="/admin/users">
            <AdminGuard><AdminUsersPage /></AdminGuard>
          </Route>

          <Route path="/admin/users/:id">
            {(params) => (
              <AdminGuard><AdminUserDetailPage id={params.id} /></AdminGuard>
            )}
          </Route>

          <Route path="/admin/plans">
            <AdminGuard><AdminPlansPage /></AdminGuard>
          </Route>

          <Route path="/admin/stripe">
            <AdminGuard><AdminStripePage /></AdminGuard>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
