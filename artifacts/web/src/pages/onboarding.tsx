import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCompleteOnboarding, useUpdateMyProfile, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const onboardingSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
  phone: z.string().optional(),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland"
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const completeOnboarding = useCompleteOnboarding();

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      phone: "",
    },
  });

  useEffect(() => {
    if (!isLoading && profile?.onboardingCompleted) {
      setLocation("/dashboard");
    }
  }, [profile, isLoading, setLocation]);

  const onSubmit = async (data: OnboardingValues) => {
    try {
      await updateProfile.mutateAsync({
        data: {
          timezone: data.timezone,
          ...(data.phone ? { phone: data.phone } : {}),
        }
      });
      
      await completeOnboarding.mutateAsync();
      
      queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      
      toast({
        title: "Setup complete",
        description: "Welcome to The Ritual.",
      });
      
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || profile?.onboardingCompleted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/40 shadow-sm">
        <CardHeader className="space-y-3 pb-6">
          <CardTitle className="font-serif text-3xl font-bold">Set up your Ritual</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Configure how your AI coach interacts with you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue placeholder="Select a timezone" />
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
                    <FormDescription>
                      Determines when your daily prompts arrive.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+1234567890" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormDescription>
                      For the WhatsApp integration. If left blank, you can use the web dashboard only.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={updateProfile.isPending || completeOnboarding.isPending}
                data-testid="button-complete-onboarding"
              >
                {(updateProfile.isPending || completeOnboarding.isPending) ? "Saving..." : "Begin"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
