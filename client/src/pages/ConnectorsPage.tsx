import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Plus, Settings, RefreshCw, Trash2, CheckCircle2, XCircle,
  Wifi, WifiOff, ArrowUpRight, BarChart3, Eye, EyeOff, MousePointerClick,
  IndianRupee, Target, Loader2, Zap, Globe, TrendingUp,
  Copy, Pencil, Link2, Phone, Mail, MessageSquare, FileSpreadsheet,
  Key, ExternalLink, Shield, Clock, PhoneCall,
} from "lucide-react";
import { SiFacebook, SiGoogle, SiLinkedin, SiX } from "react-icons/si";

interface PlatformConnector {
  id: number;
  tenantId: number;
  platform: string;
  displayName: string;
  status: string;
  credentials: Record<string, any> | null;
  config: Record<string, any> | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
  metricsCache: Record<string, number> | null;
  metricsCachedAt: string | null;
  createdAt: string;
  modifiedAt: string;
}

interface PlatformTemplate {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  description: string;
  credentialFields: { key: string; label: string; type: string; placeholder: string }[];
}

interface LeadCaptureRule {
  id: number;
  tenantId: number;
  connectorId: number | null;
  name: string;
  sourceType: string;
  sourcePage: string | null;
  sourceForm: string | null;
  isActive: boolean;
  assignmentStrategy: string;
  assignToEmployeeIds: number[] | null;
  duplicatePhoneAction: string;
  duplicateLeadOption: string;
  duplicateTagsOption: string;
  defaultLeadStatus: string;
  defaultTags: string | null;
  fieldMapping: Record<string, string> | null;
  webhookToken: string | null;
  mapCallLogs: boolean | null;
  createdAt: string;
  modifiedAt: string;
}

interface CrmUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
}

interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

const SOURCE_TYPE_OPTIONS = [
  { value: "meta_lead_ads", label: "Meta Lead Ads" },
  { value: "google_forms", label: "Google Forms" },
  { value: "callyzer", label: "Telephony (Callyzer)" },
  { value: "whatsapp_business", label: "WhatsApp Business" },
  { value: "google_sheets", label: "Google Sheets" },
  { value: "custom_webhook", label: "Custom Webhook" },
];

const ACTIVE_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const ASSIGNMENT_STRATEGY_OPTIONS = [
  { value: "round_robin", label: "Round Robin" },
  { value: "specific_employees", label: "Specific Employees" },
];

const DUPLICATE_PHONE_OPTIONS = [
  { value: "ignore", label: "Ignore - keep same assignment" },
  { value: "reassign", label: "Reassign - reassign based on strategy" },
];

const DUPLICATE_LEAD_OPTIONS = [
  { value: "skip", label: "Skip - skip duplicates" },
  { value: "update_blank_only", label: "UpdateBlankOnly - update only blank fields" },
  { value: "overwrite", label: "Overwrite" },
];

const DUPLICATE_TAGS_OPTIONS = [
  { value: "ignore", label: "Ignore - keep existing tags" },
  { value: "replace", label: "Replace - replace with new tags" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "Raw Lead Captured", label: "Raw Lead Captured" },
  { value: "Contacted", label: "Contacted" },
  { value: "Interested", label: "Interested" },
  { value: "Not Interested", label: "Not Interested" },
];

const DEFAULT_RULE_FORM = {
  name: "",
  sourceType: "",
  sourcePage: "",
  sourceForm: "",
  isActive: "true",
  assignmentStrategy: "round_robin",
  assignToEmployeeIds: [] as number[],
  duplicatePhoneAction: "ignore",
  duplicateLeadOption: "skip",
  duplicateTagsOption: "ignore",
  defaultLeadStatus: "Raw Lead Captured",
  defaultTags: "",
  mapCallLogs: false,
  fieldMapping: {} as Record<string, string>,
};

