import { useState } from "react";
import { format } from "date-fns";
import { User, Mail, Globe, Crown, MessageSquare, Zap, Clock, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  useGetMyProfile,
  useUpdateMyProfile,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const NEWSLETTER_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "off", label: "Off" },
];

const settingsSchema = z.object({
  timezone: z.string().min(1),
  newsletterCadence: z.string().min(1),
  phone: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function AccountPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      timezone: profile?.timezone ?? "America/New_York",
      newsletterCadence: profile?.newsletterCadence ?? "weekly",
    },
  });

  const onEdit = () => {
    if (profile) {
      form.reset({
        timezone: profile.timezone,
        newsletterCadence: profile.newsletterCadence,
        phone: "",
      });
    }
    setIsEditing(true);
  };

  const onSubmit = async (data: SettingsValues) => {
    try {
      const payload: SettingsValues = {
        timezone: data.timezone,
        newsletterCadence: data.newsletterCadence,
        ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
      };
      await updateProfile.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast({ title: "Settings saved" });
      setIsEditing(false);
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

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

  const messageUsagePercent =
    profile.dailyMessageCap > 0
      ? Math.min(100, Math.round((profile.dailyMessageCount / profile.dailyMessageCap) * 100))
      : 0;

  const tokenUsagePercent =
    profile.monthlyTokenAllowance > 0
      ? Math.min(
          100,
          Math.round((profile.monthlyTokenCount / profile.monthlyTokenAllowance) * 100)
        )
      : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-serif font-bold tracking-tight"
            data-testid="heading-account"
          >
            Account Settings
          </h1>
          <p className="text-muted-foreground mt-2">Manage your profile and subscription.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile & settings card */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle className="font-serif flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile &amp; Settings
              </CardTitle>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  data-testid="button-edit-settings"
                >
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email — always read-only */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </p>
                <p className="font-medium" data-testid="profile-email">
                  {profile.email}
                </p>
              </div>

              <Separator />

              {/* WhatsApp / phone */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> WhatsApp Number
                </p>
                {profile.phoneHash ? (
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Phone linked — click Edit to update it.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Not linked — click Edit and enter your WhatsApp number so the AI can recognise you.
                  </p>
                )}
              </div>

              <Separator />

              {isEditing ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="h-4 w-4" /> Timezone
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIMEZONES.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Controls when daily prompts arrive.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> WhatsApp Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+14168287891"
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter your number in international format (e.g. +14168287891). This links your WhatsApp to your account so the AI can reply to you.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="newsletterCadence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Newsletter Cadence</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-newsletter-cadence">
                                <SelectValue placeholder="Select cadence" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NEWSLETTER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            How often you receive your AI-generated progress newsletter.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updateProfile.isPending}
                        data-testid="button-save-settings"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {updateProfile.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Timezone
                    </p>
                    <p className="font-medium" data-testid="profile-timezone">
                      {profile.timezone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Used for daily check-in timing.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Newsletter
                    </p>
                    <p className="font-medium" data-testid="profile-newsletter">
                      {NEWSLETTER_OPTIONS.find((o) => o.value === profile.newsletterCadence)?.label ??
                        profile.newsletterCadence}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Member Since
                    </p>
                    <p className="font-medium" data-testid="profile-created">
                      {format(new Date(profile.createdAt), "MMMM d, yyyy")}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Subscription & usage */}
          <div className="space-y-6">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Subscription
                  </div>
                  <Badge
                    variant={profile.tier === "free" ? "secondary" : "default"}
                    className="uppercase tracking-wider"
                    data-testid="badge-tier"
                  >
                    {profile.tier} Plan
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" /> Daily Messages
                    </span>
                    <span className="font-medium">
                      {profile.dailyMessageCount} / {profile.dailyMessageCap}
                    </span>
                  </div>
                  <Progress
                    value={messageUsagePercent}
                    className="h-2"
                    data-testid="progress-daily-messages"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    Resets at midnight in your timezone
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="h-4 w-4" /> Monthly Tokens
                    </span>
                    <span className="font-medium">
                      {profile.monthlyTokenCount.toLocaleString()} /{" "}
                      {profile.monthlyTokenAllowance.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={tokenUsagePercent}
                    className="h-2"
                    data-testid="progress-monthly-tokens"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    Used for AI processing and analysis
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm bg-muted/20">
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Free plan</span>
                  <span className="font-medium">5 msg/day · 50K tokens/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Pro — $12/mo</span>
                  <span className="font-medium">50 msg/day · 500K tokens/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Elite — $29/mo</span>
                  <span className="font-medium">Unlimited · 2M tokens/mo</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
