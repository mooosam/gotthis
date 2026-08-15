import { useEffect, useRef, useState } from "react";
import { useSignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

export default function WhatsAppAuthPage({ code }: { code: string }) {
  const { signIn } = useSignIn();
  const [, setLocation] = useLocation();
  const started = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const redeem = async () => {
      try {
        const response = await apiFetch(`/api/auth-links/${encodeURIComponent(code)}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as
          | { ticket?: string; destination?: string; error?: string }
          | null;

        if (!response.ok || !payload?.ticket || !payload.destination) {
          throw new Error(payload?.error ?? "This link is no longer available.");
        }

        const { error } = await signIn.ticket({ ticket: payload.ticket });
        if (error) throw new Error("Could not sign you in from this link.");

        if (signIn.status !== "complete") {
          throw new Error("Could not complete sign-in from this link.");
        }

        const destination = payload.destination;
        const finalizeResult = await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl(destination);
            if (url.startsWith("http://") || url.startsWith("https://")) {
              window.location.href = url;
            } else {
              setLocation(url);
            }
          },
        });

        if (finalizeResult.error) {
          throw new Error("Could not activate your GotThis session.");
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not open this link.");
      }
    };

    void redeem();
  }, [code, setLocation, signIn]);

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
            <p className="mt-2 text-sm text-[#6B7280]">Signing you in securely and taking you to your page.</p>
          </>
        )}
      </div>
    </main>
  );
}