const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    id: "meta",
    name: "Meta (Facebook & Instagram)",
    icon: SiFacebook,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    description: "Connect to Meta Ads Manager for Facebook & Instagram campaign insights, ad performance, and audience metrics.",
    credentialFields: [
      { key: "appId", label: "App ID", type: "text", placeholder: "Your Meta App ID" },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Your Meta App Secret" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Long-lived access token" },
      { key: "adAccountId", label: "Ad Account ID", type: "text", placeholder: "act_XXXXXXXX" },
    ],
  },
  {
    id: "google",
    name: "Google Ads",
    icon: SiGoogle,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    description: "Connect to Google Ads for search, display, and YouTube campaign performance, keyword insights, and conversion tracking.",
    credentialFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "OAuth Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "OAuth Client Secret" },
      { key: "developerToken", label: "Developer Token", type: "password", placeholder: "Google Ads Developer Token" },
      { key: "customerId", label: "Customer ID", type: "text", placeholder: "XXX-XXX-XXXX" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Marketing",
    icon: SiLinkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    description: "Connect to LinkedIn Marketing Solutions for sponsored content performance, lead gen forms, and professional audience insights.",
    credentialFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "LinkedIn App Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "LinkedIn App Client Secret" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "OAuth 2.0 Access Token" },
      { key: "adAccountId", label: "Ad Account ID", type: "text", placeholder: "Account URN" },
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter) Ads",
    icon: SiX,
    color: "text-foreground",
    bgColor: "bg-muted/50",
    description: "Connect to X Ads for promoted tweets, follower campaigns, and engagement analytics across the X platform.",
    credentialFields: [
      { key: "apiKey", label: "API Key", type: "text", placeholder: "Twitter API Key" },
      { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Twitter API Secret" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "OAuth Access Token" },
      { key: "accountId", label: "Account ID", type: "text", placeholder: "Ads Account ID" },
    ],
  },
  {
    id: "bing",
    name: "Microsoft Ads (Bing)",
    icon: Globe,
    color: "text-sky-600",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
    description: "Connect to Microsoft Advertising for Bing search ads, audience network, and cross-platform campaign insights.",
    credentialFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Azure App Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Azure App Client Secret" },
      { key: "developerToken", label: "Developer Token", type: "password", placeholder: "Microsoft Ads Developer Token" },
      { key: "accountId", label: "Account ID", type: "text", placeholder: "Account Number" },
    ],
  },
  {
    id: "callyzer",
    name: "Telephony Connector",
    icon: Phone,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    description: "Connect your telephony system for real-time call tracking, employee call analytics, call recordings, and team performance monitoring.",
    credentialFields: [
      { key: "apiKey", label: "API Access Key", type: "password", placeholder: "Your Telephony API Key" },
      { key: "webhookUrl", label: "Webhook URL (Optional)", type: "text", placeholder: "https://your-domain.com/api/webhook/callyzer" },
    ],
  },
];

