import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import GoalsPage from "@/pages/goals";
import GoalDetailPage from "@/pages/goal-detail";
import ReviewPage from "@/pages/review";
import AccountPage from "@/pages/account";
import WhatsAppPage from "@/pages/whatsapp";

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
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex justify-center mt-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
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

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
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
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          
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
          
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
