import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LEAD_STATUSES } from "@/lib/lead-status";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ArrowLeft, Link2, Key, Eye, Download, RefreshCw,
  Plus, Zap, Play, Trash2, RotateCcw, Clock, TrendingUp,
} from "lucide-react";

interface ImportField { key: string; label: string; required?: boolean; }
interface ImportResult {
  totalRows: number; successCount: number; duplicateCount: number;
  updatedCount: number; failureCount: number; errors?: { row: number; message: string }[];
}
interface SyncConfig {
  id: number; name: string; spreadsheetId: string; sheetName: string;
  columnMapping: Record<string, string>; duplicateStrategy: string;
  defaultLeadStatus: string; defaultTags?: string; isActive: boolean;
  lastSyncedRow?: number; lastSyncedAt?: string; lastSyncStatus?: string;
  lastSyncLeadsCreated?: number; lastSyncLeadsSkipped?: number; lastSyncMessage?: string;
  apiKeyMasked?: string; createdAt: string;
}

const CRM_FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true },
  { key: "phoneE164", label: "Phone Number", required: true },
  { key: "email", label: "Email" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags" },
  { key: "utmSource", label: "UTM Source" },
  { key: "utmMedium", label: "UTM Medium" },
  { key: "utmCampaign", label: "UTM Campaign" },
  { key: "utmTerm", label: "UTM Term" },
  { key: "utmContent", label: "UTM Content" },
  { key: "priority", label: "Priority" },
  { key: "city", label: "City" },
  { key: "leadSource", label: "Lead Source" },
  { key: "callSummary", label: "Call Summary" },
  { key: "companyName", label: "Company Name" },
];

const DEDUP_OPTIONS = [
  { value: "skip", label: "Skip Duplicates" },
  { value: "update_blank", label: "Update Blank Fields Only" },
  { value: "overwrite", label: "Overwrite All Fields" },
];

