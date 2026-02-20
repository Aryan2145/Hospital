import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Plus, Settings, RefreshCw, Trash2, CheckCircle2, XCircle,
  Wifi, WifiOff, ArrowUpRight, BarChart3, Eye, MousePointerClick,
  DollarSign, Target, Loader2, Zap, Globe, TrendingUp,
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
];

const METRIC_LABELS: Record<string, { label: string; icon: any; format: (v: number) => string }> = {
  impressions: { label: "Impressions", icon: Eye, format: (v) => v.toLocaleString() },
  clicks: { label: "Clicks", icon: MousePointerClick, format: (v) => v.toLocaleString() },
  spend: { label: "Spend", icon: DollarSign, format: (v) => `$${v.toLocaleString()}` },
  ctr: { label: "CTR", icon: TrendingUp, format: (v) => `${v.toFixed(2)}%` },
  conversions: { label: "Conversions", icon: Target, format: (v) => v.toLocaleString() },
  cpc: { label: "CPC", icon: DollarSign, format: (v) => `$${v.toFixed(2)}` },
};

export default function ConnectorsPage() {
  const { toast } = useToast();
  const [configDialog, setConfigDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTemplate | null>(null);
  const [editingConnector, setEditingConnector] = useState<PlatformConnector | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [metricsDialog, setMetricsDialog] = useState<PlatformConnector | null>(null);

  const { data: connectors = [], isLoading } = useQuery<PlatformConnector[]>({
    queryKey: ["/api/connectors"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/connectors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector configured successfully" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/connectors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Connector updated" });
      closeDialog();
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

  function closeDialog() {
    setConfigDialog(false);
    setSelectedPlatform(null);
    setEditingConnector(null);
    setCredentialValues({});
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
    <div className="flex h-screen" data-testid="connectors-page">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Connectors</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect marketing platforms to draw live insights and campaign performance data
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
            </>
          )}
        </div>
      </main>

      <Dialog open={configDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-config-dialog-title">
              {editingConnector ? "Update" : "Configure"} {selectedPlatform?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPlatform && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedPlatform.description}</p>
              {selectedPlatform.credentialFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentialValues[field.key] || ""}
                    onChange={(e) => setCredentialValues({ ...credentialValues, [field.key]: e.target.value })}
                    data-testid={`input-cred-${field.key}`}
                  />
                </div>
              ))}
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
                editingConnector ? "Update Configuration" : "Save & Connect"
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
    </div>
  );
}
