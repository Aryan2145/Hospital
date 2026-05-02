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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  MessageSquare, Save, TestTube, Key, Hash, Phone, Shield, Loader2, Send,
  Info, FileText, Eye, EyeOff, Globe, Bell, ArrowRight, Copy, CheckCircle2,
  Webhook,
} from "lucide-react";

interface WhatsAppSettings {
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  wa_business_account_id: string | null;
  wa_enabled: string | null;
  wa_template_appointment: string | null;
  wa_test_phone: string | null;
}

interface WatiSettings {
  wati_api_url: string | null;
  wati_access_token: string | null;
  wati_enabled: string | null;
  wati_template_appointment: string | null;
  wati_template_reminder: string | null;
  wati_test_phone: string | null;
  hospital_contact_phone: string | null;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: `${label} copied` });
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={handleCopy} data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}>
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function WhatsAppSettingsPage() {
  const { toast } = useToast();
  const webhookUrl = `${window.location.origin}/api/webhook/wati`;

  const { data: waSettings, isLoading: waLoading } = useQuery<WhatsAppSettings>({
    queryKey: ["/api/whatsapp-settings"],
  });

  const { data: watiSettings, isLoading: watiLoading } = useQuery<WatiSettings>({
    queryKey: ["/api/wati-settings"],
  });

  const [waForm, setWaForm] = useState<WhatsAppSettings>({
    wa_phone_number_id: "",
    wa_access_token: "",
    wa_business_account_id: "",
    wa_enabled: "false",
    wa_template_appointment: "",
    wa_test_phone: "",
  });
  const [showWaToken, setShowWaToken] = useState(false);
  const [waTestPhone, setWaTestPhone] = useState("");

  const [watiForm, setWatiForm] = useState<WatiSettings>({
    wati_api_url: "",
    wati_access_token: "",
    wati_enabled: "false",
    wati_template_appointment: "",
    wati_template_reminder: "",
    wati_test_phone: "",
    hospital_contact_phone: "",
  });
  const [showWatiToken, setShowWatiToken] = useState(false);
  const [watiTestPhone, setWatiTestPhone] = useState("");

  useEffect(() => {
    if (waSettings) {
      setWaForm({
        wa_phone_number_id: waSettings.wa_phone_number_id || "",
        wa_access_token: waSettings.wa_access_token || "",
        wa_business_account_id: waSettings.wa_business_account_id || "",
        wa_enabled: waSettings.wa_enabled ?? "false",
        wa_template_appointment: waSettings.wa_template_appointment || "",
        wa_test_phone: waSettings.wa_test_phone || "",
      });
      setWaTestPhone(waSettings.wa_test_phone || "");
    }
  }, [waSettings]);

  useEffect(() => {
    if (watiSettings) {
      setWatiForm({
        wati_api_url: watiSettings.wati_api_url || "",
        wati_access_token: watiSettings.wati_access_token || "",
        wati_enabled: watiSettings.wati_enabled ?? "false",
        wati_template_appointment: watiSettings.wati_template_appointment || "",
        wati_template_reminder: watiSettings.wati_template_reminder || "",
        wati_test_phone: watiSettings.wati_test_phone || "",
        hospital_contact_phone: watiSettings.hospital_contact_phone || "",
      });
      setWatiTestPhone(watiSettings.wati_test_phone || "");
    }
  }, [watiSettings]);

  // ── Meta Cloud API mutations ──────────────────────────────────────────────
  const waSaveMutation = useMutation({
    mutationFn: async (data: WhatsAppSettings) => {
      const res = await apiRequest("PUT", "/api/whatsapp-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Meta WhatsApp settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const waTestConnMutation = useMutation({
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

  const waSendTestMutation = useMutation({
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

  // ── WATI mutations ────────────────────────────────────────────────────────
  const watiSaveMutation = useMutation({
    mutationFn: async (data: WatiSettings) => {
      const res = await apiRequest("PUT", "/api/wati-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "WATI settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/wati-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const watiTestConnMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wati-settings/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "WATI Connection Successful", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "WATI Connection Failed", description: err.message, variant: "destructive" });
    },
  });

  const watiSendTestMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/wati-settings/send-test", { phone });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.sessionFailed) {
        toast({ title: "WATI Credentials Verified", description: data.message });
      } else {
        toast({ title: "Test Message Sent", description: data.message });
      }
    },
    onError: (err: Error) => {
      toast({ title: "WATI Test Failed", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = waLoading || watiLoading;
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
                <p className="text-sm text-muted-foreground">
                  Configure WhatsApp for appointment confirmations, reminders, and two-way patient communication
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="wati">
            <TabsList className="mb-6" data-testid="tabs-wa-provider">
              <TabsTrigger value="wati" data-testid="tab-wati">
                <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                WATI
                {watiForm.wati_enabled === "true" && (
                  <Badge className="ml-2 bg-green-100 text-green-700 text-[10px] py-0">Active</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="meta" data-testid="tab-meta">
                <Globe className="w-4 h-4 mr-2 text-blue-600" />
                Meta Cloud API
                {waForm.wa_enabled === "true" && (
                  <Badge className="ml-2 bg-blue-100 text-blue-700 text-[10px] py-0">Active</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ================================================================= */}
            {/* WATI TAB                                                           */}
            {/* ================================================================= */}
            <TabsContent value="wati" className="space-y-6">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex gap-3 items-start">
                <Info className="w-4 h-4 text-green-700 mt-0.5 shrink-0" />
                <div className="text-xs text-green-800 space-y-1">
                  <p className="font-semibold">WATI (WhatsApp Team Inbox) — Recommended</p>
                  <p>WATI provides a dedicated WhatsApp Business API with template messaging, session-based two-way chat, and an incoming message webhook. When WATI is enabled it takes priority over Meta Cloud API for sending.</p>
                </div>
              </div>

              {/* Credentials */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className="w-5 h-5 text-muted-foreground" />
                        WATI API Credentials
                      </CardTitle>
                      <CardDescription>
                        Find your API URL and Access Token in the WATI dashboard under <strong>Settings → API</strong>.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="wati_enabled" className="text-sm font-medium">
                        {watiForm.wati_enabled === "true" ? (
                          <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                        )}
                      </Label>
                      <Switch
                        id="wati_enabled"
                        checked={watiForm.wati_enabled === "true"}
                        onCheckedChange={(c) => setWatiForm(p => ({ ...p, wati_enabled: c ? "true" : "false" }))}
                        data-testid="switch-wati-enabled"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wati_api_url" className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      WATI API URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wati_api_url"
                      placeholder="https://live-server-XXXXX.wati.io"
                      value={watiForm.wati_api_url || ""}
                      onChange={(e) => setWatiForm(p => ({ ...p, wati_api_url: e.target.value }))}
                      data-testid="input-wati-api-url"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Your WATI tenant URL — found in WATI Dashboard → API → Endpoint. Looks like <code>https://live-server-XXXXX.wati.io</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wati_access_token" className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      Access Token <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="wati_access_token"
                        type={showWatiToken ? "text" : "password"}
                        placeholder="Your WATI API access token"
                        value={watiForm.wati_access_token || ""}
                        onChange={(e) => setWatiForm(p => ({ ...p, wati_access_token: e.target.value }))}
                        className="pr-10"
                        data-testid="input-wati-access-token"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowWatiToken(v => !v)}
                        tabIndex={-1}
                        data-testid="button-toggle-wati-token"
                      >
                        {showWatiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Found in WATI Dashboard → Settings → API → Access Token. Never share this token.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    Message Templates
                  </CardTitle>
                  <CardDescription>
                    Enter the exact template names as approved in your WATI dashboard. Both templates use the same 6 variables listed below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wati_template_appointment" className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Appointment Confirmation Template
                      </Label>
                      <Input
                        id="wati_template_appointment"
                        placeholder="viroc_appointment_confirmation"
                        value={watiForm.wati_template_appointment || ""}
                        onChange={(e) => setWatiForm(p => ({ ...p, wati_template_appointment: e.target.value }))}
                        data-testid="input-wati-template-appointment"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Sent instantly when an appointment is booked.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wati_template_reminder" className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5" />
                        Appointment Reminder Template
                      </Label>
                      <Input
                        id="wati_template_reminder"
                        placeholder="viroc_appointment_reminder"
                        value={watiForm.wati_template_reminder || ""}
                        onChange={(e) => setWatiForm(p => ({ ...p, wati_template_reminder: e.target.value }))}
                        data-testid="input-wati-template-reminder"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Sent automatically 24 hrs and 2 hrs before the appointment.
                      </p>
                    </div>
                  </div>

                  {/* Hospital Contact Number */}
                  <div className="space-y-2">
                    <Label htmlFor="hospital_contact_phone" className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      Hospital Contact Number
                    </Label>
                    <Input
                      id="hospital_contact_phone"
                      placeholder="e.g., 022-12345678 or +91 98765 43210"
                      value={watiForm.hospital_contact_phone || ""}
                      onChange={(e) => setWatiForm(p => ({ ...p, hospital_contact_phone: e.target.value }))}
                      data-testid="input-hospital-contact-phone"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Sent as the <code className="bg-muted px-1 rounded text-[10px]">hospital_contact</code> variable (param 6) in both templates. Save WATI Settings to update.
                    </p>
                  </div>

                  {/* Template variable mapping table */}
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Variable</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Parameter name</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value sent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          ["{{1}}", "patient_name",     "Patient's full name"],
                          ["{{2}}", "doctor_name",      "Doctor name (with Dr. prefix)"],
                          ["{{3}}", "appointment_date", "e.g., 10 May 2026"],
                          ["{{4}}", "appointment_time", "e.g., 11:30 AM"],
                          ["{{5}}", "hospital_name",    "Your hospital's display name"],
                          ["{{6}}", "hospital_contact", "Hospital contact number (field above)"],
                        ].map(([variable, param, value]) => (
                          <tr key={param} className="hover:bg-muted/30">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{variable}</td>
                            <td className="px-3 py-1.5 font-mono text-primary">{param}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-md bg-muted/50 px-4 py-3 space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      How WATI Messages Work
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                      <li><strong>Appointment confirmation</strong> — sent instantly when a new appointment is booked (duplicate-guarded)</li>
                      <li><strong>24-hour reminder</strong> — sent automatically ~24 hours before the appointment</li>
                      <li><strong>2-hour reminder</strong> — sent automatically ~2 hours before the appointment</li>
                      <li><strong>Incoming messages</strong> — patient replies are captured via webhook and logged on the lead timeline</li>
                      <li>Templates must be approved in your WATI dashboard before use</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Webhook for 2-way */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Webhook className="w-5 h-5 text-muted-foreground" />
                    Two-Way Communication — Incoming Webhook
                  </CardTitle>
                  <CardDescription>
                    Configure this URL in your WATI dashboard so that patient replies are automatically captured and logged in the CRM.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      Webhook URL (copy &amp; paste into WATI → Settings → Webhook)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="font-mono text-xs bg-muted/50"
                        data-testid="input-wati-webhook-url"
                      />
                      <CopyButton text={webhookUrl} label="Webhook URL" />
                    </div>
                  </div>

                  <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">How to configure two-way messaging in WATI:</p>
                    <ol className="text-xs text-amber-700 list-decimal pl-5 space-y-1">
                      <li>Log in to your WATI dashboard</li>
                      <li>Go to <strong>Settings → Webhook / API</strong></li>
                      <li>Paste the Webhook URL above into the <em>Webhook URL</em> field</li>
                      <li>Enable <strong>Message Received</strong> events</li>
                      <li>Save. Patient replies will now log on the lead timeline in this CRM.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* Test */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Send className="w-5 h-5 text-muted-foreground" />
                    Test WATI Connection
                  </CardTitle>
                  <CardDescription>Verify your WATI credentials and send a test session message.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="wati_test_phone" className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Test Phone Number
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-medium">+91</span>
                        <Input
                          id="wati_test_phone"
                          placeholder="10-digit mobile number"
                          value={watiTestPhone}
                          onChange={(e) => setWatiTestPhone(e.target.value)}
                          maxLength={10}
                          data-testid="input-wati-test-phone"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => watiSendTestMutation.mutate(watiTestPhone)}
                      disabled={watiSendTestMutation.isPending || !watiTestPhone}
                      data-testid="button-wati-send-test"
                    >
                      {watiSendTestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Test Message
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => watiTestConnMutation.mutate()}
                  disabled={watiTestConnMutation.isPending}
                  data-testid="button-wati-test-connection"
                >
                  {watiTestConnMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test Connection
                </Button>
                <Button
                  onClick={() => watiSaveMutation.mutate(watiForm)}
                  disabled={watiSaveMutation.isPending}
                  data-testid="button-wati-save"
                >
                  {watiSaveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save WATI Settings
                </Button>
              </div>
            </TabsContent>

            {/* ================================================================= */}
            {/* META CLOUD API TAB                                                  */}
            {/* ================================================================= */}
            <TabsContent value="meta" className="space-y-6">
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex gap-3 items-start">
                <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Meta Cloud API (Facebook WhatsApp Business)</p>
                  <p>Direct integration with Meta's WhatsApp Business Cloud API. If WATI is also enabled, WATI takes priority. Use this as a fallback or if you don't have WATI.</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className="w-5 h-5 text-muted-foreground" />
                        WhatsApp Business API Credentials
                      </CardTitle>
                      <CardDescription>
                        Enter your Meta WhatsApp Business API credentials from Meta Business Suite → WhatsApp → API Setup.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="wa_enabled" className="text-sm font-medium">
                        {waForm.wa_enabled === "true" ? (
                          <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                        )}
                      </Label>
                      <Switch
                        id="wa_enabled"
                        checked={waForm.wa_enabled === "true"}
                        onCheckedChange={(c) => setWaForm(p => ({ ...p, wa_enabled: c ? "true" : "false" }))}
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
                        Phone Number ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wa_phone_number_id"
                        placeholder="e.g., 123456789012345"
                        value={waForm.wa_phone_number_id || ""}
                        onChange={(e) => setWaForm(p => ({ ...p, wa_phone_number_id: e.target.value }))}
                        data-testid="input-wa-phone-number-id"
                      />
                      <p className="text-[11px] text-muted-foreground">Found in Meta Business Suite → WhatsApp → API Setup</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa_business_account_id" className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        Business Account ID
                      </Label>
                      <Input
                        id="wa_business_account_id"
                        placeholder="e.g., 987654321098765"
                        value={waForm.wa_business_account_id || ""}
                        onChange={(e) => setWaForm(p => ({ ...p, wa_business_account_id: e.target.value }))}
                        data-testid="input-wa-business-account-id"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wa_access_token" className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      Permanent Access Token <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="wa_access_token"
                        type={showWaToken ? "text" : "password"}
                        placeholder="Your permanent access token from Meta"
                        value={waForm.wa_access_token || ""}
                        onChange={(e) => setWaForm(p => ({ ...p, wa_access_token: e.target.value }))}
                        className="pr-10"
                        data-testid="input-wa-access-token"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowWaToken(v => !v)}
                        tabIndex={-1}
                        data-testid="button-toggle-wa-token"
                      >
                        {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Generate in Meta Business Suite → Settings → System Users. Never share this token.
                    </p>
                    <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 flex gap-2">
                      <span className="shrink-0 font-bold">!</span>
                      <span>
                        If you see <strong>"Access Token is invalid or expired"</strong>: go to{" "}
                        <strong>Meta Business Suite → Settings → System Users</strong>, generate a new token with{" "}
                        <em>whatsapp_business_messaging</em> permission, and paste it here.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    Message Template
                  </CardTitle>
                  <CardDescription>
                    Template name for appointment confirmations — must be pre-approved in Meta Business Manager. Leave blank for plain text.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="wa_template_appointment" className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Appointment Confirmation Template Name
                    </Label>
                    <Input
                      id="wa_template_appointment"
                      placeholder="e.g., appointment_confirmation"
                      value={waForm.wa_template_appointment || ""}
                      onChange={(e) => setWaForm(p => ({ ...p, wa_template_appointment: e.target.value }))}
                      data-testid="input-wa-template-appointment"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      5 parameters expected: Patient Name, Doctor Name, Date, Time, Token Number.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Send className="w-5 h-5 text-muted-foreground" />
                    Test WhatsApp
                  </CardTitle>
                  <CardDescription>Verify your connection and send a test message.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="wa_test_phone" className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Test Phone Number
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-medium">+91</span>
                        <Input
                          id="wa_test_phone"
                          placeholder="10-digit mobile number"
                          value={waTestPhone}
                          onChange={(e) => setWaTestPhone(e.target.value)}
                          maxLength={10}
                          data-testid="input-wa-test-phone"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => waSendTestMutation.mutate(waTestPhone)}
                      disabled={waSendTestMutation.isPending || !waTestPhone}
                      data-testid="button-wa-send-test"
                    >
                      {waSendTestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Test Message
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => waTestConnMutation.mutate()}
                  disabled={waTestConnMutation.isPending}
                  data-testid="button-wa-test-connection"
                >
                  {waTestConnMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test Connection
                </Button>
                <Button
                  onClick={() => waSaveMutation.mutate(waForm)}
                  disabled={waSaveMutation.isPending}
                  data-testid="button-wa-save"
                >
                  {waSaveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Meta Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* WAsimple guidance */}
          <Card className="mt-8 border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                WAsimple — Integration Guidance
              </CardTitle>
              <CardDescription>
                WAsimple is a simpler WhatsApp automation tool. It is not directly integrated into the CRM today but can be connected via webhook or API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to connect WAsimple:</p>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>
                  <strong>Outbound (CRM → WAsimple):</strong> WAsimple provides an HTTP API endpoint. You can use their API key and endpoint to send messages. Contact the WAsimple team for your API endpoint URL and key, then ask your administrator to add a custom integration.
                </li>
                <li>
                  <strong>Inbound (WAsimple → CRM):</strong> WAsimple supports outgoing webhooks. Configure WAsimple to POST incoming messages to:
                  <code className="block mt-1 p-2 bg-muted rounded text-xs font-mono break-all">{window.location.origin}/api/webhook/wati</code>
                  WAsimple's payload format is similar enough that the existing WATI webhook endpoint will capture patient replies.
                </li>
                <li>
                  <strong>Template messages:</strong> WAsimple uses pre-approved WhatsApp Business templates. Create your appointment confirmation and reminder templates in the WAsimple dashboard, then enter the template names in the WATI tab above (WAsimple uses the same template message API structure as WATI).
                </li>
              </ol>
              <div className="flex items-center gap-2 pt-1">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs">
                  For a full native WAsimple connector, contact your CRM administrator to request the integration.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
