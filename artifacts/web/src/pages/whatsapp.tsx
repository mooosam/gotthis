import { useState, useEffect, useCallback } from "react";
import { Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type WAStatus = "open" | "disconnected";

interface StatusResponse {
  status: WAStatus;
  connectedPhone?: string | null;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WAStatus>("disconnected");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/whatsapp/status");
      if (res.status === 403) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch status");
      setIsAdmin(true);
      const data = (await res.json()) as StatusResponse;
      setStatus(data.status);
      setConnectedPhone(data.connectedPhone ?? null);
    } catch {
      setStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  if (isAdmin === false) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-xl">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">WhatsApp</h1>
          <Card className="border-border/40 shadow-sm">
            <CardContent className="py-12 text-center">
              <Smartphone className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">
                WhatsApp management is restricted to the app administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-xl">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">
            WhatsApp
          </h1>
          <p className="text-muted-foreground mt-2">
            Powered by the official WhatsApp Business Cloud API.
          </p>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              {status === "open" ? "Connected" : "Not configured"}
            </CardTitle>
            <CardDescription>
              {status === "open"
                ? "Your Cloud API credentials are configured and the webhook is live."
                : "Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN in your environment to connect."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : status === "open" ? (
              <div className="flex flex-col items-center gap-6 py-6">
                <div className="rounded-full bg-primary/10 p-6">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                {connectedPhone && (
                  <div className="w-full rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-center space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Bot phone number
                    </p>
                    <p className="text-lg font-mono font-semibold text-foreground">
                      {connectedPhone}
                    </p>
                  </div>
                )}
                <p className="text-center text-sm text-muted-foreground leading-relaxed max-w-sm">
                  Users link their own phone number in Account Settings, then message the number
                  above to start chatting with the AI.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <XCircle className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  Not connected yet. Configure the Cloud API environment variables on the server,
                  then set the webhook Callback URL and Verify Token in the Meta App dashboard.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>1. Sign up and save your phone number in Account Settings.</p>
            <p>2. Message the bot number above — say "good morning" to start your ritual.</p>
            <p>3. In the evening, say "wrapping up" or "evening review" to log your progress.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
