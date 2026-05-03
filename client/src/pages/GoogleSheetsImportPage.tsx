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
  FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, ArrowLeft, Link2, Eye, Download, RefreshCw,
  Plus, Zap, Play, Trash2, RotateCcw, Clock, TrendingUp,
  Share2, Copy, ExternalLink,
} from "lucide-react";

interface ImportResult {
  totalRows: number; successCount: number; duplicateCount: number;
  updatedCount: number; failureCount: number; skippedCount?: number; errors?: { row: number; message: string }[];
}
interface SyncConfig {
  id: number; name: string; spreadsheetId: string; sheetGid?: string; sheetName: string;
  columnMapping: Record<string, string>; duplicateStrategy: string;
  defaultLeadStatus: string; defaultTags?: string; isActive: boolean;
  lastSyncedRow?: number; lastSyncedAt?: string; lastSyncStatus?: string;
  lastSyncLeadsCreated?: number; lastSyncLeadsSkipped?: number; lastSyncMessage?: string;
  createdAt: string;
}

const CRM_FIELDS = [
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

const META_NON_NAME_COLS = /\b(ad|form|campaign|adset|brand|product|company)[\s_]?name\b/i;

function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of CRM_FIELDS) {
    const match = headers.find(h => {
      if (field.key === "name" && META_NON_NAME_COLS.test(h)) return false;
      return (
        h.toLowerCase().replace(/[\s_-]/g, "") === field.key.toLowerCase().replace(/[\s_-]/g, "") ||
        h.toLowerCase().includes(field.label.toLowerCase()) ||
        field.label.toLowerCase().includes(h.toLowerCase())
      );
    });
    if (match) mapping[field.key] = match;
  }
  const phoneH = headers.find(h => /phone|mobile|contact|number/i.test(h));
  if (phoneH && !mapping.phoneE164) mapping.phoneE164 = phoneH;
  const fullNameH = headers.find(h => h.toLowerCase().replace(/[\s_]/g, "") === "fullname");
  if (fullNameH) mapping.name = fullNameH;
  else if (!mapping.name) {
    const nameH = headers.find(h => /\bname\b|\bpatient\b/i.test(h) && !META_NON_NAME_COLS.test(h));
    if (nameH) mapping.name = nameH;
  }
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

function HowToShareBanner() {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900 space-y-3">
      <p className="font-semibold flex items-center gap-2">
        <Share2 className="w-4 h-4" /> One-time setup: make your sheet public
      </p>
      <ol className="list-decimal list-inside space-y-1.5 text-green-800">
        <li>Open your Google Sheet in the browser</li>
        <li>Click <strong>Share</strong> (top-right) → <strong>Change to anyone with the link</strong> → set to <strong>Viewer</strong></li>
        <li>If you want a specific tab, click that tab first — the URL updates automatically</li>
        <li>Copy the full URL from the browser address bar and paste it below</li>
      </ol>
      <p className="text-xs text-green-700">No API keys. No Google Cloud setup. Just paste and go.</p>
    </div>
  );
}

