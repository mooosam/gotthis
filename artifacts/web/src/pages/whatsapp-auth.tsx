import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

type LinkKind = "account" | "claim";

export default function WhatsAppAuthPage({ code }: { code: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const started = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Checking your secure link…");

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;

    const returnTo = `/go/${encodeURIComponent(code)}`;

    const navigate = (destination: string) => {
      if (destination.startsWith("http://") || destination.startsWith("https://")) {
        window.location.href = destination;
      } else {
        setLocation(destination);
      }
    };

    const openLink = async () => {
      try {
        const statusResponse = await apiFetch(`/api/auth-links/${encodeURIComponent(code)}/status`);
        const statusPayload = (await statusResponse.json().catch(() => null)) as
          | { kind?: LinkKind; error?: string }
          | null;

        if (!statusResponse.ok || !statusPayload?.kind) {
          throw new Error(statusPayload?.error ?? "This link is no longer available.");
        }

        if (!isSignedIn) {
          setStatusText(
            statusPayload.kind === "claim"
              ? "Taking you to create your GotThis account…"
              : "Taking you to sign in…",
          );
          const authPath = statusPayload.kind === "claim" ? "/sign-up" : "/sign-in";
          setLocation(`${authPath}?redirect=${encodeURIComponent(returnTo)}`);
          return;
        }

        if (statusPayload.kind === "claim") {
          setStatusText("Connecting your WhatsApp number to your account…");
          const claimResponse = await apiFetch(`/api/auth-links/${encodeURIComponent(code)}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const claimPayload = (await claimResponse.json().catch(() => null)) as
            | { destination?: string; error?: string }
            | null;

          if (!claimResponse.ok || !claimPayload?.destination) {
            throw new Error(claimPayload?.error ?? "Could not connect this WhatsApp number.");
          }

          navigate(claimPayload.destination);
          return;
        }

        setStatusText("Opening your GotThis dashboard…");
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

        navigate(payload.destination);
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
              Go back to WhatsApp and ask GotThis for a new link.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" />
            <h1 className="mt-5 text-xl font-semibold text-[#111827]">Opening GotThis…</h1>
            <p className="mt-2 text-sm text-[#6B7280]">{statusText}</p>
          </>
        )}
      </div>
    </main>
  );
}
