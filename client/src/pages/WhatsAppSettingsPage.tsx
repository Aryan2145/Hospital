import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  MessageSquare, Save, TestTube, Key, Hash, Phone, Shield, Loader2, Send, CheckCircle2, Info, FileText,
} from "lucide-react";

interface WhatsAppSettings {
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  wa_business_account_id: string | null;
  wa_enabled: string | null;
  wa_template_appointment: string | null;
  wa_test_phone: string | null;
}

export default function WhatsAppSettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<WhatsAppSettings>({
    queryKey: ["/api/whatsapp-settings"],
  });

  const [form, setForm] = useState<WhatsAppSettings>({
    wa_phone_number_id: "",
    wa_access_token: "",
    wa_business_account_id: "",
    wa_enabled: "false",
    wa_template_appointment: "",
    wa_test_phone: "",
  });

  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (settings) {
      setForm({
        wa_phone_number_id: settings.wa_phone_number_id || "",
        wa_access_token: settings.wa_access_token || "",
        wa_business_account_id: settings.wa_business_account_id || "",
        wa_enabled: settings.wa_enabled ?? "false",
        wa_template_appointment: settings.wa_template_appointment || "",
        wa_test_phone: settings.wa_test_phone || "",
      });
      setTestPhone(settings.wa_test_phone || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: WhatsAppSettings) => {
      const res = await apiRequest("PUT", "/api/whatsapp-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "WhatsApp settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp-settings/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Connection Successful", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/whatsapp-settings/send-test", { phone });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Test Message Sent", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleChange = (key: keyof WhatsAppSettings, value: string) => {
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
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">WhatsApp Integration</h1>
                <p className="text-sm text-muted-foreground">Configure WhatsApp Business API for appointment confirmations and patient communication</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      WhatsApp Business API Credentials
                    </CardTitle>
                    <CardDescription>
                      Enter your Meta WhatsApp Business API credentials. Get these from your Meta Business Suite &gt; WhatsApp &gt; API Setup.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wa_enabled" className="text-sm font-medium">
                      {form.wa_enabled === "true" ? (
                        <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                      )}
                    </Label>
                    <Switch
                      id="wa_enabled"
                      checked={form.wa_enabled === "true"}
                      onCheckedChange={(checked) => handleChange("wa_enabled", checked ? "true" : "false")}
                      data-testid="switch-wa-enabled"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wa_phone_number_id" className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Phone Number ID *
                    </Label>
                    <Input
                      id="wa_phone_number_id"
                      placeholder="e.g., 123456789012345"
                      value={form.wa_phone_number_id || ""}
                      onChange={(e) => handleChange("wa_phone_number_id", e.target.value)}
                      data-testid="input-wa-phone-number-id"
                    />
                    <p className="text-[11px] text-muted-foreground">Found in Meta Business Suite &gt; WhatsApp &gt; API Setup</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa_business_account_id" className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Business Account ID
                    </Label>
                    <Input
                      id="wa_business_account_id"
                      placeholder="e.g., 987654321098765"
                      value={form.wa_business_account_id || ""}
                      onChange={(e) => handleChange("wa_business_account_id", e.target.value)}
                      data-testid="input-wa-business-account-id"
                    />
                    <p className="text-[11px] text-muted-foreground">Your WhatsApp Business Account ID from Meta</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa_access_token" className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Permanent Access Token *
                  </Label>
                  <Input
                    id="wa_access_token"
                    type="password"
                    placeholder="Your permanent access token from Meta"
                    value={form.wa_access_token || ""}
                    onChange={(e) => handleChange("wa_access_token", e.target.value)}
                    data-testid="input-wa-access-token"
                  />
                  <p className="text-[11px] text-muted-foreground">Generate a permanent token in Meta Business Suite &gt; System Users. Never share this token.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  Message Template Configuration
                </CardTitle>
                <CardDescription>
                  Configure the WhatsApp message template for appointment confirmations. Templates must be pre-approved in your Meta Business account. Leave blank to send plain text messages instead.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wa_template_appointment" className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Appointment Confirmation Template Name
                  </Label>
                  <Input
                    id="wa_template_appointment"
                    placeholder="e.g., appointment_confirmation"
                    value={form.wa_template_appointment || ""}
                    onChange={(e) => handleChange("wa_template_appointment", e.target.value)}
                    data-testid="input-wa-template-appointment"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The template should accept 5 parameters: Patient Name, Doctor Name, Date, Time, Token Number.
                    If left blank, a plain text confirmation message will be sent instead.
                  </p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    How WhatsApp Messages Work
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>When an appointment is booked with a patient phone number, the system will automatically:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>Send appointment confirmation via WhatsApp (if enabled above)</li>
                      <li>Log the WhatsApp message as an activity on the lead timeline</li>
                      <li>Use the configured template, or a plain text fallback if no template is set</li>
                    </ul>
                    <p className="mt-2 font-medium">Template messages require pre-approval from Meta. Plain text messages can only be sent within 24 hours of the patient's last message to you.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="w-5 h-5 text-muted-foreground" />
                  Test WhatsApp
                </CardTitle>
                <CardDescription>
                  Verify your connection and send a test message to confirm everything is working.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="test_phone" className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Test Phone Number
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-medium">+91</span>
                      <Input
                        id="test_phone"
                        placeholder="10-digit mobile number"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        maxLength={10}
                        data-testid="input-wa-test-phone"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => sendTestMutation.mutate(testPhone)}
                    disabled={sendTestMutation.isPending || !testPhone}
                    data-testid="button-wa-send-test"
                  >
                    {sendTestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Test Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
                data-testid="button-wa-test-connection"
              >
                {testConnectionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                data-testid="button-wa-save"
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