export default function GoogleSheetsImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual");

  // --- Manual Import State ---
  const [step, setStep] = useState<"connect" | "map" | "preview" | "result">("connect");
  const [sheetUrl, setSheetUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetGid, setSheetGid] = useState<string | null>(null);
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
  const [addSpreadsheetId, setAddSpreadsheetId] = useState("");
  const [addSheetGid, setAddSheetGid] = useState<string | null>(null);
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
      const res = await apiRequest("POST", "/api/google-sheets/headers", { sheetUrl });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHeaders(data.headers);
      setSpreadsheetId(data.spreadsheetId);
      setSheetGid(data.gid || null);
      setColumnMapping(autoMapHeaders(data.headers));
      setStep("map");
      toast({ title: "Sheet connected!", description: `Found ${data.headers.length} columns` });
    },
    onError: (err: any) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/preview", { spreadsheetId, gid: sheetGid });
      return res.json();
    },
    onSuccess: (data: any) => { setPreviewRows(data.rows || []); setStep("preview"); },
    onError: (err: any) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/import", {
        spreadsheetId, gid: sheetGid, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags,
      });
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data); setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Import complete!", description: `${data.successCount} leads imported` });
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  // --- Auto-Sync Mutations ---
  const addConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/headers", { sheetUrl: addSheetUrl });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAddHeaders(data.headers);
      setAddSpreadsheetId(data.spreadsheetId);
      setAddSheetGid(data.gid || null);
      setAddMapping(autoMapHeaders(data.headers));
      setSyncConfigName("My Auto-Sync");
      setAddStep("map");
      toast({ title: "Sheet connected!", description: `Found ${data.headers.length} columns` });
    },
    onError: (err: any) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const createSyncConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/sync-configs", {
        name: syncConfigName, spreadsheetId: addSpreadsheetId, gid: addSheetGid,
        columnMapping: addMapping, duplicateStrategy: addDedupStrategy,
        defaultLeadStatus: addDefaultStatus, defaultTags: addDefaultTags || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      toast({ title: "Auto-Sync created!", description: `"${syncConfigName}" will pull new leads every 30 minutes.` });
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
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/google-sheets/sync-configs/${id}`); },
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
    onSuccess: (data: any) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-sheets/sync-configs"] });
      toast({ title: "Position reset", description: "Next sync will re-import from the beginning." });
    },
    onError: (err: any) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  // --- Helpers ---
  const requiredFieldsMapped = CRM_FIELDS.filter(f => f.required).every(f => columnMapping[f.key]);
  const mappedCount = Object.values(columnMapping).filter(Boolean).length;
  const addRequiredMapped = CRM_FIELDS.filter(f => f.required).every(f => addMapping[f.key]);
  const addMappedCount = Object.values(addMapping).filter(Boolean).length;

  function resetAll() {
    setStep("connect"); setSheetUrl(""); setSpreadsheetId(""); setSheetGid(null);
    setHeaders([]); setColumnMapping({}); setPreviewRows([]); setImportResult(null);
    setDuplicateStrategy("skip"); setDefaultLeadStatus("Raw Lead Captured"); setDefaultTags("");
  }

  function resetAddDialog() {
    setShowAddDialog(false); setAddStep("connect"); setAddSheetUrl(""); setAddSpreadsheetId("");
    setAddSheetGid(null); setAddHeaders([]); setAddMapping({}); setAddDedupStrategy("skip");
    setAddDefaultStatus("Raw Lead Captured"); setAddDefaultTags(""); setSyncConfigName("");
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
              <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
                <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                Google Sheets Lead Import
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">Paste a shared Google Sheet link — no API keys needed</p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "manual" && step !== "connect" && (
                <Button variant="outline" size="sm" onClick={resetAll} data-testid="button-start-over">
                  <RefreshCw className="w-4 h-4 mr-2" />Start Over
                </Button>
              )}
              {activeTab === "auto" && (
                <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-sync">
                  <Plus className="w-4 h-4 mr-2" />Add Auto-Sync
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-border">
            <button onClick={() => setActiveTab("manual")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-manual">
              <Download className="w-4 h-4 inline mr-1.5" />One-Time Import
            </button>
            <button onClick={() => setActiveTab("auto")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "auto" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-auto-sync">
              <Zap className="w-4 h-4 inline mr-1.5" />Auto-Sync (30 min)
              {syncConfigs.filter(c => c.isActive).length > 0 && (
                <Badge className="ml-2 text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-0">
                  {syncConfigs.filter(c => c.isActive).length} active
                </Badge>
              )}
            </button>
          </div>

          {/* Step bar for manual */}
          {activeTab === "manual" && (
            <div className="flex items-center gap-1 md:gap-2 mt-4">
              {(["connect", "map", "preview", "result"] as const).map((s, idx) => {
                const steps = ["connect", "map", "preview", "result"];
                const done = steps.indexOf(step) > idx;
                const active = step === s;
                return (
                  <div key={s} className="flex items-center gap-1 md:gap-2 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-primary text-white" : done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[10px] md:text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {s === "connect" ? "Paste URL" : s === "map" ? "Map" : s === "preview" ? "Preview" : "Done"}
                    </span>
                    {idx < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto z-10">

          {/* ===== AUTO-SYNC TAB ===== */}
          {activeTab === "auto" && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex gap-3">
                <Zap className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-semibold mb-1">How it works</p>
                  <p>The CRM checks your Google Sheet every <strong>30 minutes</strong> and pulls any new rows as leads. Perfect for Meta Lead Ads — set Meta to push leads to a Google Sheet once, and leads flow into the CRM automatically without any manual exports.</p>
                </div>
              </div>

              {syncConfigsQuery.isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}

              {!syncConfigsQuery.isLoading && syncConfigs.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center py-16 text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                      <FileSpreadsheet className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">No auto-syncs yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add a Google Sheet and the CRM will pull new rows every 30 minutes.</p>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-sync">
                      <Plus className="w-4 h-4 mr-2" />Add Your First Auto-Sync
                    </Button>
                  </CardContent>
                </Card>
              )}

              {syncConfigs.map(config => (
                <Card key={config.id} className={config.isActive ? "" : "opacity-60"} data-testid={`card-sync-config-${config.id}`}>
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" data-testid={`text-config-name-${config.id}`}>{config.name}</span>
                          {config.sheetGid && <Badge variant="outline" className="text-[10px] font-mono">tab #{config.sheetGid}</Badge>}
                          {config.lastSyncStatus === "success" && <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Synced</Badge>}
                          {config.lastSyncStatus === "error" && <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Error</Badge>}
                          {!config.lastSyncStatus && <Badge className="text-[10px] bg-gray-100 text-gray-600 border-0">Pending first sync</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-1">{config.spreadsheetId}</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />Last: <strong className="text-foreground">{formatRelativeTime(config.lastSyncedAt)}</strong>
                          </span>
                          {config.lastSyncLeadsCreated !== undefined && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span className="text-green-700 font-medium">+{config.lastSyncLeadsCreated} new</span>
                              {(config.lastSyncLeadsSkipped ?? 0) > 0 && <span className="text-amber-600">, {config.lastSyncLeadsSkipped} skipped</span>}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">Row: <strong className="text-foreground">{config.lastSyncedRow ?? 1}</strong></span>
                        </div>
                        {config.lastSyncStatus === "error" && config.lastSyncMessage && (
                          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-2">{config.lastSyncMessage}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap md:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{config.isActive ? "Active" : "Paused"}</Label>
                          <Switch checked={config.isActive}
                            onCheckedChange={v => toggleActiveMutation.mutate({ id: config.id, isActive: v })}
                            data-testid={`switch-active-${config.id}`} />
                        </div>
                        <Button size="sm" variant="outline" disabled={syncingId === config.id}
                          onClick={() => syncNowMutation.mutate(config.id)} data-testid={`button-sync-now-${config.id}`}>
                          {syncingId === config.id
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Syncing...</>
                            : <><Play className="w-3.5 h-3.5 mr-1" />Sync Now</>}
                        </Button>
                        <Button size="sm" variant="ghost" title="Reset sync position — will re-import all rows"
                          onClick={() => resetPositionMutation.mutate(config.id)} data-testid={`button-reset-${config.id}`}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(config.id)} data-testid={`button-delete-${config.id}`}>
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
              {/* STEP 1: Paste URL */}
              {step === "connect" && (
                <div className="max-w-2xl mx-auto space-y-5">
                  <HowToShareBanner />
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-green-600" />Paste Your Google Sheet URL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sheet-url">Google Sheet URL</Label>
                        <Input id="sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl}
                          onChange={e => setSheetUrl(e.target.value)} data-testid="input-sheet-url" />
                        <p className="text-xs text-muted-foreground">
                          If you want a specific tab, click that tab in Google Sheets first — the URL changes to include the tab automatically.
                        </p>
                      </div>
                      <Button className="w-full" disabled={!sheetUrl || fetchHeadersMutation.isPending}
                        onClick={() => fetchHeadersMutation.mutate()} data-testid="button-connect-sheet">
                        {fetchHeadersMutation.isPending
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading sheet...</>
                          : <><FileSpreadsheet className="w-4 h-4 mr-2" />Read Column Headers</>}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* STEP 2: Map */}
              {step === "map" && (
                <div className="max-w-4xl mx-auto space-y-5">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />Map Columns
                        </CardTitle>
                        <Badge variant="outline">{headers.length} columns detected</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">Match each CRM field to the column in your sheet.</p>
                        <Badge variant={requiredFieldsMapped ? "default" : "destructive"} className="text-xs">
                          {mappedCount} / {CRM_FIELDS.length} mapped
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
                                <TableCell className="font-medium text-sm">
                                  {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                                </TableCell>
                                <TableCell>
                                  <SearchableSelect value={columnMapping[field.key] || ""}
                                    onValueChange={v => setColumnMapping(p => ({ ...p, [field.key]: v === "__none__" ? "" : v }))}
                                    options={[{ value: "__none__", label: "— Not Mapped —" }, ...headers.map(h => ({ value: h, label: h }))]}
                                    placeholder="Select column..." triggerClassName="w-full"
                                    data-testid={`select-mapping-${field.key}`} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                        <div className="space-y-2">
                          <Label className="text-xs">Duplicate Handling</Label>
                          <SearchableSelect value={duplicateStrategy} onValueChange={setDuplicateStrategy}
                            options={DEDUP_OPTIONS} data-testid="select-dedup" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Default Lead Status</Label>
                          <SearchableSelect value={defaultLeadStatus} onValueChange={setDefaultLeadStatus}
                            options={LEAD_STATUSES.map(s => ({ value: s, label: s }))} data-testid="select-status" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Default Tags</Label>
                          <Input value={defaultTags} onChange={e => setDefaultTags(e.target.value)}
                            placeholder="google-sheets, campaign-1" data-testid="input-default-tags" />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={() => setStep("connect")} data-testid="button-back">
                          <ArrowLeft className="w-4 h-4 mr-2" />Back
                        </Button>
                        <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} data-testid="button-preview">
                          {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                          Preview Data
                        </Button>
                        <Button className="flex-1" disabled={!requiredFieldsMapped || importMutation.isPending}
                          onClick={() => importMutation.mutate()} data-testid="button-import">
                          {importMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                            : <><Download className="w-4 h-4 mr-2" />Import All Leads</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* STEP 3: Preview */}
              {step === "preview" && (
                <div className="max-w-6xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />Preview ({previewRows.length > 1 ? previewRows.length - 1 : 0} rows shown)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {previewRows.length > 0 && (
                        <div className="border rounded-lg overflow-auto max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                {previewRows[0].map((h, i) => (
                                  <TableHead key={i} className="whitespace-nowrap">
                                    {h}
                                    {Object.entries(columnMapping).some(([_, v]) => v === h) && (
                                      <Badge variant="outline" className="ml-1 text-[10px]">
                                        {CRM_FIELDS.find(f => columnMapping[f.key] === h)?.label}
                                      </Badge>
                                    )}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.slice(1).map((row, ri) => (
                                <TableRow key={ri}>
                                  <TableCell className="text-muted-foreground text-xs">{ri + 1}</TableCell>
                                  {previewRows[0].map((_, ci) => (
                                    <TableCell key={ci} className="text-sm whitespace-nowrap">{row[ci] || ""}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={() => setStep("map")} data-testid="button-back-map">
                          <ArrowLeft className="w-4 h-4 mr-2" />Back
                        </Button>
                        <Button className="flex-1" disabled={!requiredFieldsMapped || importMutation.isPending}
                          onClick={() => importMutation.mutate()} data-testid="button-import-from-preview">
                          {importMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                            : <><Download className="w-4 h-4 mr-2" />Import All Leads</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* STEP 4: Result */}
              {step === "result" && importResult && (
                <div className="max-w-3xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {importResult.failureCount === 0
                          ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                          : <AlertTriangle className="w-6 h-6 text-amber-500" />}
                        Import Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        {[
                          { label: "Total Rows", val: importResult.totalRows, cls: "bg-muted", valCls: "" },
                          { label: "Imported", val: importResult.successCount, cls: "bg-green-50", valCls: "text-green-700" },
                          { label: "Duplicates", val: importResult.duplicateCount, cls: "bg-amber-50", valCls: "text-amber-700" },
                          { label: "Updated", val: importResult.updatedCount, cls: "bg-blue-50", valCls: "text-blue-700" },
                          { label: "Failed", val: importResult.failureCount, cls: "bg-red-50", valCls: "text-red-700" },
                        ].map(s => (
                          <div key={s.label} className={`text-center p-4 ${s.cls} rounded-lg`}>
                            <div className={`text-2xl font-bold ${s.valCls}`}>{s.val}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {(importResult.skippedCount ?? 0) > 0 && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100 mb-4" data-testid="text-skipped-notice">
                          <AlertTriangle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <p className="text-sm text-purple-800">
                            <span className="font-semibold">{importResult.skippedCount} row{(importResult.skippedCount ?? 0) > 1 ? "s" : ""} skipped</span>
                            {" — "}test leads or dummy data excluded automatically.
                          </p>
                        </div>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="border rounded-lg overflow-hidden mb-4">
                          <Table>
                            <TableHeader><TableRow><TableHead className="w-20">Row</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {importResult.errors.map((e, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-sm">{e.row}</TableCell>
                                  <TableCell className="text-sm text-red-600">{e.message}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={resetAll} data-testid="button-import-another">
                          <RefreshCw className="w-4 h-4 mr-2" />Import Another
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
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) resetAddDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              {addStep === "connect" ? "Connect a Sheet for Auto-Sync" : "Map Columns & Save"}
            </DialogTitle>
            <DialogDescription>
              {addStep === "connect"
                ? "Paste a publicly shared Google Sheet URL. The CRM will check it every 30 minutes for new rows."
                : "Map columns to CRM fields, name this sync, then save."}
            </DialogDescription>
          </DialogHeader>

          {addStep === "connect" && (
            <div className="space-y-4 mt-2">
              <HowToShareBanner />
              <div className="space-y-2">
                <Label>Google Sheet URL</Label>
                <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={addSheetUrl}
                  onChange={e => setAddSheetUrl(e.target.value)} data-testid="input-add-sheet-url" />
                <p className="text-xs text-muted-foreground">
                  Navigate to the correct tab in Google Sheets, then copy the URL — it already includes the tab info.
                </p>
              </div>
              <Button className="w-full" disabled={!addSheetUrl || addConnectMutation.isPending}
                onClick={() => addConnectMutation.mutate()} data-testid="button-add-connect">
                {addConnectMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading sheet...</>
                  : <><FileSpreadsheet className="w-4 h-4 mr-2" />Read Column Headers</>}
              </Button>
            </div>
          )}

          {addStep === "map" && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="font-semibold">Sync Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Meta Lead Ads — Facebook" value={syncConfigName}
                  onChange={e => setSyncConfigName(e.target.value)} data-testid="input-sync-name" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-semibold">Column Mapping</Label>
                  <Badge variant={addRequiredMapped ? "default" : "destructive"} className="text-xs">
                    {addMappedCount} / {CRM_FIELDS.length} mapped
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
                              onValueChange={v => setAddMapping(p => ({ ...p, [field.key]: v === "__none__" ? "" : v }))}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Duplicate Handling</Label>
                  <SearchableSelect value={addDedupStrategy} onValueChange={setAddDedupStrategy}
                    options={DEDUP_OPTIONS} data-testid="select-add-dedup" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Status</Label>
                  <SearchableSelect value={addDefaultStatus} onValueChange={setAddDefaultStatus}
                    options={LEAD_STATUSES.map(s => ({ value: s, label: s }))} data-testid="select-add-status" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Tags</Label>
                  <Input value={addDefaultTags} onChange={e => setAddDefaultTags(e.target.value)}
                    placeholder="meta, facebook" data-testid="input-add-tags" />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <Button variant="outline" onClick={() => setAddStep("connect")} data-testid="button-add-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />Back
                </Button>
                <Button className="flex-1"
                  disabled={!addRequiredMapped || !syncConfigName.trim() || createSyncConfigMutation.isPending}
                  onClick={() => createSyncConfigMutation.mutate()} data-testid="button-save-sync-config">
                  {createSyncConfigMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    : <><Zap className="w-4 h-4 mr-2" />Save Auto-Sync</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auto-Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops automatic syncing. Any leads already imported stay in the CRM. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteSyncConfigMutation.mutate(deleteConfirmId)}
              data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
