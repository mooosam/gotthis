import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, CheckCircle2, RefreshCw, Unlink } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type WAStatus = "connected" | "connecting" | "disconnected";

interface QRResponse {
  status: WAStatus;
  qr?: string | null;
  hasQR?: boolean;
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WAStatus>("connecting");
  const [qrRaw, setQrRaw] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/qr");
      if (res.status === 403) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch QR");
      setIsAdmin(true);
      const data = (await res.json()) as QRResponse;

      if (data.status === "connected") {
        setStatus("connected");
        setQrRaw(null);
      } else {
        setStatus("connecting");
        setQrRaw(data.qr ?? null);
      }
    } catch {
      setStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQR();
    const interval = setInterval(() => {
      void fetchQR();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchQR]);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setStatus("connecting");
      setQrRaw(null);
      toast({ title: "WhatsApp disconnected", description: "A new QR code will appear shortly." });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

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
            Connect your WhatsApp to receive morning rituals and submit progress updates by message.
          </p>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              {status === "connected" ? "Connected" : "Scan to Connect"}
            </CardTitle>
            <CardDescription>
              {status === "connected"
                ? "Your WhatsApp is linked. Send any message to start your ritual."
                : "Open WhatsApp on your phone, go to Settings > Linked Devices > Link a Device, then scan the code below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Skeleton className="h-52 w-52 rounded-lg" />
              </div>
            ) : status === "connected" ? (
              <div className="flex flex-col items-center gap-6 py-8">
                <div className="rounded-full bg-primary/10 p-6">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                <p className="text-center text-sm text-muted-foreground leading-relaxed max-w-sm">
                  WhatsApp is active. You can now send messages directly to your coaching number
                  and the AI will respond.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : qrRaw ? (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="rounded-xl border border-border p-4 bg-white">
                  <QRCodeSVG value={qrRaw} size={208} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  QR code refreshes automatically. Scan it before it expires.
                </p>
                <Button variant="ghost" size="sm" onClick={() => void fetchQR()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12">
                <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Waiting for QR code...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>1. Make sure your phone number is saved in your account settings.</p>
            <p>2. Scan the QR code with WhatsApp on your phone.</p>
            <p>3. Send any message to trigger a check-in, or say "good morning" for your morning ritual.</p>
            <p>4. At the end of the day, say "wrapping up" or "evening review" to log your progress.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
