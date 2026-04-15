import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Mail, Save, TestTube, Server, Lock, User, Hash, AtSign, Shield, Loader2, Eye, EyeOff,
} from "lucide-react";

interface EmailSettings {
  smtp_host: string | null;
  smtp_port: string | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  smtp_secure: string | null;
}

export default function EmailSettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/email-settings"],
  });

  const [form, setForm] = useState<EmailSettings>({
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from_email: "",
    smtp_from_name: "",
    smtp_secure: "true",
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        smtp_host: settings.smtp_host || "",
        smtp_port: settings.smtp_port || "587",
        smtp_user: settings.smtp_user || "",
        smtp_pass: settings.smtp_pass || "",
        smtp_from_email: settings.smtp_from_email || "",
        smtp_from_name: settings.smtp_from_name || "",
        smtp_secure: settings.smtp_secure ?? "true",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: EmailSettings) => {
      const res = await apiRequest("PUT", "/api/email-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email-settings/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Test Result", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleChange = (key: keyof EmailSettings, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Email Settings</h1>
                <p className="text-sm text-muted-foreground">Configure SMTP server for password reset emails and notifications</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="w-5 h-5 text-muted-foreground" />
                  SMTP Server Configuration
                </CardTitle>
                <CardDescription>
                  Enter your email server details. These settings are used for sending password reset emails and system notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host" className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" />
                      SMTP Host
                    </Label>
                    <Input
                      id="smtp_host"
                      placeholder="smtp.gmail.com"
                      value={form.smtp_host || ""}
                      onChange={(e) => handleChange("smtp_host", e.target.value)}
                      data-testid="input-smtp-host"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port" className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      SMTP Port
                    </Label>
                    <Input
                      id="smtp_port"
                      placeholder="587"
                      value={form.smtp_port || ""}
                      onChange={(e) => handleChange("smtp_port", e.target.value)}
                      data-testid="input-smtp-port"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_user" className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      SMTP Username
                    </Label>
                    <Input
                      id="smtp_user"
                      placeholder="your-email@gmail.com"
                      value={form.smtp_user || ""}
                      onChange={(e) => handleChange("smtp_user", e.target.value)}
                      data-testid="input-smtp-user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_pass" className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      SMTP Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="smtp_pass"
                        type={showSmtpPass ? "text" : "password"}
                        placeholder="App password or SMTP password"
                        value={form.smtp_pass || ""}
                        onChange={(e) => handleChange("smtp_pass", e.target.value)}
                        className="pr-10"
                        data-testid="input-smtp-pass"
                      />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowSmtpPass(v => !v)} tabIndex={-1} data-testid="button-toggle-smtp-pass">
                        {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="smtp_secure"
                    checked={form.smtp_secure === "true"}
                    onCheckedChange={(checked) => handleChange("smtp_secure", checked ? "true" : "false")}
                    data-testid="switch-smtp-secure"
                  />
                  <Label htmlFor="smtp_secure" className="flex items-center gap-1.5 cursor-pointer">
                    <Shield className="w-3.5 h-3.5" />
                    Use TLS/SSL (recommended)
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AtSign className="w-5 h-5 text-muted-foreground" />
                  Sender Information
                </CardTitle>
                <CardDescription>
                  Configure the "From" name and email address that recipients will see.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_from_email" className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      From Email
                    </Label>
                    <Input
                      id="smtp_from_email"
                      placeholder="noreply@viroc.in"
                      value={form.smtp_from_email || ""}
                      onChange={(e) => handleChange("smtp_from_email", e.target.value)}
                      data-testid="input-smtp-from-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_from_name" className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      From Name
                    </Label>
                    <Input
                      id="smtp_from_name"
                      placeholder="VIROC Hospital"
                      value={form.smtp_from_name || ""}
                      onChange={(e) => handleChange("smtp_from_name", e.target.value)}
                      data-testid="input-smtp-from-name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                data-testid="button-test-email"
              >
                {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                data-testid="button-save-email"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
