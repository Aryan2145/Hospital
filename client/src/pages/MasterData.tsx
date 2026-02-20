import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MASTER_CATEGORIES } from "@shared/routes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  Database,
  ArrowLeft,
  Upload,
  Download,
  FileDown,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface MasterRecord {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  status: string;
  displayOrder: number | null;
  [key: string]: any;
}

interface ImportResult {
  importLogId: number;
  totalRows: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  errors: { row: number; message: string }[];
}

interface ImportLog {
  id: number;
  tableName: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  status: string;
  errorDetails: any;
  startedAt: string;
  completedAt: string | null;
}

interface ExtraField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
}

const EXTRA_FIELDS: Record<string, ExtraField[]> = {
  leadStatuses: [
    { key: "stageOrder", label: "Stage Order", type: "number" },
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
    { key: "stageGroup", label: "Stage Group", type: "select", options: ["New", "Working", "Qualified", "Converted", "Closed"] },
  ],
  leadSources: [
    { key: "categoryId", label: "Category ID", type: "number" },
  ],
  states: [
    { key: "countryId", label: "Country ID", type: "number" },
  ],
  cities: [
    { key: "stateId", label: "State ID", type: "number" },
  ],
  areas: [
    { key: "cityId", label: "City ID", type: "number" },
    { key: "pinCode", label: "PIN Code", type: "text" },
  ],
  branches: [
    { key: "organisationId", label: "Organisation ID", type: "number" },
    { key: "cityId", label: "City ID", type: "number" },
    { key: "address", label: "Address", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ],
  doctors: [
    { key: "speciality", label: "Speciality", type: "text" },
    { key: "qualification", label: "Qualification", type: "text" },
    { key: "registrationNo", label: "Registration No", type: "text" },
    { key: "branchId", label: "Branch ID", type: "number" },
    { key: "departmentId", label: "Department ID", type: "number" },
    { key: "consultationFee", label: "Consultation Fee", type: "number" },
  ],
  opdTimings: [
    { key: "doctorId", label: "Doctor ID", type: "number" },
    { key: "dayOfWeek", label: "Day of Week", type: "select", options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
    { key: "startTime", label: "Start Time", type: "text" },
    { key: "endTime", label: "End Time", type: "text" },
    { key: "maxPatients", label: "Max Patients", type: "number" },
    { key: "slotDuration", label: "Slot Duration (min)", type: "number" },
  ],
  templates: [
    { key: "category", label: "Category", type: "select", options: ["SMS", "Email", "WhatsApp", "Push"] },
    { key: "subject", label: "Subject", type: "text" },
    { key: "body", label: "Body", type: "text" },
  ],
  holidays: [
    { key: "date", label: "Date", type: "text" },
    { key: "isRecurring", label: "Is Recurring", type: "boolean" },
  ],
  slaRules: [
    { key: "entity", label: "Entity", type: "text" },
    { key: "metric", label: "Metric", type: "text" },
    { key: "thresholdMinutes", label: "Threshold (minutes)", type: "number" },
    { key: "escalationLevel", label: "Escalation Level", type: "number" },
  ],
  conversionStages: [
    { key: "stageOrder", label: "Stage Order", type: "number" },
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
  ],
};

export default function MasterData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTableLabel, setSelectedTableLabel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({ code: "", name: "", status: "Active", displayOrder: 0 });
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportLogs, setShowImportLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: records = [], isLoading } = useQuery<MasterRecord[]>({
    queryKey: ["/api/masters", selectedTable],
    queryFn: async () => {
      if (!selectedTable) return [];
      const res = await fetch(`/api/masters/${selectedTable}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const { data: importLogs = [] } = useQuery<ImportLog[]>({
    queryKey: ["/api/masters", selectedTable, "import-logs"],
    queryFn: async () => {
      if (!selectedTable) return [];
      const res = await fetch(`/api/masters/${selectedTable}/import-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTable && showImportLogs,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/masters/${selectedTable}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/masters/${selectedTable}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/masters/${selectedTable}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/masters/${selectedTable}/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable, "import-logs"] });
      setImportResult(result);
      setShowImportResult(true);
      toast({
        title: "Import Complete",
        description: `${result.successCount} of ${result.totalRows} records imported`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const extraFields = selectedTable ? (EXTRA_FIELDS[selectedTable] || []) : [];

  function resetForm() {
    const base: Record<string, any> = { code: "", name: "", status: "Active", displayOrder: 0 };
    extraFields.forEach((f) => {
      base[f.key] = f.type === "number" ? 0 : f.type === "boolean" ? false : "";
    });
    setFormData(base);
    setEditingRecord(null);
  }

  function handleEdit(record: MasterRecord) {
    setEditingRecord(record);
    const base: Record<string, any> = {
      code: record.code,
      name: record.name,
      status: record.status,
      displayOrder: record.displayOrder ?? 0,
    };
    extraFields.forEach((f) => {
      base[f.key] = record[f.key] ?? (f.type === "number" ? 0 : f.type === "boolean" ? false : "");
    });
    setFormData(base);
    setIsDialogOpen(true);
  }

  function handleSubmit() {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleExport() {
    window.open(`/api/masters/${selectedTable}/export`, "_blank");
  }

  function handleTemplateDownload() {
    window.open(`/api/masters/${selectedTable}/template`, "_blank");
  }

  const filteredRecords = records.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCategoryData = MASTER_CATEGORIES.find((c) => c.category === selectedCategory);

  return (
    <div className="flex h-screen w-full" data-testid="master-data-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-4 border-b bg-card">
          <div className="flex items-center gap-2 flex-wrap">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Master Data Management</h1>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{selectedCategory}</span>
              </>
            )}
            {selectedTableLabel && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedTableLabel}</span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {!selectedCategory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MASTER_CATEGORIES.map((cat) => (
                <Card
                  key={cat.category}
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => setSelectedCategory(cat.category)}
                  data-testid={`card-category-${cat.category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <h3 className="font-semibold mb-2">{cat.category}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {cat.tables.length} master table{cat.tables.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cat.tables.slice(0, 3).map((t) => (
                      <Badge key={t.key} variant="secondary" className="text-xs">
                        {t.label}
                      </Badge>
                    ))}
                    {cat.tables.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{cat.tables.length - 3} more
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : !selectedTable ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => setSelectedCategory(null)}
                className="mb-4"
                data-testid="button-back-categories"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCategoryData?.tables.map((tbl) => (
                  <Card
                    key={tbl.key}
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedTable(tbl.key);
                      setSelectedTableLabel(tbl.label);
                    }}
                    data-testid={`card-table-${tbl.key}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{tbl.label}</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedTable(null);
                    setSelectedTableLabel("");
                    setSearchTerm("");
                    setShowImportLogs(false);
                  }}
                  data-testid="button-back-tables"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-master"
                  />
                </div>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  data-testid="button-add-record"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedTableLabel}
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                  data-testid="button-import-csv"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importMutation.isPending ? "Importing..." : "Import CSV"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTemplateDownload}
                  data-testid="button-download-template"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowImportLogs(!showImportLogs)}
                  data-testid="button-import-logs"
                >
                  <History className="h-4 w-4 mr-2" />
                  Logs
                </Button>
              </div>

              {showImportLogs && (
                <Card className="mb-4 p-4">
                  <h3 className="font-semibold mb-3">Import History</h3>
                  {importLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No import history yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Success</TableHead>
                          <TableHead>Duplicates</TableHead>
                          <TableHead>Failures</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importLogs.map((log) => (
                          <TableRow key={log.id} data-testid={`row-import-log-${log.id}`}>
                            <TableCell className="text-sm">{log.fileName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(log.startedAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{log.totalRows}</TableCell>
                            <TableCell className="text-green-600">{log.successCount}</TableCell>
                            <TableCell className="text-amber-600">{log.duplicateCount}</TableCell>
                            <TableCell className="text-red-600">{log.failureCount}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === "Completed" ? "default" : "secondary"}>
                                {log.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              )}

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order</TableHead>
                      {extraFields.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5 + extraFields.length} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5 + extraFields.length} className="text-center py-8 text-muted-foreground">
                          No records found. Click "Add" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id} data-testid={`row-master-${record.id}`}>
                          <TableCell className="font-mono text-sm">{record.code}</TableCell>
                          <TableCell>{record.name}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "Active" ? "default" : "secondary"}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.displayOrder ?? 0}</TableCell>
                          {extraFields.map((f) => (
                            <TableCell key={f.key} className="text-sm">
                              {f.type === "boolean"
                                ? (record[f.key] ? "Yes" : "No")
                                : (record[f.key] ?? "-")}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(record)}
                                data-testid={`button-edit-${record.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this record?")) {
                                    deleteMutation.mutate(record.id);
                                  }
                                }}
                                data-testid={`button-delete-${record.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingRecord ? "Edit" : "Add"} {selectedTableLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. ORTHO"
                data-testid="input-code"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Orthopaedics"
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Display Order</label>
              <Input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-display-order"
              />
            </div>

            {extraFields.length > 0 && (
              <div className="border-t pt-4 mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Fields</p>
                <div className="space-y-3">
                  {extraFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-sm font-medium">{field.label}</label>
                      {field.type === "boolean" ? (
                        <Select
                          value={formData[field.key] ? "true" : "false"}
                          onValueChange={(val) => setFormData({ ...formData, [field.key]: val === "true" })}
                        >
                          <SelectTrigger data-testid={`select-${field.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : field.type === "select" && field.options ? (
                        <Select
                          value={formData[field.key] || ""}
                          onValueChange={(val) => setFormData({ ...formData, [field.key]: val })}
                        >
                          <SelectTrigger data-testid={`select-${field.key}`}>
                            <SelectValue placeholder={`Select ${field.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : "text"}
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            [field.key]: field.type === "number" ? (parseInt(e.target.value) || 0) : e.target.value,
                          })}
                          placeholder={field.label}
                          data-testid={`input-${field.key}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-import-result-title">Import Results</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Rows</span>
                  </div>
                  <p className="text-xl font-semibold mt-1" data-testid="text-total-rows">{importResult.totalRows}</p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Success</span>
                  </div>
                  <p className="text-xl font-semibold mt-1 text-green-600" data-testid="text-success-count">{importResult.successCount}</p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-muted-foreground">Duplicates</span>
                  </div>
                  <p className="text-xl font-semibold mt-1 text-amber-600" data-testid="text-duplicate-count">{importResult.duplicateCount}</p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-muted-foreground">Failed</span>
                  </div>
                  <p className="text-xl font-semibold mt-1 text-red-600" data-testid="text-failure-count">{importResult.failureCount}</p>
                </Card>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Error Details</h4>
                  <div className="max-h-40 overflow-auto border rounded-md p-2 text-sm space-y-1">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="flex gap-2 text-muted-foreground" data-testid={`text-import-error-${i}`}>
                        <span className="font-mono text-xs">Row {err.row}:</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowImportResult(false)} data-testid="button-close-import-result">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
