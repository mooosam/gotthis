import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

export default function WhatsAppAuthPage({ code }: { code: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const started = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || started.current) return;

    // WhatsApp often opens links in a browser that has no existing GotThis
    // session. In that case, use the normal Clerk sign-in flow instead of trying
    // to manufacture a session from a one-time ticket. After sign-in, Clerk sends
    // the user back to this short-link route and we finish opening the dashboard.
    if (!isSignedIn) {
      started.current = true;
      const returnTo = `/go/${encodeURIComponent(code)}`;
      setLocation(`/sign-in?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }

    started.current = true;

    const openLink = async () => {
      try {
        const response = await apiFetch(`/api/auth-links/${encodeURIComponent(code)}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as
          | { destination?: string; error?: string }
          | null;

        if (!response.ok || !payload?.destination) {
          throw new Error(payload?.error ?? "This link is no longer available.");
        }

        // The browser is now authenticated through the normal GotThis sign-in
        // flow, so no Clerk ticket/finalize step is required. Consume the short
        // link only immediately before navigating to its validated destination.
        const consumeResponse = await apiFetch(`/api/auth-links/${encodeURIComponent(code)}/consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!consumeResponse.ok) {
          const consumePayload = (await consumeResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(consumePayload?.error ?? "Could not finish opening this link.");
        }

        if (payload.destination.startsWith("http://") || payload.destination.startsWith("https://")) {
          window.location.href = payload.destination;
        } else {
          setLocation(payload.destination);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not open this link.");
      }
    };

    void openLink();
  }, [code, isLoaded, isSignedIn, setLocation]);

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center shadow-sm">
        {errorMessage ? (
          <>
            <h1 className="text-xl font-semibold text-[#111827]">This link can’t be opened</h1>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">{errorMessage}</p>
            <p className="mt-4 text-xs leading-5 text-[#9CA3AF]">
              Go back to WhatsApp and ask GotThis for a new dashboard link.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" />
            <h1 className="mt-5 text-xl font-semibold text-[#111827]">Opening GotThis…</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              {isLoaded && !isSignedIn
                ? "Taking you to sign in first."
                : "Taking you to your dashboard."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