function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of CRM_FIELDS) {
    const match = headers.find(h =>
      h.toLowerCase().replace(/[\s_-]/g, "") === field.key.toLowerCase().replace(/[\s_-]/g, "") ||
      h.toLowerCase().includes(field.label.toLowerCase()) ||
      field.label.toLowerCase().includes(h.toLowerCase())
    );
    if (match) mapping[field.key] = match;
  }
  const phoneH = headers.find(h => /phone|mobile|contact|number/i.test(h));
  if (phoneH && !mapping.phoneE164) mapping.phoneE164 = phoneH;
  const nameH = headers.find(h => /name|patient|full/i.test(h));
  if (nameH && !mapping.name) mapping.name = nameH;
  const emailH = headers.find(h => /email|mail/i.test(h));
  if (emailH && !mapping.email) mapping.email = emailH;
  return mapping;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GoogleSheetsImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual");

  // --- Manual Import State ---
  const [step, setStep] = useState<"connect" | "map" | "preview" | "result">("connect");
  const [sheetUrl, setSheetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState("skip");
  const [defaultLeadStatus, setDefaultLeadStatus] = useState("Raw Lead Captured");
  const [defaultTags, setDefaultTags] = useState("");
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // --- Auto-Sync State ---
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addStep, setAddStep] = useState<"connect" | "map">("connect");
  const [addSheetUrl, setAddSheetUrl] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [addSpreadsheetId, setAddSpreadsheetId] = useState("");
  const [addSheets, setAddSheets] = useState<string[]>([]);
  const [addSelectedSheet, setAddSelectedSheet] = useState("");
  const [addHeaders, setAddHeaders] = useState<string[]>([]);
  const [addMapping, setAddMapping] = useState<Record<string, string>>({});
  const [addDedupStrategy, setAddDedupStrategy] = useState("skip");
  const [addDefaultStatus, setAddDefaultStatus] = useState("Raw Lead Captured");
  const [addDefaultTags, setAddDefaultTags] = useState("");
  const [syncConfigName, setSyncConfigName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // --- Queries ---
  const syncConfigsQuery = useQuery<SyncConfig[]>({
    queryKey: ["/api/google-sheets/sync-configs"],
    enabled: activeTab === "auto",
  });

  // --- Manual Import Mutations ---
  const fetchHeadersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/headers", { sheetUrl, apiKey });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHeaders(data.headers); setSheetTitle(data.sheetTitle);
      setSheets(data.sheets || []); setSpreadsheetId(data.spreadsheetId);
      setSelectedSheet(data.selectedSheet || data.sheets?.[0] || "Sheet1");
      setColumnMapping(autoMapHeaders(data.headers));
      setStep("map");
      toast({ title: "Sheet connected!", description: `Found ${data.headers.length} columns in "${data.sheetTitle}"` });
    },
    onError: (err: any) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const refetchHeadersMutation = useMutation({
    mutationFn: async (newSheet: string) => {
      const res = await apiRequest("POST", "/api/google-sheets/preview", { spreadsheetId, apiKey, sheetName: newSheet });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.rows?.length > 0) {
        const newHeaders = data.rows[0] as string[];
        setHeaders(newHeaders); setColumnMapping(autoMapHeaders(newHeaders));
        toast({ title: "Sheet tab changed", description: `Found ${newHeaders.length} columns` });
      }
    },
    onError: (err: any) => toast({ title: "Failed to read tab", description: err.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/preview", { spreadsheetId, apiKey, sheetName: selectedSheet });
      return res.json();
    },
    onSuccess: (data: any) => { setPreviewRows(data.rows || []); setStep("preview"); },
    onError: (err: any) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/import", {
        spreadsheetId, apiKey, sheetName: selectedSheet, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags,
      });
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data); setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Import complete!", description: `${data.successCount} leads imported, ${data.duplicateCount} duplicates` });
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  // --- Auto-Sync Mutations ---
  const addConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/headers", { sheetUrl: addSheetUrl, apiKey: addApiKey });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAddHeaders(data.headers); setAddSheets(data.sheets || []);
      setAddSpreadsheetId(data.spreadsheetId);
      setAddSelectedSheet(data.selectedSheet || data.sheets?.[0] || "Sheet1");
      setAddMapping(autoMapHeaders(data.headers));
      setSyncConfigName(data.sheetTitle || "My Auto-Sync");
      setAddStep("map");
      toast({ title: "Sheet connected!", description: `Found ${data.headers.length} columns` });
    },
    onError: (err: any) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const createSyncConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/sync-configs", {
        name: syncConfigName, spreadsheetId: addSpreadsheetId, apiKey: addApiKey,
        sheetName: addSelectedSheet, columnMapping: addMapping,
        duplicateStrategy: addDedupStrategy, defaultLeadStatus: addDefaultStatus,
        defaultTags: addDefaultTags || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      toast({ title: "Auto-Sync created!", description: `"${syncConfigName}" will sync every 30 minutes automatically.` });
      resetAddDialog();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/google-sheets/sync-configs/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] }),
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const deleteSyncConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/google-sheets/sync-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      toast({ title: "Sync config deleted" });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const syncNowMutation = useMutation({
    mutationFn: async (id: number) => {
      setSyncingId(id);
      const res = await apiRequest("POST", `/api/google-sheets/sync-configs/${id}/sync`);
      return res.json();
    },
    onSuccess: (data: any, id: number) => {
      setSyncingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Sync complete", description: data.message });
    },
    onError: (err: any) => {
      setSyncingId(null);
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const resetPositionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/google-sheets/sync-configs/${id}/reset`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      toast({ title: "Position reset", description: data.message });
    },
    onError: (err: any) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  // --- Helpers ---
  const mappedFieldCount = Object.values(columnMapping).filter(Boolean).length;
  const requiredFieldsMapped = CRM_FIELDS.filter(f => f.required).every(f => columnMapping[f.key]);
  const addMappedCount = Object.values(addMapping).filter(Boolean).length;
  const addRequiredMapped = CRM_FIELDS.filter(f => f.required).every(f => addMapping[f.key]);

  function resetAll() {
    setStep("connect"); setSheetUrl(""); setSpreadsheetId(""); setSheetTitle("");
    setSheets([]); setSelectedSheet(""); setHeaders([]); setColumnMapping({});
    setPreviewRows([]); setImportResult(null); setDuplicateStrategy("skip");
    setDefaultLeadStatus("Raw Lead Captured"); setDefaultTags("");
  }

  function resetAddDialog() {
    setShowAddDialog(false); setAddStep("connect"); setAddSheetUrl(""); setAddApiKey("");
    setAddSpreadsheetId(""); setAddSheets([]); setAddSelectedSheet(""); setAddHeaders([]);
    setAddMapping({}); setAddDedupStrategy("skip"); setAddDefaultStatus("Raw Lead Captured");
    setAddDefaultTags(""); setSyncConfigName("");
  }

  const syncConfigs = syncConfigsQuery.data || [];

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-muted to-transparent opacity-50 rounded-bl-full pointer-events-none z-0" />

        {/* Header */}
        <div className="p-4 md:p-6 border-b border-border bg-white/80 backdrop-blur-sm z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2" data-testid="text-page-title">
                <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                Google Sheets Lead Import
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">Import manually or set up automatic sync from a Google Sheet</p>
            </div>
            {activeTab === "manual" && step !== "connect" && (
              <Button variant="outline" onClick={resetAll} data-testid="button-start-over">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            )}
            {activeTab === "auto" && (
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-sync">
                <Plus className="w-4 h-4 mr-2" />
                Add Auto-Sync
              </Button>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mt-4 border-b border-border">
            <button
              onClick={() => setActiveTab("manual")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-manual"
            >
              <Download className="w-4 h-4 inline mr-1.5" />
              Manual Import
            </button>
            <button
              onClick={() => setActiveTab("auto")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "auto" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-auto-sync"
            >
              <Zap className="w-4 h-4 inline mr-1.5" />
              Auto-Sync
              {syncConfigs.filter(c => c.isActive).length > 0 && (
                <Badge className="ml-2 text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-0">
                  {syncConfigs.filter(c => c.isActive).length} active
                </Badge>
              )}
            </button>
          </div>

          {/* Manual import step indicators */}
          {activeTab === "manual" && (
            <div className="flex items-center gap-1 md:gap-2 mt-4 overflow-x-auto">
              {["connect", "map", "preview", "result"].map((s, idx) => (
                <div key={s} className="flex items-center gap-1 md:gap-2 shrink-0">
                  <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? "bg-primary text-white" :
                    ["connect", "map", "preview", "result"].indexOf(step) > idx ? "bg-green-100 text-green-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {["connect", "map", "preview", "result"].indexOf(step) > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] md:text-xs font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                    {s === "connect" ? "Connect" : s === "map" ? "Map" : s === "preview" ? "Preview" : "Result"}
                  </span>
                  {idx < 3 && <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto z-10">

          {/* ===== AUTO-SYNC TAB ===== */}
          {activeTab === "auto" && (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex gap-3">
                <Zap className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-semibold mb-1">How Auto-Sync works</p>
                  <p>The CRM checks your connected Google Sheet every <strong>30 minutes</strong> and pulls any new rows as leads automatically. Meta Lead Ads can push leads directly to a Google Sheet — configure that once in Meta, and leads flow in without any manual work.</p>
                </div>
              </div>

              {syncConfigsQuery.isLoading && (
                <div className="flex justify-center py-16"><LoadingSpinner /></div>
              )}

              {!syncConfigsQuery.isLoading && syncConfigs.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center py-16 text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                      <FileSpreadsheet className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">No auto-sync configured yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add a Google Sheet to start pulling leads automatically every 30 minutes.</p>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-sync">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Auto-Sync
                    </Button>
                  </CardContent>
                </Card>
              )}

              {syncConfigs.map(config => (
                <Card key={config.id} className={`transition-opacity ${config.isActive ? "" : "opacity-60"}`} data-testid={`card-sync-config-${config.id}`}>
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base text-foreground" data-testid={`text-config-name-${config.id}`}>{config.name}</span>
                          <Badge variant="outline" className="text-[10px]">{config.sheetName}</Badge>
                          {config.lastSyncStatus === "success" && (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Synced</Badge>
                          )}
                          {config.lastSyncStatus === "error" && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Error</Badge>
                          )}
                          {!config.lastSyncStatus && (
                            <Badge className="text-[10px] bg-gray-100 text-gray-600 border-0">Not synced yet</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{config.spreadsheetId}</p>

                        <div className="flex flex-wrap gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            Last sync: <span className="text-foreground font-medium">{formatRelativeTime(config.lastSyncedAt)}</span>
                          </div>
                          {config.lastSyncLeadsCreated !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <TrendingUp className="w-3.5 h-3.5" />
                              Last run: <span className="text-green-700 font-medium">+{config.lastSyncLeadsCreated} new</span>
                              {(config.lastSyncLeadsSkipped ?? 0) > 0 && (
                                <span className="text-amber-600">, {config.lastSyncLeadsSkipped} skipped</span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Row position: <span className="font-medium text-foreground">{config.lastSyncedRow ?? 1}</span>
                          </div>
                        </div>
                        {config.lastSyncMessage && config.lastSyncStatus === "error" && (
                          <p className="text-xs text-red-600 mt-2 bg-red-50 rounded px-2 py-1">{config.lastSyncMessage}</p>
                        )}
                      </div>

                      {/* Right: Controls */}
                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap shrink-0">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{config.isActive ? "Active" : "Paused"}</Label>
                          <Switch
                            checked={config.isActive}
                            onCheckedChange={(v) => toggleActiveMutation.mutate({ id: config.id, isActive: v })}
                            data-testid={`switch-active-${config.id}`}
                          />
                        </div>
                        <Button
                          size="sm" variant="outline"
                          disabled={syncingId === config.id}
                          onClick={() => syncNowMutation.mutate(config.id)}
                          data-testid={`button-sync-now-${config.id}`}
                        >
                          {syncingId === config.id
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Syncing...</>
                            : <><Play className="w-3.5 h-3.5 mr-1.5" />Sync Now</>
                          }
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => resetPositionMutation.mutate(config.id)}
                          title="Reset sync position — next sync will re-import all rows"
                          data-testid={`button-reset-${config.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(config.id)}
                          data-testid={`button-delete-${config.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ===== MANUAL IMPORT TAB ===== */}
          {activeTab === "manual" && (
            <>
              {step === "connect" && (
                <Card className="max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-green-600" />
                      Connect to Google Sheet
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                      <p className="font-semibold mb-2">Before you start:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Make sure your Google Sheet is shared as <strong>"Anyone with the link can view"</strong></li>
                        <li>Get a Google API Key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                        <li>Enable the <strong>Google Sheets API</strong> in your Google Cloud project</li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api-key" className="flex items-center gap-1.5"><Key className="w-4 h-4" />Google API Key</Label>
                      <Input id="api-key" type="password" placeholder="AIzaSy..." value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)} data-testid="input-api-key" />
                      <p className="text-xs text-muted-foreground">Your API key is not stored — it's used only for this session.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sheet-url" className="flex items-center gap-1.5"><Link2 className="w-4 h-4" />Google Sheet URL</Label>
                      <Input id="sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)} data-testid="input-sheet-url" />
                    </div>
                    <Button className="w-full" disabled={!sheetUrl || !apiKey || fetchHeadersMutation.isPending}
                      onClick={() => fetchHeadersMutation.mutate()} data-testid="button-connect-sheet">
                      {fetchHeadersMutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
                        : <><FileSpreadsheet className="w-4 h-4 mr-2" />Connect & Read Headers</>
                      }
                    </Button>
                  </CardContent>
                </Card>
              )}

              {step === "map" && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />{sheetTitle}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">{headers.length} columns found</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {sheets.length > 1 && (
                        <div className="mb-6">
                          <Label className="mb-2 block">Select Sheet Tab</Label>
                          <SearchableSelect value={selectedSheet}
                            onValueChange={(v) => { setSelectedSheet(v); refetchHeadersMutation.mutate(v); }}
                            options={sheets.map(s => ({ value: s, label: s }))} placeholder="Choose sheet..."
                            data-testid="select-sheet-tab" />
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Column Mapping</h3>
                          <Badge variant={requiredFieldsMapped ? "default" : "destructive"} className="text-xs">
                            {mappedFieldCount} of {CRM_FIELDS.length} fields mapped
                          </Badge>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow><TableHead className="w-[200px]">CRM Field</TableHead><TableHead>Sheet Column</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                              {CRM_FIELDS.map(field => (
                                <TableRow key={field.key}>
                                  <TableCell className="font-medium">
                                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                                  </TableCell>
                                  <TableCell>
                                    <SearchableSelect value={columnMapping[field.key] || ""}
                                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [field.key]: v === "__none__" ? "" : v }))}
                                      options={[{ value: "__none__", label: "— Not Mapped —" }, ...headers.map(h => ({ value: h, label: h }))]}
                                      placeholder="Select column..." triggerClassName="w-full"
                                      data-testid={`select-mapping-${field.key}`} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="space-y-2">
                          <Label>Duplicate Handling</Label>
                          <SearchableSelect value={duplicateStrategy} onValueChange={setDuplicateStrategy}
                            options={DEDUP_OPTIONS} placeholder="Strategy..." data-testid="select-dedup-strategy" />
                        </div>
                        <div className="space-y-2">
                          <Label>Default Lead Status</Label>
                          <SearchableSelect value={defaultLeadStatus} onValueChange={setDefaultLeadStatus}
                            options={LEAD_STATUSES.map(s => ({ value: s, label: s }))} placeholder="Status..." data-testid="select-default-status" />
                        </div>
                        <div className="space-y-2">
                          <Label>Default Tags</Label>
                          <Input value={defaultTags} onChange={(e) => setDefaultTags(e.target.value)}
                            placeholder="google-sheets, campaign-1" data-testid="input-default-tags" />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={() => setStep("connect")} data-testid="button-back-connect">
                          <ArrowLeft className="w-4 h-4 mr-2" />Back
                        </Button>
                        <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} data-testid="button-preview">
                          {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                          Preview Data
                        </Button>
                        <Button className="flex-1" disabled={!requiredFieldsMapped || importMutation.isPending}
                          onClick={() => importMutation.mutate()} data-testid="button-import-leads">
                          {importMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                            : <><Download className="w-4 h-4 mr-2" />Import Leads to CRM</>
                          }
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {step === "preview" && (
                <div className="max-w-6xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />Data Preview (first {previewRows.length - 1} rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {previewRows.length > 0 && (
                        <div className="border rounded-lg overflow-auto max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                {previewRows[0].map((header, idx) => (
                                  <TableHead key={idx} className="whitespace-nowrap">
                                    {header}
                                    {Object.entries(columnMapping).some(([_, v]) => v === header) && (
                                      <Badge variant="outline" className="ml-1 text-[10px]">
                                        {CRM_FIELDS.find(f => columnMapping[f.key] === header)?.label}
                                      </Badge>
                                    )}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.slice(1).map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                  <TableCell className="text-muted-foreground text-xs">{rowIdx + 1}</TableCell>
                                  {previewRows[0].map((_, colIdx) => (
                                    <TableCell key={colIdx} className="text-sm whitespace-nowrap">{row[colIdx] || ""}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={() => setStep("map")} data-testid="button-back-map">
                          <ArrowLeft className="w-4 h-4 mr-2" />Back to Mapping
                        </Button>
                        <Button className="flex-1" disabled={!requiredFieldsMapped || importMutation.isPending}
                          onClick={() => importMutation.mutate()} data-testid="button-import-from-preview">
                          {importMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                            : <><Download className="w-4 h-4 mr-2" />Import All Leads to CRM</>
                          }
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {step === "result" && importResult && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {importResult.failureCount === 0
                          ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                          : <AlertTriangle className="w-6 h-6 text-amber-500" />
                        }
                        Import Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-2xl font-bold">{importResult.totalRows}</div>
                          <div className="text-xs text-muted-foreground">Total Rows</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-700">{importResult.successCount}</div>
                          <div className="text-xs text-green-600">Imported</div>
                        </div>
                        <div className="text-center p-4 bg-amber-50 rounded-lg">
                          <div className="text-2xl font-bold text-amber-700">{importResult.duplicateCount}</div>
                          <div className="text-xs text-amber-600">Duplicates</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-700">{importResult.updatedCount}</div>
                          <div className="text-xs text-blue-600">Updated</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <div className="text-2xl font-bold text-red-700">{importResult.failureCount}</div>
                          <div className="text-xs text-red-600">Failed</div>
                        </div>
                      </div>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow><TableHead className="w-20">Row</TableHead><TableHead>Error</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                              {importResult.errors.map((err, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-sm">{err.row}</TableCell>
                                  <TableCell className="text-sm text-red-600">{err.message}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={resetAll} data-testid="button-import-another">
                          <RefreshCw className="w-4 h-4 mr-2" />Import Another Sheet
                        </Button>
                        <Button onClick={() => window.location.href = "/leads"} data-testid="button-go-to-leads">
                          View Leads<ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== ADD AUTO-SYNC DIALOG ===== */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetAddDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              {addStep === "connect" ? "Connect Sheet for Auto-Sync" : "Map Columns & Save"}
            </DialogTitle>
            <DialogDescription>
              {addStep === "connect"
                ? "Connect a Google Sheet that Meta (or any source) pushes leads to. The CRM will check for new rows every 30 minutes."
                : "Map the sheet columns to CRM fields, then give this sync a name and save it."
              }
            </DialogDescription>
          </DialogHeader>

          {addStep === "connect" && (
            <div className="space-y-5 mt-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-semibold mb-1">Your API key will be stored securely (encrypted)</p>
                <p>It is used by the background sync job to read new rows from your sheet automatically.</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Key className="w-4 h-4" />Google API Key</Label>
                <Input type="password" placeholder="AIzaSy..." value={addApiKey}
                  onChange={(e) => setAddApiKey(e.target.value)} data-testid="input-add-api-key" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Link2 className="w-4 h-4" />Google Sheet URL</Label>
                <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={addSheetUrl}
                  onChange={(e) => setAddSheetUrl(e.target.value)} data-testid="input-add-sheet-url" />
              </div>
              <Button className="w-full" disabled={!addSheetUrl || !addApiKey || addConnectMutation.isPending}
                onClick={() => addConnectMutation.mutate()} data-testid="button-add-connect">
                {addConnectMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
                  : <><FileSpreadsheet className="w-4 h-4 mr-2" />Connect & Read Headers</>
                }
              </Button>
            </div>
          )}

          {addStep === "map" && (
            <div className="space-y-5 mt-2">
              {/* Sync name */}
              <div className="space-y-2">
                <Label className="font-semibold">Sync Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Meta Lead Ads — Facebook" value={syncConfigName}
                  onChange={(e) => setSyncConfigName(e.target.value)} data-testid="input-sync-name" />
              </div>

              {/* Sheet tab selector */}
              {addSheets.length > 1 && (
                <div className="space-y-2">
                  <Label>Sheet Tab</Label>
                  <SearchableSelect value={addSelectedSheet}
                    onValueChange={setAddSelectedSheet}
                    options={addSheets.map(s => ({ value: s, label: s }))}
                    placeholder="Choose tab..." data-testid="select-add-sheet-tab" />
                </div>
              )}

              {/* Column mapping */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-semibold">Column Mapping</Label>
                  <Badge variant={addRequiredMapped ? "default" : "destructive"} className="text-xs">
                    {addMappedCount} of {CRM_FIELDS.length} mapped
                  </Badge>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="w-[180px]">CRM Field</TableHead><TableHead>Sheet Column</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {CRM_FIELDS.map(field => (
                        <TableRow key={field.key}>
                          <TableCell className="font-medium text-sm">
                            {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                          </TableCell>
                          <TableCell>
                            <SearchableSelect value={addMapping[field.key] || ""}
                              onValueChange={(v) => setAddMapping(prev => ({ ...prev, [field.key]: v === "__none__" ? "" : v }))}
                              options={[{ value: "__none__", label: "— Not Mapped —" }, ...addHeaders.map(h => ({ value: h, label: h }))]}
                              placeholder="Select column..." triggerClassName="w-full"
                              data-testid={`select-add-mapping-${field.key}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Duplicate Handling</Label>
                  <SearchableSelect value={addDedupStrategy} onValueChange={setAddDedupStrategy}
                    options={DEDUP_OPTIONS} placeholder="Strategy..." data-testid="select-add-dedup" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Default Lead Status</Label>
                  <SearchableSelect value={addDefaultStatus} onValueChange={setAddDefaultStatus}
                    options={LEAD_STATUSES.map(s => ({ value: s, label: s }))} placeholder="Status..." data-testid="select-add-status" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Default Tags</Label>
                  <Input value={addDefaultTags} onChange={(e) => setAddDefaultTags(e.target.value)}
                    placeholder="meta, facebook" data-testid="input-add-tags" />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <Button variant="outline" onClick={() => setAddStep("connect")} data-testid="button-add-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />Back
                </Button>
                <Button className="flex-1"
                  disabled={!addRequiredMapped || !syncConfigName.trim() || createSyncConfigMutation.isPending}
                  onClick={() => createSyncConfigMutation.mutate()}
                  data-testid="button-save-sync-config">
                  {createSyncConfigMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    : <><Zap className="w-4 h-4 mr-2" />Save Auto-Sync</>
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auto-Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop automatic syncing from this sheet. No leads already imported will be affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteSyncConfigMutation.mutate(deleteConfirmId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