const METRIC_LABELS: Record<string, { label: string; icon: any; format: (v: number) => string }> = {
  impressions: { label: "Impressions", icon: Eye, format: (v) => v.toLocaleString() },
  clicks: { label: "Clicks", icon: MousePointerClick, format: (v) => v.toLocaleString() },
  spend: { label: "Spend", icon: IndianRupee, format: (v) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  ctr: { label: "CTR", icon: TrendingUp, format: (v) => `${v.toFixed(2)}%` },
  conversions: { label: "Conversions", icon: Target, format: (v) => v.toLocaleString() },
  cpc: { label: "CPC", icon: IndianRupee, format: (v) => `₹${v.toFixed(2)}` },
  reach: { label: "Reach", icon: Eye, format: (v) => v.toLocaleString() },
  totalCalls: { label: "Total Calls", icon: Phone, format: (v) => Math.round(v).toLocaleString() },
  incomingCalls: { label: "Incoming", icon: Phone, format: (v) => Math.round(v).toLocaleString() },
  outgoingCalls: { label: "Outgoing", icon: Phone, format: (v) => Math.round(v).toLocaleString() },
  missedCalls: { label: "Missed", icon: Phone, format: (v) => Math.round(v).toLocaleString() },
  connectedCalls: { label: "Connected", icon: CheckCircle2, format: (v) => Math.round(v).toLocaleString() },
  avgCallDuration: { label: "Avg Duration", icon: BarChart3, format: (v) => `${Math.floor(v / 60)}m ${Math.round(v % 60)}s` },
  totalEmployees: { label: "Employees", icon: Target, format: (v) => Math.round(v).toLocaleString() },
};

function CallyzerWebhookPanel({ connector }: { connector: PlatformConnector }) {
  const { toast } = useToast();
  const [generatingSecret, setGeneratingSecret] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const creds = (connector.credentials || {}) as Record<string, any>;
  const hasSecret = !!creds.webhookSecret;
  const baseWebhookUrl = `${window.location.origin}/api/webhook/callyzer/${connector.id}`;
  const currentSecret = webhookSecret || creds.webhookSecret;
  const webhookUrl = currentSecret
    ? `${baseWebhookUrl}?secret=${encodeURIComponent(currentSecret)}`
    : baseWebhookUrl;

  async function generateSecret() {
    setGeneratingSecret(true);
    try {
      const res = await apiRequest("POST", `/api/connectors/${connector.id}/generate-webhook-secret`);
      const data = await res.json();
      setWebhookSecret(data.webhookSecret);
      setShowSecret(true);
      creds.webhookSecret = data.webhookSecret;
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Webhook secret generated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingSecret(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  }

  return (
    <div className="space-y-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20" data-testid="callyzer-webhook-panel">
      <div className="flex items-center gap-2">
        <PhoneCall className="h-4 w-4 text-emerald-600" />
        <span className="font-medium text-sm">Webhook Configuration</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure this in your telephony system (e.g., Callyzer: Connectors → API & Webhook → Webhook Config). Copy the full URL below and paste it in your telephony webhook settings.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Webhook URL
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            readOnly
            value={webhookUrl}
            className="text-xs font-mono bg-white dark:bg-slate-900 h-8"
            data-testid="input-callyzer-webhook-url"
          />
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
            data-testid="button-copy-callyzer-webhook-url"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <Shield className="h-3 w-3" /> Webhook Secret
        </Label>
        {webhookSecret || hasSecret ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                readOnly
                type={showSecret ? "text" : "password"}
                value={webhookSecret || (hasSecret ? "••••••••••••••••••••••••" : "")}
                className="text-xs font-mono bg-white dark:bg-slate-900 h-8"
                data-testid="input-callyzer-webhook-secret"
              />
              {webhookSecret && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(webhookSecret, "Webhook Secret")}
                  data-testid="button-copy-callyzer-webhook-secret"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {webhookSecret && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                New secret generated. Copy the Webhook URL above (it includes the secret as a query parameter) and update it in your telephony system's webhook config.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={generateSecret}
              disabled={generatingSecret}
              className="w-full text-xs"
              data-testid="button-regenerate-callyzer-secret"
            >
              {generatingSecret ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Key className="h-3 w-3 mr-1" />}
              Regenerate Secret
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={generateSecret}
            disabled={generatingSecret}
            className="w-full text-xs"
            data-testid="button-generate-callyzer-secret"
          >
            {generatingSecret ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Key className="h-3 w-3 mr-1" />}
            Generate Webhook Secret
          </Button>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
        <p className="font-medium">How it works:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Your telephony system pushes call data to this URL in real-time</li>
          <li>Calls are matched to leads by patient phone number</li>
          <li>Employee is matched by CRM user phone number</li>
          <li>Matched calls appear as activities on the lead timeline</li>
        </ul>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [configDialog, setConfigDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTemplate | null>(null);
  const [editingConnector, setEditingConnector] = useState<PlatformConnector | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [showCredFields, setShowCredFields] = useState<Record<string, boolean>>({});
  const [metricsDialog, setMetricsDialog] = useState<PlatformConnector | null>(null);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<LeadCaptureRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ ...DEFAULT_RULE_FORM });

  const { data: connectors = [], isLoading } = useQuery<PlatformConnector[]>({
    queryKey: ["/api/connectors"],
  });

  const { data: captureRules = [], isLoading: rulesLoading } = useQuery<LeadCaptureRule[]>({
    queryKey: ["/api/lead-capture-rules"],
  });

  const { data: crmUsers = [] } = useQuery<CrmUser[]>({
    queryKey: ["/api/crm-users/active"],
  });

  const { data: importFields = [] } = useQuery<ImportField[]>({
    queryKey: ["/api/leads/import-fields"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/connectors", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector configured successfully" });
      closeDialog();
      if (result?.id && selectedPlatform?.id === "meta") {
        setTimeout(() => testMutation.mutate(result.id), 500);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/connectors/${id}`, data);
      return id;
    },
    onSuccess: (connectorId: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector updated" });
      closeDialog();
      if (selectedPlatform?.id === "meta") {
        setTimeout(() => testMutation.mutate(connectorId), 500);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/connectors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/connectors/${id}/test`);
    },
    onSuccess: () => {
      toast({ title: "Connection test initiated", description: "Testing connectivity..." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      }, 3000);
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/connectors/${id}/sync`);
    },
    onSuccess: () => {
      toast({ title: "Sync initiated", description: "Fetching latest data..." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      }, 2000);
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/lead-capture-rules", data);
      return res.json();
    },
    onSuccess: (rule: LeadCaptureRule) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-capture-rules"] });
      toast({ title: "Lead capture rule created" });
      setEditingRule(rule);
      setRuleDialog(true);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/lead-capture-rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-capture-rules"] });
      toast({ title: "Lead capture rule updated" });
      closeRuleDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/lead-capture-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-capture-rules"] });
      toast({ title: "Lead capture rule deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setConfigDialog(false);
    setSelectedPlatform(null);
    setEditingConnector(null);
    setCredentialValues({});
    setShowCredFields({});
  }

  function closeRuleDialog() {
    setRuleDialog(false);
    setEditingRule(null);
    setRuleForm({ ...DEFAULT_RULE_FORM });
  }

  function openNewRule() {
    setEditingRule(null);
    setRuleForm({ ...DEFAULT_RULE_FORM });
    setRuleDialog(true);
  }

  function openEditRule(rule: LeadCaptureRule) {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      sourceType: rule.sourceType,
      sourcePage: rule.sourcePage || "",
      sourceForm: rule.sourceForm || "",
      isActive: String(rule.isActive),
      assignmentStrategy: rule.assignmentStrategy,
      assignToEmployeeIds: (rule.assignToEmployeeIds as number[]) || [],
      duplicatePhoneAction: rule.duplicatePhoneAction,
      duplicateLeadOption: rule.duplicateLeadOption,
      duplicateTagsOption: rule.duplicateTagsOption,
      defaultLeadStatus: rule.defaultLeadStatus,
      defaultTags: rule.defaultTags || "",
      mapCallLogs: rule.mapCallLogs || false,
      fieldMapping: (rule.fieldMapping as Record<string, string>) || {},
    });
    setRuleDialog(true);
  }

  function handleSaveRule() {
    if (!ruleForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!ruleForm.sourceType) {
      toast({ title: "Source Type is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: ruleForm.name,
      sourceType: ruleForm.sourceType,
      sourcePage: ruleForm.sourcePage || null,
      sourceForm: ruleForm.sourceForm || null,
      isActive: ruleForm.isActive === "true",
      assignmentStrategy: ruleForm.assignmentStrategy,
      assignToEmployeeIds: ruleForm.assignmentStrategy === "specific_employees" ? ruleForm.assignToEmployeeIds : null,
      duplicatePhoneAction: ruleForm.duplicatePhoneAction,
      duplicateLeadOption: ruleForm.duplicateLeadOption,
      duplicateTagsOption: ruleForm.duplicateTagsOption,
      defaultLeadStatus: ruleForm.defaultLeadStatus,
      defaultTags: ruleForm.defaultTags || null,
      fieldMapping: ruleForm.fieldMapping,
      mapCallLogs: ruleForm.mapCallLogs,
    };
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createRuleMutation.mutate(payload);
    }
  }

  function toggleEmployee(userId: number) {
    setRuleForm((prev) => {
      const ids = prev.assignToEmployeeIds.includes(userId)
        ? prev.assignToEmployeeIds.filter((id) => id !== userId)
        : [...prev.assignToEmployeeIds, userId];
      return { ...prev, assignToEmployeeIds: ids };
    });
  }

  function copyWebhookUrl(token: string) {
    const url = `${window.location.origin}/api/webhook/lead-capture/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Webhook URL copied to clipboard" });
  }

  function getSourceTypeLabel(value: string) {
    return SOURCE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
  }

  function openAddConnector(template: PlatformTemplate) {
    const existing = connectors.find((c) => c.platform === template.id);
    if (existing) {
      setEditingConnector(existing);
      const creds = (existing.credentials as Record<string, string>) || {};
      setCredentialValues(creds);
    } else {
      setEditingConnector(null);
      setCredentialValues({});
    }
    setShowCredFields({});
    setSelectedPlatform(template);
    setConfigDialog(true);
  }

  function handleSave() {
    if (!selectedPlatform) return;
    const payload = {
      platform: selectedPlatform.id,
      displayName: selectedPlatform.name,
      credentials: credentialValues,
      config: {},
    };
    if (editingConnector) {
      updateMutation.mutate({ id: editingConnector.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function getConnectorForPlatform(platformId: string): PlatformConnector | undefined {
    return connectors.find((c) => c.platform === platformId);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Disconnected</Badge>;
    }
  }

  function getSyncBadge(syncStatus: string | null) {
    switch (syncStatus) {
      case "synced":
        return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Synced</Badge>;
      case "syncing":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</Badge>;
      case "testing":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Testing</Badge>;
      default:
        return null;
    }
  }

  const connectedCount = connectors.filter((c) => c.status === "connected").length;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto p-4 md:p-8" data-testid="connectors-page">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Connectors</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect marketing platforms, communication channels, and external services
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Wifi className="h-3 w-3" />
                {connectedCount} Connected
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Marketing Platforms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {PLATFORM_TEMPLATES.map((template) => {
                  const connector = getConnectorForPlatform(template.id);
                  const Icon = template.icon;
                  return (
                    <Card
                      key={template.id}
                      className={connector?.status === "connected" ? "border-green-200 dark:border-green-900" : ""}
                      data-testid={`card-connector-${template.id}`}
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-md ${template.bgColor}`}>
                            <Icon className={`h-5 w-5 ${template.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {connector ? getStatusBadge(connector.status) : (
                                <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Not configured</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>

                        {connector?.status === "connected" && connector.metricsCache && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {Object.entries(connector.metricsCache).slice(0, 3).map(([key, value]) => {
                              const meta = METRIC_LABELS[key];
                              if (!meta) return null;
                              const MetricIcon = meta.icon;
                              return (
                                <div key={key} className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                    <MetricIcon className="h-3 w-3" />
                                    <span className="text-[10px] uppercase tracking-wider">{meta.label}</span>
                                  </div>
                                  <p className="text-sm font-semibold" data-testid={`text-metric-${template.id}-${key}`}>
                                    {meta.format(value as number)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {connector?.lastSyncAt && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3" />
                            Last sync: {new Date(connector.lastSyncAt).toLocaleString()}
                            {connector.syncStatus && getSyncBadge(connector.syncStatus)}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {connector ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAddConnector(template)}
                                data-testid={`button-configure-${template.id}`}
                              >
                                <Settings className="h-3.5 w-3.5 mr-1.5" /> Configure
                              </Button>
                              {connector.status === "connected" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => syncMutation.mutate(connector.id)}
                                    disabled={syncMutation.isPending || connector.syncStatus === "syncing"}
                                    data-testid={`button-sync-${template.id}`}
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${connector.syncStatus === "syncing" ? "animate-spin" : ""}`} />
                                    Sync
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setMetricsDialog(connector)}
                                    data-testid={`button-insights-${template.id}`}
                                  >
                                    <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Insights
                                  </Button>
                                </>
                              )}
                              {connector.status !== "connected" && (
                                <Button
                                  size="sm"
                                  onClick={() => testMutation.mutate(connector.id)}
                                  disabled={testMutation.isPending || connector.syncStatus === "testing"}
                                  data-testid={`button-test-${template.id}`}
                                >
                                  <Zap className="h-3.5 w-3.5 mr-1.5" /> Test Connection
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Remove this connector configuration?")) {
                                    deleteMutation.mutate(connector.id);
                                  }
                                }}
                                data-testid={`button-delete-${template.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openAddConnector(template)}
                              data-testid={`button-connect-${template.id}`}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" /> Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-3">Communication & Data Import</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <Card data-testid="card-connector-google-sheets">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Google Sheets Import</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">Bulk lead import</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Import leads in bulk from Google Sheets with field mapping, duplicate handling, and automatic assignment.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/google-sheets-import")}
                          data-testid="button-configure-google-sheets"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1.5" /> Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-connector-email">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Email (SMTP)</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">Password resets & notifications</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Configure SMTP server for sending password reset emails, system notifications, and transactional emails to patients and staff.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/email-settings")}
                          data-testid="button-configure-email"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1.5" /> Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-connector-whatsapp">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-green-50 dark:bg-green-950/30">
                          <MessageSquare className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">WhatsApp Business</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">Patient communication</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Connect WhatsApp Business API for automated appointment confirmations, patient reminders, and two-way messaging.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/whatsapp-settings")}
                          data-testid="button-configure-whatsapp"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1.5" /> Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {connectors.length > 0 && connectors.some((c) => c.status === "connected" && c.metricsCache) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Cross-Platform Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {(() => {
                        const totals: Record<string, number> = {};
                        connectors.forEach((c) => {
                          if (c.status === "connected" && c.metricsCache) {
                            Object.entries(c.metricsCache).forEach(([k, v]) => {
                              if (k === "ctr" || k === "cpc") return;
                              totals[k] = (totals[k] || 0) + (v as number);
                            });
                          }
                        });
                        const ctrConns = connectors.filter((c) => c.status === "connected" && c.metricsCache?.ctr);
                        if (ctrConns.length > 0) {
                          totals.ctr = ctrConns.reduce((sum, c) => sum + ((c.metricsCache?.ctr as number) || 0), 0) / ctrConns.length;
                        }
                        const cpcConns = connectors.filter((c) => c.status === "connected" && c.metricsCache?.cpc);
                        if (cpcConns.length > 0) {
                          totals.cpc = cpcConns.reduce((sum, c) => sum + ((c.metricsCache?.cpc as number) || 0), 0) / cpcConns.length;
                        }
                        return Object.entries(totals).map(([key, value]) => {
                          const meta = METRIC_LABELS[key];
                          if (!meta) return null;
                          const MetricIcon = meta.icon;
                          return (
                            <div key={key} className="text-center p-3">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                                <MetricIcon className="h-4 w-4" />
                              </div>
                              <p className="text-xl font-bold" data-testid={`text-total-${key}`}>
                                {meta.format(value)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card data-testid="card-lead-capture-rules">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Lead Capture Rules
                  </CardTitle>
                  <Button size="sm" onClick={openNewRule} data-testid="button-new-rule">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> New Rule
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rulesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : captureRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-rules">
                      No lead capture rules configured yet. Create one to start automatically importing leads.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {captureRules.map((rule) => {
                        const webhookUrl = rule.webhookToken
                          ? `${window.location.origin}/api/webhook/lead-capture/${rule.webhookToken}`
                          : null;
                        const verifyToken = rule.webhookToken || null;
                        const isMetaRule = rule.sourceType === "meta_lead_ads";
                        return (
                        <Card key={rule.id} data-testid={`card-rule-${rule.id}`} className="border">
                          <CardContent className="p-4 space-y-3">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</span>
                                <Badge variant="secondary" data-testid={`badge-rule-source-${rule.id}`}>
                                  {getSourceTypeLabel(rule.sourceType)}
                                </Badge>
                                {rule.isActive ? (
                                  <Badge variant="default" data-testid={`badge-rule-status-${rule.id}`}>Active</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-rule-status-${rule.id}`}>Inactive</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {rule.assignmentStrategy === "round_robin" ? "· Round Robin" : "· Specific Employees"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditRule(rule)}
                                  data-testid={`button-edit-rule-${rule.id}`}
                                  title="Edit rule"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Delete this lead capture rule?")) {
                                      deleteRuleMutation.mutate(rule.id);
                                    }
                                  }}
                                  data-testid={`button-delete-rule-${rule.id}`}
                                  title="Delete rule"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>

                            {/* Webhook URL + Verify Token — prominent copy boxes */}
                            {webhookUrl && (
                              <div className="rounded-lg border bg-slate-50 p-3 space-y-2.5">
                                {isMetaRule && (
                                  <p className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                                    <Link2 className="h-3 w-3" />
                                    Meta Developer Portal · Webhooks setup
                                  </p>
                                )}

                                {/* Callback / Webhook URL */}
                                <div className="space-y-1">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {isMetaRule ? "① Callback URL" : "Webhook URL"}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <code
                                      className="flex-1 text-[11px] font-mono bg-white border rounded px-2 py-1.5 truncate text-foreground"
                                      data-testid={`text-rule-webhook-${rule.id}`}
                                    >
                                      {webhookUrl}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs shrink-0"
                                      onClick={() => copyWebhookUrl(rule.webhookToken!)}
                                      data-testid={`button-copy-webhook-${rule.id}`}
                                    >
                                      <Copy className="h-3 w-3 mr-1" /> Copy
                                    </Button>
                                  </div>
                                </div>

                                {/* Verify Token (Meta only) */}
                                {isMetaRule && verifyToken && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                      ② Verify Token
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <code className="flex-1 text-[11px] font-mono bg-white border rounded px-2 py-1.5 truncate text-foreground">
                                        {verifyToken}
                                      </code>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs shrink-0"
                                        onClick={() => {
                                          navigator.clipboard.writeText(verifyToken);
                                          toast({ title: "Verify Token copied to clipboard" });
                                        }}
                                        data-testid={`button-copy-verifytoken-${rule.id}`}
                                      >
                                        <Copy className="h-3 w-3 mr-1" /> Copy
                                      </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      Paste ① as "Callback URL" and ② as "Verify Token" in Meta → Webhooks → Subscribe to Page → leadgen
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={configDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-config-dialog-title">
              {editingConnector ? "Update" : "Configure"} {selectedPlatform?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPlatform && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedPlatform.description}</p>
              {selectedPlatform.credentialFields.filter(f => f.key !== "webhookUrl").map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{field.label}</Label>
                  {field.type === "password" ? (
                    <div className="relative">
                      <Input
                        type={showCredFields[field.key] ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={credentialValues[field.key] || ""}
                        onChange={(e) => setCredentialValues({ ...credentialValues, [field.key]: e.target.value })}
                        className="pr-10"
                        data-testid={`input-cred-${field.key}`}
                      />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCredFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))} tabIndex={-1} data-testid={`button-toggle-cred-${field.key}`}>
                        {showCredFields[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={credentialValues[field.key] || ""}
                      onChange={(e) => setCredentialValues({ ...credentialValues, [field.key]: e.target.value })}
                      data-testid={`input-cred-${field.key}`}
                    />
                  )}
                </div>
              ))}

              {selectedPlatform.id === "callyzer" && editingConnector && editingConnector.status === "connected" && (
                <CallyzerWebhookPanel connector={editingConnector} />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-config">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-config"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</>
              ) : (
                editingConnector ? "Save & Test Connection" : "Save & Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!metricsDialog} onOpenChange={(open) => { if (!open) setMetricsDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-insights-dialog-title">
              {metricsDialog && (() => {
                const tmpl = PLATFORM_TEMPLATES.find((t) => t.id === metricsDialog.platform);
                return tmpl?.name || metricsDialog.displayName;
              })()}
              {" "} - Live Insights
            </DialogTitle>
          </DialogHeader>
          {metricsDialog?.metricsCache && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(metricsDialog.metricsCache).map(([key, value]) => {
                  const meta = METRIC_LABELS[key];
                  if (!meta) return null;
                  const MetricIcon = meta.icon;
                  return (
                    <Card key={key} className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <MetricIcon className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">{meta.label}</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid={`text-detail-metric-${key}`}>
                        {meta.format(value as number)}
                      </p>
                    </Card>
                  );
                })}
              </div>
              {metricsDialog.lastSyncAt && (
                <p className="text-xs text-muted-foreground text-center">
                  Data as of {new Date(metricsDialog.lastSyncAt).toLocaleString()}
                </p>
              )}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    syncMutation.mutate(metricsDialog.id);
                    setTimeout(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] }).then(() => {
                        const updated = connectors.find((c) => c.id === metricsDialog.id);
                        if (updated) setMetricsDialog(updated);
                      });
                    }, 2500);
                  }}
                  disabled={syncMutation.isPending}
                  data-testid="button-refresh-insights"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialog} onOpenChange={(open) => { if (!open) closeRuleDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-rule-dialog-title">
              {editingRule ? "Edit Lead Capture Rule" : "New Lead Capture Rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {editingRule?.webhookToken && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-xs flex-1 truncate" data-testid="text-webhook-url">
                  {`${window.location.origin}/api/webhook/lead-capture/${editingRule.webhookToken}`}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyWebhookUrl(editingRule.webhookToken!)}
                  data-testid="button-copy-rule-webhook"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Rule Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    placeholder="e.g. Facebook Lead Ads"
                    data-testid="input-rule-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Source Type *</Label>
                  <SearchableSelect
                    value={ruleForm.sourceType}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, sourceType: v })}
                    options={SOURCE_TYPE_OPTIONS}
                    placeholder="Select source type"
                    data-testid="select-rule-source-type"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Source Page/Form</Label>
                  <Input
                    value={ruleForm.sourcePage}
                    onChange={(e) => setRuleForm({ ...ruleForm, sourcePage: e.target.value })}
                    placeholder="Optional page or form identifier"
                    data-testid="input-rule-source-page"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Active</Label>
                  <SearchableSelect
                    value={ruleForm.isActive}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, isActive: v })}
                    options={ACTIVE_OPTIONS}
                    placeholder="Select status"
                    data-testid="select-rule-active"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Assignment</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Assignment Strategy</Label>
                  <SearchableSelect
                    value={ruleForm.assignmentStrategy}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, assignmentStrategy: v })}
                    options={ASSIGNMENT_STRATEGY_OPTIONS}
                    placeholder="Select strategy"
                    data-testid="select-rule-assignment-strategy"
                  />
                </div>
                {ruleForm.assignmentStrategy === "specific_employees" && (
                  <div className="space-y-1.5">
                    <Label>Select Employees</Label>
                    <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1" data-testid="list-rule-employees">
                      {crmUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No active users found</p>
                      ) : (
                        crmUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent"
                            data-testid={`checkbox-employee-${user.id}`}
                          >
                            <Checkbox
                              checked={ruleForm.assignToEmployeeIds.includes(user.id)}
                              onCheckedChange={() => toggleEmployee(user.id)}
                            />
                            <span>{user.fullName}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{user.email}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Duplicate Handling</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Assign To Option</Label>
                  <SearchableSelect
                    value={ruleForm.duplicatePhoneAction}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, duplicatePhoneAction: v })}
                    options={DUPLICATE_PHONE_OPTIONS}
                    placeholder="Select option"
                    data-testid="select-rule-duplicate-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Lead Option</Label>
                  <SearchableSelect
                    value={ruleForm.duplicateLeadOption}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, duplicateLeadOption: v })}
                    options={DUPLICATE_LEAD_OPTIONS}
                    placeholder="Select option"
                    data-testid="select-rule-duplicate-lead"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tags Option</Label>
                  <SearchableSelect
                    value={ruleForm.duplicateTagsOption}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, duplicateTagsOption: v })}
                    options={DUPLICATE_TAGS_OPTIONS}
                    placeholder="Select option"
                    data-testid="select-rule-duplicate-tags"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Defaults</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Default Lead Status</Label>
                  <SearchableSelect
                    value={ruleForm.defaultLeadStatus}
                    onValueChange={(v) => setRuleForm({ ...ruleForm, defaultLeadStatus: v })}
                    options={LEAD_STATUS_OPTIONS}
                    placeholder="Select status"
                    data-testid="select-rule-lead-status"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Tags</Label>
                  <Input
                    value={ruleForm.defaultTags}
                    onChange={(e) => setRuleForm({ ...ruleForm, defaultTags: e.target.value })}
                    placeholder="tag1, tag2, tag3"
                    data-testid="input-rule-default-tags"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-rule-map-call-logs">
                <Checkbox
                  checked={ruleForm.mapCallLogs}
                  onCheckedChange={(checked) => setRuleForm({ ...ruleForm, mapCallLogs: !!checked })}
                />
                <span className="text-sm">Map Call Logs</span>
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Field Mapping</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {importFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      value={ruleForm.fieldMapping[field.key] || ""}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          fieldMapping: { ...ruleForm.fieldMapping, [field.key]: e.target.value },
                        })
                      }
                      placeholder={`Source field for ${field.label}`}
                      data-testid={`input-field-mapping-${field.key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRuleDialog} data-testid="button-cancel-rule">
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
              data-testid="button-save-rule"
            >
              {createRuleMutation.isPending || updateRuleMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</>
              ) : (
                editingRule ? "Update Rule" : "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
