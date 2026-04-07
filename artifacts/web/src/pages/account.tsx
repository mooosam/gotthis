import { useGetMyProfile } from "@workspace/api-client-react";
import { format } from "date-fns";
import { User, Mail, Globe, Crown, MessageSquare, Zap, Clock } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function AccountPage() {
  const { data: profile, isLoading } = useGetMyProfile();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-lg" />
            <Skeleton className="h-[300px] rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Failed to load profile.</p>
        </div>
      </AppLayout>
    );
  }

  const messageUsagePercent = profile.dailyMessageCap > 0 
    ? Math.min(100, Math.round((profile.dailyMessageCount / profile.dailyMessageCap) * 100)) 
    : 0;
    
  const tokenUsagePercent = profile.monthlyTokenAllowance > 0 
    ? Math.min(100, Math.round((profile.monthlyTokenCount / profile.monthlyTokenAllowance) * 100)) 
    : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight" data-testid="heading-account">Account Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your profile and subscription.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </p>
                <p className="font-medium" data-testid="profile-email">{profile.email}</p>
              </div>
              
              <Separator />
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Timezone
                </p>
                <p className="font-medium" data-testid="profile-timezone">{profile.timezone}</p>
                <p className="text-xs text-muted-foreground">Used for daily check-in timing.</p>
              </div>

              <Separator />
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Member Since
                </p>
                <p className="font-medium" data-testid="profile-created">
                  {format(new Date(profile.createdAt), 'MMMM d, yyyy')}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Subscription
                  </div>
                  <Badge variant={profile.tier === 'free' ? 'secondary' : 'default'} className="uppercase tracking-wider">
                    {profile.tier} Plan
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><MessageSquare className="h-4 w-4" /> Daily Messages</span>
                    <span className="font-medium">{profile.dailyMessageCount} / {profile.dailyMessageCap}</span>
                  </div>
                  <Progress value={messageUsagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">Resets at midnight in your timezone</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Zap className="h-4 w-4" /> Monthly Tokens</span>
                    <span className="font-medium">{profile.monthlyTokenCount.toLocaleString()} / {profile.monthlyTokenAllowance.toLocaleString()}</span>
                  </div>
                  <Progress value={tokenUsagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">Used for AI processing and analysis</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm bg-muted/20">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">Need to update your phone number, timezone, or subscription?</p>
                <p className="text-xs italic">Settings editing is currently available via the WhatsApp interface. Send "settings" to your AI coach.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
