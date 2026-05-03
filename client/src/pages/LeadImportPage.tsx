import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LEAD_STATUSES } from "@/lib/lead-status";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowRight,
} from "lucide-react";
import { fmtDateTime } from "@/lib/date-utils";

interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

interface ImportLog {
  id: number;
  tenantId: number;
  fileName: string;
  source: string;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  updatedCount: number;
  failureCount: number;
  duplicateStrategy: string;
  status: string;
  errorDetails: { row: number; message: string }[] | null;
  columnMapping: any;
  importedBy: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  updatedCount: number;
  failureCount: number;
  skippedCount?: number;
  errors?: { row: number; message: string }[];
}

export default function LeadImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("import");
  const [file, setFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState("skip");
  const [defaultLeadStatus, setDefaultLeadStatus] = useState("Raw Lead Captured");
  const [defaultTags, setDefaultTags] = useState("");
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: importFields, isLoading: fieldsLoading } = useQuery<ImportField[]>({
    queryKey: ["/api/leads/import-fields"],
  });

  const { data: importLogs, isLoading: logsLoading } = useQuery<ImportLog[]>({
    queryKey: ["/api/leads/import-logs"],
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("duplicateStrategy", duplicateStrategy);
      formData.append("columnMapping", JSON.stringify(columnMapping));
      formData.append("defaultLeadStatus", defaultLeadStatus);
      formData.append("defaultTags", defaultTags);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setResultDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["/api/leads/import-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      resetForm();
    },
    onError: (err) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const parseCSVHeader = useCallback((csvFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const firstLine = text.split("\n")[0];
      const headers = firstLine
        .split(",")
        .map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
      setCsvColumns(headers);

      if (importFields) {
        const autoMap: Record<string, string> = {};
        importFields.forEach((field) => {
          const match = headers.find(
            (h) =>
              h.toLowerCase() === field.key.toLowerCase() ||
              h.toLowerCase() === field.label.toLowerCase() ||
              h.toLowerCase().replace(/[\s_-]/g, "") ===
                field.key.toLowerCase().replace(/[\s_-]/g, "")
          );
          if (match) {
            autoMap[field.key] = match;
          }
        });
        setColumnMapping(autoMap);
      }
    };
    reader.readAsText(csvFile);
  }, [importFields]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (!selectedFile.name.endsWith(".csv")) {
        toast({ title: "Invalid file type", description: "Please upload a CSV file.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      parseCSVHeader(selectedFile);
    },
    [parseCSVHeader, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const resetForm = () => {
    setFile(null);
    setCsvColumns([]);
    setColumnMapping({});
    setDuplicateStrategy("skip");
    setDefaultLeadStatus("Raw Lead Captured");
    setDefaultTags("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    window.open("/api/leads/import-template", "_blank");
  };

  const handleMappingChange = (fieldKey: string, csvCol: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (csvCol === "__none__") {
        delete next[fieldKey];
      } else {
        next[fieldKey] = csvCol;
      }
      return next;
    });
  };

  const csvColumnOptions = [
    { value: "__none__", label: "— Do not map —" },
    ...csvColumns.map((col) => ({ value: col, label: col })),
  ];

  const statusOptions = LEAD_STATUSES.map((s) => ({ value: s, label: s }));

  const duplicateOptions = [
    { value: "skip", label: "Skip Duplicates" },
    { value: "update_blank", label: "Update Blank Fields Only" },
    { value: "overwrite", label: "Overwrite Existing" },
  ];

  const hasRequiredMappings = importFields
    ? importFields.filter((f) => f.required).every((f) => columnMapping[f.key])
    : false;

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-lead-import-title">
                Lead Import
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Import leads from CSV files into your CRM workspace.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
              <Download className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Download Template</span>
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-import">
              <TabsTrigger value="import" data-testid="tab-import">Import</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Import History</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload CSV File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!file ? (
                    <div
                      className={`border-2 border-dashed rounded-md p-12 text-center cursor-pointer transition-colors ${
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-csv"
                    >
                      <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground">
                        Drag and drop your CSV file here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse files
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileSelect(f);
                        }}
                        data-testid="input-file-csv"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileSpreadsheet className="w-8 h-8 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid="text-file-name">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB &middot; {csvColumns.length} columns
                            detected
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={resetForm}
                        data-testid="button-remove-file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {file && csvColumns.length > 0 && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Column Mapping
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {fieldsLoading ? (
                        <LoadingSpinner text="Loading fields..." />
                      ) : (
                        <div className="space-y-3">
                          {importFields?.map((field) => (
                            <div
                              key={field.key}
                              className="grid grid-cols-[1fr,auto,1fr] items-center gap-3"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium truncate">
                                  {field.label}
                                </span>
                                {field.required && (
                                  <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                    Required
                                  </Badge>
                                )}
                              </div>
                              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <SearchableSelect
                                value={columnMapping[field.key] || "__none__"}
                                onValueChange={(val) => handleMappingChange(field.key, val)}
                                options={csvColumnOptions}
                                placeholder="Select CSV column"
                                data-testid={`select-mapping-${field.key}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Import Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">
                          Duplicate Strategy
                        </Label>
                        <SearchableSelect
                          value={duplicateStrategy}
                          onValueChange={setDuplicateStrategy}
                          options={duplicateOptions}
                          data-testid="select-duplicate-strategy"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">
                          Default Lead Status
                        </Label>
                        <SearchableSelect
                          value={defaultLeadStatus}
                          onValueChange={setDefaultLeadStatus}
                          options={statusOptions}
                          data-testid="select-default-status"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">
                          Default Tags (comma-separated)
                        </Label>
                        <Input
                          value={defaultTags}
                          onChange={(e) => setDefaultTags(e.target.value)}
                          placeholder="e.g. imported, campaign-2026"
                          data-testid="input-default-tags"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={resetForm} data-testid="button-cancel-import">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => importMutation.mutate()}
                      disabled={importMutation.isPending || !hasRequiredMappings}
                      data-testid="button-start-import"
                    >
                      {importMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Start Import
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base">Import History</CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      queryClient.invalidateQueries({ queryKey: ["/api/leads/import-logs"] })
                    }
                    data-testid="button-refresh-logs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <LoadingSpinner text="Loading import history..." />
                  ) : !importLogs || importLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No import history yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Success</TableHead>
                            <TableHead className="text-right">Duplicates</TableHead>
                            <TableHead className="text-right">Updated</TableHead>
                            <TableHead className="text-right">Failed</TableHead>
                            <TableHead>Strategy</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importLogs.map((log) => (
                            <TableRow key={log.id} data-testid={`row-import-log-${log.id}`}>
                              <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-log-filename-${log.id}`}>
                                {log.fileName}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm" data-testid={`text-log-date-${log.id}`}>
                                {fmtDateTime(log.startedAt)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === "completed"
                                      ? "default"
                                      : log.status === "failed"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  data-testid={`badge-log-status-${log.id}`}
                                >
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-log-total-${log.id}`}>
                                {log.totalRows}
                              </TableCell>
                              <TableCell className="text-right text-green-600" data-testid={`text-log-success-${log.id}`}>
                                {log.successCount}
                              </TableCell>
                              <TableCell className="text-right text-amber-600" data-testid={`text-log-duplicates-${log.id}`}>
                                {log.duplicateCount}
                              </TableCell>
                              <TableCell className="text-right text-blue-600" data-testid={`text-log-updated-${log.id}`}>
                                {log.updatedCount}
                              </TableCell>
                              <TableCell className="text-right text-red-600" data-testid={`text-log-failed-${log.id}`}>
                                {log.failureCount}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm" data-testid={`text-log-strategy-${log.id}`}>
                                {log.duplicateStrategy === "skip"
                                  ? "Skip"
                                  : log.duplicateStrategy === "update_blank"
                                    ? "Update Blank"
                                    : log.duplicateStrategy === "overwrite"
                                      ? "Overwrite"
                                      : log.duplicateStrategy}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Import Complete
              </DialogTitle>
            </DialogHeader>
            {importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-foreground" data-testid="text-result-total">
                      {importResult.totalRows}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 text-center">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-result-success">
                      {importResult.successCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Imported</p>
                  </div>
                  <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 text-center">
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-result-duplicates">
                      {importResult.duplicateCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Duplicates</p>
                  </div>
                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 text-center">
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-result-updated">
                      {importResult.updatedCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                </div>
                {(importResult.skippedCount ?? 0) > 0 && (
                  <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950/20 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-400" data-testid="text-result-skipped">
                        {importResult.skippedCount} row{(importResult.skippedCount ?? 0) > 1 ? "s" : ""} skipped
                      </p>
                      <p className="text-xs text-muted-foreground">Test leads or dummy data excluded automatically</p>
                    </div>
                  </div>
                )}
                {importResult.failureCount > 0 && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <p className="text-sm font-medium text-red-600" data-testid="text-result-failures">
                        {importResult.failureCount} rows failed
                      </p>
                    </div>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {importResult.errors.slice(0, 10).map((err, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400"
                          >
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span data-testid={`text-error-${idx}`}>
                              Row {err.row}: {err.message}
                            </span>
                          </div>
                        ))}
                        {importResult.errors.length > 10 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ...and {importResult.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => setResultDialogOpen(false)}
                  data-testid="button-close-results"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </AppLayout>
  );
}