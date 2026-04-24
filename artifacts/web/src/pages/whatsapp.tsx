import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, CheckCircle2, RefreshCw, Unlink, Loader2, Hash } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type WAStatus = "connected" | "connecting" | "disconnected";

interface QRResponse {
  status: WAStatus;
  qr?: string | null;
  pairingCode?: string | null;
  connectedPhone?: string | null;
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WAStatus>("connecting");
  const [qrRaw, setQrRaw] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  const qrRef = useRef<string | null>(null);

  const fetchQR = useCallback(async () => {
    try {
      const res = await apiFetch("/api/whatsapp/qr");
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
        setPairingCode(null);
        setConnectedPhone(data.connectedPhone ?? null);
        qrRef.current = null;
      } else {
        setStatus("connecting");
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        }
        if (data.qr && data.qr !== qrRef.current) {
          qrRef.current = data.qr;
          setQrRaw(data.qr);
        } else if (!data.qr) {
          setQrRaw(null);
          qrRef.current = null;
        }
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
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchQR]);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await apiFetch("/api/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setStatus("connecting");
      setQrRaw(null);
      setPairingCode(null);
      qrRef.current = null;
      toast({ title: "WhatsApp disconnected", description: "You can reconnect at any time." });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRequestCode = async () => {
    if (!phone.trim()) return;
    setIsRequestingCode(true);
    setPairingCode(null);
    try {
      const res = await apiFetch("/api/whatsapp/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Could not generate pairing code.", variant: "destructive" });
        return;
      }
      setPairingCode(data.code ?? null);
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsRequestingCode(false);
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
              {status === "connected" ? "Connected" : "Connect WhatsApp"}
            </CardTitle>
            <CardDescription>
              {status === "connected"
                ? "Your WhatsApp is linked. Send any message to start your ritual."
                : "Choose how you want to link your WhatsApp account."}
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
                {connectedPhone && (
                  <div className="w-full rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-center space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Connected phone number
                    </p>
                    <p className="text-lg font-mono font-semibold text-foreground">
                      +{connectedPhone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Go to <strong>Account Settings</strong> and enter this exact number so the AI can recognise you.
                    </p>
                  </div>
                )}
                <p className="text-center text-sm text-muted-foreground leading-relaxed max-w-sm">
                  WhatsApp is active. Message your Saved Messages (tap your own name at the top of your chat list) and the AI will respond.
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
            ) : (
              <Tabs defaultValue="code" className="w-full">
                <TabsList className="w-full mb-6">
                  <TabsTrigger value="code" className="flex-1">
                    <Hash className="mr-2 h-4 w-4" />
                    Phone Number (Recommended)
                  </TabsTrigger>
                  <TabsTrigger value="qr" className="flex-1">
                    <Smartphone className="mr-2 h-4 w-4" />
                    QR Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="code" className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Enter your WhatsApp phone number with country code. WhatsApp will show you an 8-digit code to enter below.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="+447700900000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                        className="flex-1"
                      />
                      <Button onClick={handleRequestCode} disabled={isRequestingCode || !phone.trim()}>
                        {isRequestingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Code"}
                      </Button>
                    </div>
                  </div>

                  {pairingCode && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Your pairing code
                      </p>
                      <p className="text-4xl font-mono font-bold tracking-widest text-foreground">
                        {pairingCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Open WhatsApp on your phone, go to{" "}
                        <strong>Settings &gt; Linked Devices &gt; Link a Device</strong>, then enter this code.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="qr">
                  {qrRaw ? (
                    <div className="flex flex-col items-center gap-6 py-2">
                      <div className="rounded-xl border border-border p-4 bg-white">
                        <QRCodeSVG value={qrRaw} size={208} />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Open WhatsApp, go to Settings &gt; Linked Devices &gt; Link a Device, then scan.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          The code refreshes every 20 seconds — scan it quickly.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => void fetchQR()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">Waiting for QR code...</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>1. Make sure your phone number is saved in your account settings.</p>
            <p>2. Connect using your phone number or QR code above.</p>
            <p>3. Once connected, say "good morning" to start your morning ritual.</p>
            <p>4. In the evening, say "wrapping up" or "evening review" to log your progress.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
