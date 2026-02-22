import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LEAD_STATUSES } from "@/lib/lead-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Link2,
  Key,
  Eye,
  Download,
  RefreshCw,
} from "lucide-react";

interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  updatedCount: number;
  failureCount: number;
  errors?: { row: number; message: string }[];
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

export default function GoogleSheetsImportPage() {
  const { toast } = useToast();
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

  const fetchHeadersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/headers", { sheetUrl, apiKey });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHeaders(data.headers);
      setSheetTitle(data.sheetTitle);
      setSheets(data.sheets || []);
      setSpreadsheetId(data.spreadsheetId);
      setSelectedSheet(data.selectedSheet || data.sheets?.[0] || "Sheet1");

      const autoMapping: Record<string, string> = {};
      for (const field of CRM_FIELDS) {
        const match = data.headers.find((h: string) =>
          h.toLowerCase().replace(/[\s_-]/g, "") === field.key.toLowerCase().replace(/[\s_-]/g, "") ||
          h.toLowerCase().includes(field.label.toLowerCase()) ||
          field.label.toLowerCase().includes(h.toLowerCase())
        );
        if (match) autoMapping[field.key] = match;
      }

      const phoneHeaders = data.headers.filter((h: string) => {
        const low = h.toLowerCase();
        return low.includes("phone") || low.includes("mobile") || low.includes("contact") || low.includes("number");
      });
      if (phoneHeaders.length > 0 && !autoMapping.phoneE164) {
        autoMapping.phoneE164 = phoneHeaders[0];
      }

      const nameHeaders = data.headers.filter((h: string) => {
        const low = h.toLowerCase();
        return low.includes("name") || low.includes("patient") || low.includes("full name");
      });
      if (nameHeaders.length > 0 && !autoMapping.name) {
        autoMapping.name = nameHeaders[0];
      }

      const emailHeaders = data.headers.filter((h: string) => {
        const low = h.toLowerCase();
        return low.includes("email") || low.includes("mail");
      });
      if (emailHeaders.length > 0 && !autoMapping.email) {
        autoMapping.email = emailHeaders[0];
      }

      setColumnMapping(autoMapping);
      setStep("map");
      toast({ title: "Sheet connected!", description: `Found ${data.headers.length} columns in "${data.sheetTitle}"` });
    },
    onError: (err: any) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const refetchHeadersMutation = useMutation({
    mutationFn: async (newSheet: string) => {
      const res = await apiRequest("POST", "/api/google-sheets/preview", {
        spreadsheetId,
        apiKey,
        sheetName: newSheet,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.rows?.length > 0) {
        const newHeaders = data.rows[0] as string[];
        setHeaders(newHeaders);
        setColumnMapping({});

        const autoMapping: Record<string, string> = {};
        for (const field of CRM_FIELDS) {
          const match = newHeaders.find((h: string) =>
            h.toLowerCase().replace(/[\s_-]/g, "") === field.key.toLowerCase().replace(/[\s_-]/g, "") ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            field.label.toLowerCase().includes(h.toLowerCase())
          );
          if (match) autoMapping[field.key] = match;
        }
        const phoneHeaders = newHeaders.filter((h: string) => {
          const low = h.toLowerCase();
          return low.includes("phone") || low.includes("mobile") || low.includes("contact") || low.includes("number");
        });
        if (phoneHeaders.length > 0 && !autoMapping.phoneE164) autoMapping.phoneE164 = phoneHeaders[0];
        const nameHeaders = newHeaders.filter((h: string) => {
          const low = h.toLowerCase();
          return low.includes("name") || low.includes("patient");
        });
        if (nameHeaders.length > 0 && !autoMapping.name) autoMapping.name = nameHeaders[0];
        const emailHeaders = newHeaders.filter((h: string) => h.toLowerCase().includes("email"));
        if (emailHeaders.length > 0 && !autoMapping.email) autoMapping.email = emailHeaders[0];

        setColumnMapping(autoMapping);
        toast({ title: "Sheet tab changed", description: `Found ${newHeaders.length} columns` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to read tab", description: err.message, variant: "destructive" });
    },
  });

  function handleSheetTabChange(newSheet: string) {
    setSelectedSheet(newSheet);
    refetchHeadersMutation.mutate(newSheet);
  }

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/preview", {
        spreadsheetId,
        apiKey,
        sheetName: selectedSheet,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewRows(data.rows || []);
      setStep("preview");
    },
    onError: (err: any) => {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/google-sheets/import", {
        spreadsheetId,
        apiKey,
        sheetName: selectedSheet,
        columnMapping,
        duplicateStrategy,
        defaultLeadStatus,
        defaultTags,
      });
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Import complete!",
        description: `${data.successCount} leads imported, ${data.duplicateCount} duplicates, ${data.failureCount} failures`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const mappedFieldCount = Object.values(columnMapping).filter(Boolean).length;
  const requiredFieldsMapped = CRM_FIELDS.filter(f => f.required).every(f => columnMapping[f.key]);

  function resetAll() {
    setStep("connect");
    setSheetUrl("");
    setSpreadsheetId("");
    setSheetTitle("");
    setSheets([]);
    setSelectedSheet("");
    setHeaders([]);
    setColumnMapping({});
    setPreviewRows([]);
    setImportResult(null);
    setDuplicateStrategy("skip");
    setDefaultLeadStatus("Raw Lead Captured");
    setDefaultTags("");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-muted to-transparent opacity-50 rounded-bl-full pointer-events-none z-0" />

        <div className="p-6 border-b border-border bg-white/80 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2" data-testid="text-page-title">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
                Google Sheets Lead Extraction
              </h1>
              <p className="text-sm text-muted-foreground">Connect a Google Sheet and import leads directly into CRM</p>
            </div>
            {step !== "connect" && (
              <Button variant="outline" onClick={resetAll} data-testid="button-start-over">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4">
            {["connect", "map", "preview", "result"].map((s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-primary text-white" :
                  ["connect", "map", "preview", "result"].indexOf(step) > idx ? "bg-green-100 text-green-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {["connect", "map", "preview", "result"].indexOf(step) > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                  {s === "connect" ? "Connect" : s === "map" ? "Map Fields" : s === "preview" ? "Preview" : "Result"}
                </span>
                {idx < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto z-10">
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
                  <Label htmlFor="api-key" className="flex items-center gap-1.5">
                    <Key className="w-4 h-4" />
                    Google API Key
                  </Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-api-key"
                  />
                  <p className="text-xs text-muted-foreground">Your API key is not stored — it's used only for this session.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-url" className="flex items-center gap-1.5">
                    <Link2 className="w-4 h-4" />
                    Google Sheet URL
                  </Label>
                  <Input
                    id="sheet-url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    data-testid="input-sheet-url"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!sheetUrl || !apiKey || fetchHeadersMutation.isPending}
                  onClick={() => fetchHeadersMutation.mutate()}
                  data-testid="button-connect-sheet"
                >
                  {fetchHeadersMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                  ) : (
                    <><FileSpreadsheet className="w-4 h-4 mr-2" /> Connect & Read Headers</>
                  )}
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
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      {sheetTitle}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {headers.length} columns found
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {sheets.length > 1 && (
                    <div className="mb-6">
                      <Label className="mb-2 block">Select Sheet Tab</Label>
                      <SearchableSelect
                        value={selectedSheet}
                        onValueChange={handleSheetTabChange}
                        options={sheets.map(s => ({ value: s, label: s }))}
                        placeholder="Choose sheet..."
                        data-testid="select-sheet-tab"
                      />
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
                          <TableRow>
                            <TableHead className="w-[200px]">CRM Field</TableHead>
                            <TableHead>Sheet Column</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {CRM_FIELDS.map(field => (
                            <TableRow key={field.key}>
                              <TableCell className="font-medium">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                              </TableCell>
                              <TableCell>
                                <SearchableSelect
                                  value={columnMapping[field.key] || ""}
                                  onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [field.key]: v === "__none__" ? "" : v }))}
                                  options={[
                                    { value: "__none__", label: "— Not Mapped —" },
                                    ...headers.map(h => ({ value: h, label: h }))
                                  ]}
                                  placeholder="Select column..."
                                  triggerClassName="w-full"
                                  data-testid={`select-mapping-${field.key}`}
                                />
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
                      <SearchableSelect
                        value={duplicateStrategy}
                        onValueChange={setDuplicateStrategy}
                        options={DEDUP_OPTIONS}
                        placeholder="Strategy..."
                        data-testid="select-dedup-strategy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Lead Status</Label>
                      <SearchableSelect
                        value={defaultLeadStatus}
                        onValueChange={setDefaultLeadStatus}
                        options={LEAD_STATUSES.map(s => ({ value: s, label: s }))}
                        placeholder="Status..."
                        data-testid="select-default-status"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Tags</Label>
                      <Input
                        value={defaultTags}
                        onChange={(e) => setDefaultTags(e.target.value)}
                        placeholder="google-sheets, campaign-1"
                        data-testid="input-default-tags"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setStep("connect")} data-testid="button-back-connect">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => previewMutation.mutate()}
                      disabled={previewMutation.isPending}
                      data-testid="button-preview"
                    >
                      {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                      Preview Data
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!requiredFieldsMapped || importMutation.isPending}
                      onClick={() => importMutation.mutate()}
                      data-testid="button-import-leads"
                    >
                      {importMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Import Leads to CRM</>
                      )}
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Data Preview (first {previewRows.length - 1} rows)
                    </CardTitle>
                  </div>
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
                                <TableCell key={colIdx} className="text-sm whitespace-nowrap">
                                  {row[colIdx] || ""}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setStep("map")} data-testid="button-back-map">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Mapping
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!requiredFieldsMapped || importMutation.isPending}
                      onClick={() => importMutation.mutate()}
                      data-testid="button-import-from-preview"
                    >
                      {importMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> Import All Leads to CRM</>
                      )}
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
                    {importResult.failureCount === 0 ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                    )}
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
                          <TableRow>
                            <TableHead className="w-20">Row</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
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
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Import Another Sheet
                    </Button>
                    <Button onClick={() => window.location.href = "/leads"} data-testid="button-go-to-leads">
                      View Leads
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
