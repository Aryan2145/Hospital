import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MASTER_CATEGORIES } from "@shared/routes";
import { MASTER_TABLE_REGISTRY } from "@shared/schema";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PatientSearchSelect, type PatientSearchResult } from "@/components/ui/patient-search-select";
import { AppLayout } from "@/components/layout/AppLayout";
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
  Clock,
  Check,
  X,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/date-utils";

interface MasterRecord {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  status: string;
  displayOrder: number | null;
  approvalStatus?: string | null;
  [key: string]: any;
}

interface ImportResult {
  importLogId: number;
  totalRows: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  errors: { row: number; message: string }[];
  sentToApproval?: boolean;
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
  type: "text" | "number" | "boolean" | "select" | "ref" | "time" | "multiselect" | "multiref" | "date" | "patient-picker";
  options?: string[];
  refTable?: string;
  autoGenCodeName?: boolean;
  showWhen?: { field: string; value: string; negate?: boolean };
}

const EXTRA_FIELDS: Record<string, ExtraField[]> = {
  // CATEGORY 1: LOCATION MASTERS
  states: [
    { key: "countryId", label: "Country", type: "ref", refTable: "countries" },
  ],
  cities: [
    { key: "stateId", label: "State", type: "ref", refTable: "states" },
  ],
  areas: [
    { key: "cityId", label: "City", type: "ref", refTable: "cities" },
    { key: "pinCode", label: "PIN Code", type: "text" },
    { key: "serviceable", label: "Serviceable", type: "boolean" },
    { key: "defaultNearestBranchId", label: "Default Nearest Branch", type: "ref", refTable: "branches" },
  ],

  // CATEGORY 2: ORGANISATION MASTERS
  branches: [
    { key: "organisationId", label: "Organisation", type: "ref", refTable: "organisations" },
    { key: "cityId", label: "City", type: "ref", refTable: "cities" },
    { key: "address", label: "Address", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
  ],
  callingLines: [
    { key: "phoneNumber", label: "Phone Number", type: "text" },
    { key: "provider", label: "Provider", type: "text" },
  ],
  userLineAssignments: [
    { key: "crmUserId", label: "CRM User", type: "ref", refTable: "crmUsers" },
    { key: "callingLineId", label: "Calling Line", type: "ref", refTable: "callingLines" },
    { key: "isPrimary", label: "Is Primary Line", type: "boolean" },
  ],
  crmUsers: [
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "branchId", label: "Branch", type: "ref", refTable: "branches" },
    { key: "systemRoleId", label: "System Role", type: "ref", refTable: "systemRoles" },
    { key: "accessScopeType", label: "Access Scope", type: "select", options: ["All", "Branch", "Team", "Self"] },
    { key: "phiAccessLevel", label: "PHI Access Level", type: "select", options: ["Full", "Masked", "None"] },
    { key: "isActive", label: "Is Active", type: "boolean" },
  ],
  consultationTypes: [
    { key: "treatmentDepartmentId", label: "Treatment Department", type: "ref", refTable: "treatmentDepartments" },
  ],
  // CATEGORY 4: DOCTORS MASTERS
  doctors: [
    { key: "crmUserId", label: "Linked CRM User (Doctor role)", type: "ref", refTable: "docCrmUsers" },
    { key: "specialization", label: "Specialization", type: "text" },
    { key: "qualification", label: "Qualification", type: "text" },
    { key: "branchId", label: "Branch", type: "ref", refTable: "branches" },
    { key: "treatmentDepartmentId", label: "Treatment Department", type: "ref", refTable: "treatmentDepartments" },
    { key: "consultationTypeId", label: "Treatment Sub-Department", type: "ref", refTable: "consultationTypes" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ],
  opdTimings: [
    { key: "doctorId", label: "Doctor", type: "ref", refTable: "doctors" },
    { key: "branchId", label: "Branch", type: "ref", refTable: "branches" },
    { key: "dayOfWeek", label: "Day(s) of Week", type: "multiselect", options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
    { key: "startTime", label: "Start Time", type: "time" },
    { key: "endTime", label: "End Time", type: "time" },
    { key: "maxPatients", label: "Max Patients", type: "number" },
    { key: "slotDuration", label: "Slot Duration (min)", type: "number" },
  ],
  doctorLeaveExceptions: [
    { key: "doctorId", label: "Doctor", type: "ref", refTable: "doctors" },
    { key: "leaveDate", label: "Leave From", type: "date" },
    { key: "leaveEndDate", label: "Leave To (optional)", type: "date" },
    { key: "reason", label: "Reason", type: "text" },
  ],
  // CATEGORY 5: LEAD GENERATION MASTERS
  leadSources: [
    { key: "categoryId", label: "Source Category", type: "ref", refTable: "leadSourceCategories" },
  ],
  referrers: [
    { key: "type", label: "Type", type: "select", options: ["Doctor", "Patient", "Hospital", "Agent", "Other"] },
    { key: "linkedLeadId", label: "Linked Patient", type: "patient-picker", showWhen: { field: "type", value: "Patient" } },
    { key: "phone", label: "Phone", type: "text", showWhen: { field: "type", value: "Patient", negate: true } },
    { key: "email", label: "Email", type: "text", showWhen: { field: "type", value: "Patient", negate: true } },
  ],
  corporateInsurances: [
    { key: "type", label: "Type", type: "select", options: ["Corporate", "Insurance", "TPA"] },
  ],

  // CATEGORY 6: CONSULTATION MASTERS
  conversionStages: [
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
    { key: "isBusinessAchieved", label: "Is Business Achieved", type: "boolean" },
  ],

  // CATEGORY 7: ACTIVITY & WORKFLOW MASTERS
  leadStatuses: [
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
    { key: "isBusinessAchieved", label: "Is Business Achieved", type: "boolean" },
    { key: "requiresNextTask", label: "Requires Next Task", type: "boolean" },
    { key: "allowNurtureOption", label: "Allow Nurture Option", type: "boolean" },
    { key: "defaultOwnerRole", label: "Default Owner Role", type: "select", options: ["PATIENT_COORDINATOR", "COUNSELLOR", "MANAGER", "ADMIN"] },
  ],

  // CATEGORY 8: COMMUNICATION MASTERS
  templates: [
    { key: "channel", label: "Channel", type: "select", options: ["SMS", "Email", "WhatsApp", "Push"] },
    { key: "subject", label: "Subject", type: "text" },
    { key: "body", label: "Body", type: "text" },
  ],
  holidays: [
    { key: "holidayDate", label: "Holiday Date", type: "date" },
  ],
  tags: [
    { key: "color", label: "Color", type: "text" },
  ],

  // CATEGORY 9: GOVERNANCE MASTERS
  slaRules: [
    { key: "triggerEvent", label: "Trigger Event", type: "text" },
    { key: "timeLimitMinutes", label: "Time Limit (minutes)", type: "number" },
    { key: "appliesToRole", label: "Applies To Role", type: "select", options: ["PATIENT_COORDINATOR", "COUNSELLOR", "MANAGER", "ADMIN", "All"] },
    { key: "escalationRole", label: "Escalation Role", type: "select", options: ["MANAGER", "ADMIN"] },
  ],
  reminderPolicies: [
    { key: "offsetMinutes", label: "Offset (minutes before)", type: "number" },
    { key: "channel", label: "Channel", type: "select", options: ["SMS", "Email", "WhatsApp", "Push"] },
    { key: "fallbackChannel", label: "Fallback Channel", type: "select", options: ["SMS", "Email", "WhatsApp", "Push"] },
  ],
  dataRetentionPolicies: [
    { key: "entityType", label: "Entity Type", type: "select", options: ["Lead", "Episode", "Patient", "Activity", "Task", "Appointment"] },
    { key: "retentionMonths", label: "Retention Period (months)", type: "number" },
    { key: "action", label: "Action", type: "select", options: ["archive", "anonymize", "delete"] },
  ],

  costHeads: [
    { key: "treatmentDepartmentId", label: "Treatment Department", type: "ref", refTable: "treatmentDepartments" },
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

  const allExtraFields = selectedTable ? EXTRA_FIELDS[selectedTable] || [] : [];
  function isFieldVisible(field: ExtraField, data: Record<string, any>): boolean {
    if (!field.showWhen) return true;
    const actual = data[field.showWhen.field];
    const match = actual === field.showWhen.value;
    return field.showWhen.negate ? !match : match;
  }
  const extraFields = allExtraFields.filter(f => !f.showWhen || isFieldVisible(f, formData));
  const refTables = Array.from(new Set(allExtraFields.filter(f => (f.type === "ref" || f.type === "multiref") && f.refTable).map(f => f.refTable!)));

  const { data: refDataMap = {} } = useQuery<Record<string, MasterRecord[]>>({
    queryKey: ["/api/masters/ref-data", ...refTables],
    queryFn: async () => {
      const result: Record<string, MasterRecord[]> = {};
      for (const table of refTables) {
        try {
          const url = table === "docCrmUsers"
            ? "/api/crm-users/active?roleCode=DOCTOR"
            : `/api/masters/${table}`;
          const res = await fetch(url, { credentials: "include" });
          if (res.ok) {
            const records = await res.json();
            result[table] = table === "docCrmUsers"
              ? records
              : records.filter((r: MasterRecord) => r.approvalStatus === "Approved" || !r.approvalStatus);
          }
        } catch {}
      }
      return result;
    },
    enabled: refTables.length > 0,
  });

  const { data: pendingSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/field-suggestions", "Pending"],
    queryFn: async () => {
      const res = await fetch(`/api/field-suggestions?status=Pending`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const reviewSuggestion = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes?: string }) => {
      await apiRequest("PATCH", `/api/field-suggestions/${id}`, { status, reviewNotes, reviewedBy: "admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-suggestions"] });
      toast({ title: "Suggestion reviewed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addToMaster = useMutation({
    mutationFn: async ({ suggestion }: { suggestion: any }) => {
      const registryKeys = Object.values(MASTER_TABLE_REGISTRY);
      if (suggestion.targetTable && registryKeys.includes(suggestion.targetTable)) {
        const code = suggestion.suggestedValue.toUpperCase().replace(/\s+/g, "_").slice(0, 20);
        await apiRequest("POST", `/api/masters/${suggestion.targetTable}`, {
          code,
          name: suggestion.suggestedValue,
          status: "Active",
          displayOrder: 0,
        });
      }
      await apiRequest("PATCH", `/api/field-suggestions/${suggestion.id}`, { status: "Approved", reviewedBy: "admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters"] });
      toast({ title: "Suggestion approved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/masters/${selectedTable}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/pending-approvals"] });
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

  const approveMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      await apiRequest("POST", `/api/masters/${tableName}/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/pending-approvals"] });
      toast({ title: "Record approved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      await apiRequest("POST", `/api/masters/${tableName}/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/pending-approvals"] });
      toast({ title: "Record rejected" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: number; direction: "up" | "down" }) => {
      await apiRequest("PATCH", `/api/masters/${selectedTable}/${id}/reorder`, { direction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/pending-approvals"],
    enabled: !selectedCategory,
  });

  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());

  const togglePendingSelection = (key: string) => {
    setSelectedPendingIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllPending = () => {
    if (selectedPendingIds.size === pendingApprovals.length) {
      setSelectedPendingIds(new Set());
    } else {
      setSelectedPendingIds(new Set(pendingApprovals.map((item: any) => `${item._tableName}-${item.id}`)));
    }
  };

  const bulkApprovalMutation = useMutation({
    mutationFn: async ({ action }: { action: "approve" | "reject" }) => {
      const items = Array.from(selectedPendingIds).map(key => {
        const [tableName, ...idParts] = key.split("-");
        return { tableName, id: Number(idParts.join("-")), action };
      });
      const res = await apiRequest("POST", "/api/masters/bulk-approval", { items });
      return res.json();
    },
    onSuccess: (result, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/pending-approvals"] });
      setSelectedPendingIds(new Set());
      const count = action === "approve" ? result.approvedCount : result.rejectedCount;
      toast({ title: `${count} record(s) ${action === "approve" ? "approved" : "rejected"}` });
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
      queryClient.invalidateQueries({ queryKey: ["/api/masters/pending-approvals"] });
      setImportResult(result);
      setShowImportResult(true);
      const approvalMsg = result.sentToApproval ? " and sent to approval queue" : "";
      toast({
        title: "Import Complete",
        description: `${result.successCount} of ${result.totalRows} records imported${approvalMsg}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const FIELD_DEFAULTS: Record<string, Record<string, any>> = {
    crmUsers: { accessScopeType: "Self", phiAccessLevel: "None", isActive: true },
  };

  function resetForm() {
    const base: Record<string, any> = { code: "", name: "", status: "Active", displayOrder: 0 };
    const tableDefaults = selectedTable ? FIELD_DEFAULTS[selectedTable] || {} : {};
    extraFields.forEach((f) => {
      if (tableDefaults[f.key] !== undefined) {
        base[f.key] = tableDefaults[f.key];
      } else {
        base[f.key] = f.type === "number" ? 0 : f.type === "boolean" ? false : (f.type === "multiselect" || f.type === "multiref") ? [] : "";
      }
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
    allExtraFields.forEach((f) => {
      let val = record[f.key] ?? (f.type === "number" ? 0 : f.type === "boolean" ? false : f.type === "ref" ? "" : f.type === "patient-picker" ? null : "");
      if (f.type === "date" && val) {
        try {
          val = new Date(val).toISOString().split("T")[0];
        } catch {}
      }
      base[f.key] = val;
    });
    setFormData(base);
    setIsDialogOpen(true);
  }

  const autoCodeNameTables = ["doctorLeaveExceptions", "opdTimings"];
  const isAutoCodeName = selectedTable ? autoCodeNameTables.includes(selectedTable) : false;

  const hideStatusDisplayOrderTables = ["doctorLeaveExceptions", "opdTimings"];
  const hideStatusDisplayOrder = selectedTable ? hideStatusDisplayOrderTables.includes(selectedTable) : false;

  function autoGenerateCodeName(data: Record<string, any>): Record<string, any> {
    if (!isAutoCodeName) return data;
    const result = { ...data };
    if (selectedTable === "doctorLeaveExceptions") {
      const doctorRecords = refDataMap["doctors"] || [];
      const doctor = doctorRecords.find((r: any) => r.id === data.doctorId);
      const doctorName = doctor ? doctor.name : `Dr-${data.doctorId}`;
      const dateStr = data.leaveDate || "no-date";
      result.code = `LEAVE-${data.doctorId}-${dateStr}`;
      result.name = `${doctorName} - ${dateStr}${data.leaveEndDate ? ` to ${data.leaveEndDate}` : ""}`;
    } else if (selectedTable === "opdTimings") {
      const doctorRecords = refDataMap["doctors"] || [];
      const branchRecords = refDataMap["branches"] || [];
      const doctor = doctorRecords.find((r: any) => r.id === data.doctorId);
      const branch = branchRecords.find((r: any) => r.id === data.branchId);
      const doctorName = doctor ? doctor.name : `Dr-${data.doctorId}`;
      const branchName = branch ? branch.name : "";
      const day = data.dayOfWeek || "no-day";
      result.code = `OPD-${data.doctorId}-${day}-${data.startTime || ""}`;
      result.name = `${doctorName}${branchName ? ` @ ${branchName}` : ""} — ${day} ${data.startTime || ""}-${data.endTime || ""}`;
    }
    return result;
  }

  function handleSubmit() {
    if (editingRecord) {
      const data = autoGenerateCodeName(formData);
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      const multiselectField = extraFields.find(f => f.type === "multiselect");
      const multirefField = extraFields.find(f => f.type === "multiref");

      if (multiselectField && Array.isArray(formData[multiselectField.key]) && formData[multiselectField.key].length > 0) {
        const days = formData[multiselectField.key] as string[];
        let completed = 0;
        days.forEach((day) => {
          const record = autoGenerateCodeName({ ...formData, [multiselectField.key]: day });
          createMutation.mutate(record, {
            onSuccess: () => {
              completed++;
              if (completed === days.length) {
                toast({ title: `${days.length} slot(s) created successfully` });
              }
            },
          });
        });
      } else if (multirefField && Array.isArray(formData[multirefField.key]) && formData[multirefField.key].length > 0) {
        const selectedIds = formData[multirefField.key] as number[];
        let completed = 0;
        selectedIds.forEach((refId) => {
          const record = autoGenerateCodeName({ ...formData, [multirefField.key]: refId });
          createMutation.mutate(record, {
            onSuccess: () => {
              completed++;
              if (completed === selectedIds.length) {
                toast({ title: `${selectedIds.length} mapping(s) created successfully` });
              }
            },
          });
        });
      } else {
        const data = autoGenerateCodeName(formData);
        createMutation.mutate(data);
      }
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

  const DAY_ORDER: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

  const getOpdSearchText = (r: MasterRecord): string => {
    const doctorRecords = refDataMap["doctors"] || [];
    const branchRecords = refDataMap["branches"] || [];
    const doctor = doctorRecords.find((d: any) => d.id === r.doctorId);
    const branch = branchRecords.find((b: any) => b.id === r.branchId);
    return [
      doctor?.name || "",
      branch?.name || "",
      r.dayOfWeek || "",
      r.startTime || "",
      r.endTime || "",
    ].join(" ").toLowerCase();
  };

  const sortedRecords = selectedTable === "opdTimings"
    ? [...records].sort((a, b) => {
        const dayA = DAY_ORDER[a.dayOfWeek as string] ?? 8;
        const dayB = DAY_ORDER[b.dayOfWeek as string] ?? 8;
        if (dayA !== dayB) return dayA - dayB;
        return (a.startTime as string || "").localeCompare(b.startTime as string || "");
      })
    : [...records].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id);

  const filteredRecords = sortedRecords.filter((r) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    if (selectedTable === "opdTimings") {
      return getOpdSearchText(r).includes(term);
    }
    return (
      (r.name || "").toLowerCase().includes(term) ||
      (r.code || "").toLowerCase().includes(term)
    );
  });

  const selectedCategoryData = MASTER_CATEGORIES.find((c) => c.category === selectedCategory);

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="master-data-page">
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
            <div className="space-y-4">
              {pendingApprovals.length > 0 && (
                <Card className="p-4 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 overflow-x-auto" data-testid="card-pending-approvals">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                        Pending Approvals ({pendingApprovals.length})
                      </h3>
                    </div>
                    {selectedPendingIds.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 dark:text-blue-400">{selectedPendingIds.size} selected</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                          onClick={() => bulkApprovalMutation.mutate({ action: "approve" })}
                          disabled={bulkApprovalMutation.isPending}
                          data-testid="button-bulk-approve"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                          onClick={() => bulkApprovalMutation.mutate({ action: "reject" })}
                          disabled={bulkApprovalMutation.isPending}
                          data-testid="button-bulk-reject"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject Selected
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                    New master data records awaiting approval before they become available in the system.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                            checked={pendingApprovals.length > 0 && selectedPendingIds.size === pendingApprovals.length}
                            onChange={toggleAllPending}
                            data-testid="checkbox-select-all-pending"
                          />
                        </TableHead>
                        <TableHead className="text-xs">Table</TableHead>
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.map((item: any) => {
                        const itemKey = `${item._tableName}-${item.id}`;
                        return (
                          <TableRow key={itemKey} data-testid={`row-pending-${item._tableName}-${item.id}`}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                                checked={selectedPendingIds.has(itemKey)}
                                onChange={() => togglePendingSelection(itemKey)}
                                data-testid={`checkbox-pending-${item._tableName}-${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="text-[10px]">{item._tableLabel}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{item.code}</TableCell>
                            <TableCell className="text-xs font-medium">{item.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {fmtDate(item.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => approveMutation.mutate({ tableName: item._tableName, id: item.id })}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-pending-${item.id}`}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => rejectMutation.mutate({ tableName: item._tableName, id: item.id })}
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-reject-pending-${item.id}`}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
              {pendingSuggestions.length > 0 && (
                <Card className="p-4 border-amber-200 bg-amber-50 overflow-x-auto" data-testid="card-pending-suggestions">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <h3 className="font-semibold text-amber-800">
                        Pending Field Suggestions ({pendingSuggestions.length})
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    Users have suggested new values. Review and approve to add them to master data.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Field</TableHead>
                        <TableHead className="text-xs">Suggested Value</TableHead>
                        <TableHead className="text-xs">Suggested By</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSuggestions.map((s: any) => (
                        <TableRow key={s.id} data-testid={`row-suggestion-${s.id}`}>
                          <TableCell className="text-xs font-medium">{s.fieldName}</TableCell>
                          <TableCell className="text-xs">{s.suggestedValue}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.suggestedBy || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(s.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => addToMaster.mutate({ suggestion: s })}
                                disabled={addToMaster.isPending}
                                data-testid={`button-approve-suggestion-${s.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Add to Master
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => reviewSuggestion.mutate({ id: s.id, status: "Rejected" })}
                                disabled={reviewSuggestion.isPending}
                                data-testid={`button-reject-suggestion-${s.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
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
                {selectedTable !== "systemRoles" && (
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
                )}
                {selectedTable !== "opdTimings" && selectedTable !== "systemRoles" && (
                  <>
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
                      <span className="hidden md:inline">{importMutation.isPending ? "Importing..." : "Import CSV"}</span>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={handleExport}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Export</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTemplateDownload}
                  data-testid="button-download-template"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Template</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowImportLogs(!showImportLogs)}
                  data-testid="button-import-logs"
                >
                  <History className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Logs</span>
                </Button>
              </div>

              {showImportLogs && (
                <Card className="mb-4 p-4 overflow-x-auto">
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
                              {fmtDateTime(log.startedAt)}
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

              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isAutoCodeName && <TableHead>Code</TableHead>}
                      {!isAutoCodeName && <TableHead>Name</TableHead>}
                      {!hideStatusDisplayOrder && <TableHead>Status</TableHead>}
                      <TableHead>Approval</TableHead>
                      {!isAutoCodeName && !hideStatusDisplayOrder && <TableHead>Order</TableHead>}
                      {allExtraFields.filter(f => !f.showWhen && f.type !== "patient-picker").map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead className="w-[140px]">Actions</TableHead>
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
                        <TableRow key={record.id} className={record.approvalStatus === "Pending" ? "bg-amber-50/50 dark:bg-amber-950/10" : record.approvalStatus === "Rejected" ? "bg-red-50/50 dark:bg-red-950/10" : ""} data-testid={`row-master-${record.id}`}>
                          {!isAutoCodeName && <TableCell className="font-mono text-sm">{record.code}</TableCell>}
                          {!isAutoCodeName && <TableCell>{record.name}</TableCell>}
                          {!hideStatusDisplayOrder && (
                            <TableCell>
                              <Badge variant={record.status === "Active" ? "default" : "secondary"}>
                                {record.status}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            {record.approvalStatus === "Pending" ? (
                              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                <Clock className="h-3 w-3" /> Pending
                              </Badge>
                            ) : record.approvalStatus === "Rejected" ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" /> Rejected
                              </Badge>
                            ) : (
                              <Badge variant="default" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </Badge>
                            )}
                          </TableCell>
                          {!isAutoCodeName && !hideStatusDisplayOrder && <TableCell>{record.displayOrder ?? 0}</TableCell>}
                          {allExtraFields.filter(f => !f.showWhen && f.type !== "patient-picker").map((f) => {
                            let displayVal: any = record[f.key] ?? "-";
                            if (f.type === "boolean") {
                              displayVal = record[f.key] ? "Yes" : "No";
                            } else if ((f.type === "ref" || f.type === "multiref") && f.refTable && record[f.key]) {
                              const refRecords = refDataMap[f.refTable] || [];
                              const refRecord = refRecords.find((r: any) => r.id === record[f.key]);
                              displayVal = refRecord ? refRecord.name : record[f.key];
                            } else if (f.type === "date" && record[f.key]) {
                              try {
                                displayVal = fmtDate(record[f.key]);
                              } catch { displayVal = record[f.key]; }
                            }
                            return (
                              <TableCell key={f.key} className="text-sm">
                                {displayVal}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            {selectedTable === "systemRoles" ? (
                              <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> Read-only
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                {record.approvalStatus === "Pending" && selectedTable && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => approveMutation.mutate({ tableName: selectedTable, id: record.id })}
                                      disabled={approveMutation.isPending}
                                      title="Approve"
                                      data-testid={`button-approve-${record.id}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => rejectMutation.mutate({ tableName: selectedTable, id: record.id })}
                                      disabled={rejectMutation.isPending}
                                      title="Reject"
                                      data-testid={`button-reject-${record.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {!hideStatusDisplayOrder && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-muted-foreground"
                                      onClick={() => reorderMutation.mutate({ id: record.id, direction: "up" })}
                                      disabled={reorderMutation.isPending || sortedRecords.indexOf(record) === 0}
                                      title="Move up"
                                      data-testid={`button-move-up-${record.id}`}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-muted-foreground"
                                      onClick={() => reorderMutation.mutate({ id: record.id, direction: "down" })}
                                      disabled={reorderMutation.isPending || sortedRecords.indexOf(record) === sortedRecords.length - 1}
                                      title="Move down"
                                      data-testid={`button-move-down-${record.id}`}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
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
                            )}
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
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingRecord ? "Edit" : "Add"} {selectedTableLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {!isAutoCodeName && (
              <>
                {editingRecord && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Code (auto-generated)</label>
                    <Input
                      value={formData.code}
                      readOnly
                      disabled
                      className="bg-muted font-mono text-sm"
                      data-testid="input-code"
                    />
                  </div>
                )}
                {!(selectedTable === "referrers" && formData.type === "Patient") && (
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Orthopaedics"
                      data-testid="input-name"
                    />
                  </div>
                )}
                {selectedTable === "referrers" && formData.type === "Patient" && formData.name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name (from patient)</label>
                    <Input
                      value={formData.name}
                      readOnly
                      disabled
                      className="bg-muted"
                      data-testid="input-name"
                    />
                  </div>
                )}
              </>
            )}
            {!hideStatusDisplayOrder && (
              <>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <SearchableSelect
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                    options={[
                      { value: "Active", label: "Active" },
                      { value: "Inactive", label: "Inactive" },
                    ]}
                    data-testid="select-status"
                  />
                </div>
              </>
            )}

            {extraFields.length > 0 && (
              <div className="border-t pt-4 mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Fields</p>
                <div className="space-y-3">
                  {extraFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-sm font-medium">{field.label}</label>
                      {field.type === "boolean" ? (
                        <div className="flex gap-2 mt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={formData[field.key] ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setFormData({ ...formData, [field.key]: true })}
                            data-testid={`select-${field.key}-yes`}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!formData[field.key] ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setFormData({ ...formData, [field.key]: false })}
                            data-testid={`select-${field.key}-no`}
                          >
                            No
                          </Button>
                        </div>
                      ) : field.type === "select" && field.options ? (
                        <SearchableSelect
                          value={formData[field.key] || ""}
                          onValueChange={(val) => {
                            const updates: Record<string, any> = { [field.key]: val };
                            if (selectedTable === "referrers" && field.key === "type" && val !== "Patient") {
                              updates.linkedLeadId = null;
                            }
                            setFormData({ ...formData, ...updates });
                          }}
                          options={field.options.map((opt) => ({ value: opt, label: opt }))}
                          placeholder={`Select ${field.label}`}
                          data-testid={`select-${field.key}`}
                        />
                      ) : field.type === "multiselect" && field.options ? (
                        editingRecord ? (
                          <SearchableSelect
                            value={formData[field.key] || ""}
                            onValueChange={(val) => setFormData({ ...formData, [field.key]: val })}
                            options={field.options.map((opt) => ({ value: opt, label: opt }))}
                            placeholder={`Select ${field.label}`}
                            data-testid={`select-${field.key}`}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {field.options.map((opt) => {
                              const selected = Array.isArray(formData[field.key]) && formData[field.key].includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                                  }`}
                                  onClick={() => {
                                    const current = Array.isArray(formData[field.key]) ? formData[field.key] : [];
                                    const updated = selected
                                      ? current.filter((d: string) => d !== opt)
                                      : [...current, opt];
                                    setFormData({ ...formData, [field.key]: updated });
                                  }}
                                  data-testid={`toggle-${field.key}-${opt}`}
                                >
                                  {opt.substring(0, 3)}
                                </button>
                              );
                            })}
                            {(() => {
                              const currentDays = Array.isArray(formData[field.key]) ? formData[field.key] : [];
                              const monSat = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                              const isMonSat = monSat.every(d => currentDays.includes(d)) && !currentDays.includes("Sunday");
                              const isAll = field.options!.every((d: string) => currentDays.includes(d));
                              return (
                                <>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-dashed transition-colors ${
                                      isMonSat ? "bg-primary/10 border-primary text-primary" : "border-primary text-primary hover:bg-primary/10"
                                    }`}
                                    onClick={() => setFormData({ ...formData, [field.key]: isMonSat ? [] : [...monSat] })}
                                    data-testid={`toggle-${field.key}-mon-sat`}
                                  >
                                    Mon–Sat
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-dashed transition-colors ${
                                      isAll ? "bg-primary/10 border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground hover:bg-accent"
                                    }`}
                                    onClick={() => setFormData({ ...formData, [field.key]: isAll ? [] : [...field.options!] })}
                                    data-testid={`toggle-${field.key}-all`}
                                  >
                                    All 7
                                  </button>
                                  {currentDays.length > 0 && (
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                                      onClick={() => setFormData({ ...formData, [field.key]: [] })}
                                      data-testid={`toggle-${field.key}-clear`}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )
                      ) : field.type === "ref" && field.refTable ? (
                        <SearchableSelect
                          value={formData[field.key] ? String(formData[field.key]) : ""}
                          onValueChange={(val) => {
                            const updates: Record<string, any> = { [field.key]: parseInt(val) || 0 };
                            if (field.key === "crmUserId" && selectedTable === "doctors") {
                              const chosen = (refDataMap[field.refTable!] || []).find((r: any) => String(r.id) === val);
                              if (chosen) {
                                if (chosen.name) updates.name = chosen.name;
                                if (chosen.phone) updates.phone = chosen.phone;
                                if ((chosen as any).email) updates.email = (chosen as any).email;
                              }
                            }
                            setFormData({ ...formData, ...updates });
                          }}
                          options={(refDataMap[field.refTable] || [])
                            .filter((r: any) => field.refTable === "docCrmUsers" || r.status === "Active")
                            .map((r: any) => ({ value: String(r.id), label: r.name }))}
                          placeholder={`Select ${field.label}`}
                          data-testid={`select-${field.key}`}
                        />
                      ) : field.type === "multiref" && field.refTable ? (
                        editingRecord ? (
                          <SearchableSelect
                            value={formData[field.key] ? String(formData[field.key]) : ""}
                            onValueChange={(val) => setFormData({ ...formData, [field.key]: parseInt(val) || 0 })}
                            options={(refDataMap[field.refTable] || [])
                              .filter((r: any) => r.status === "Active")
                              .map((r: any) => ({ value: String(r.id), label: r.name }))}
                            placeholder={`Select ${field.label}`}
                            data-testid={`select-${field.key}`}
                          />
                        ) : (
                          <div className="space-y-2 mt-1">
                            <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto border rounded-md p-2">
                              {(refDataMap[field.refTable] || [])
                                .filter((r: any) => r.status === "Active")
                                .map((r: any) => {
                                  const selectedIds = Array.isArray(formData[field.key]) ? formData[field.key] : [];
                                  const isSelected = selectedIds.includes(r.id);
                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-muted text-muted-foreground border-border hover:bg-accent"
                                      }`}
                                      onClick={() => {
                                        const current = Array.isArray(formData[field.key]) ? formData[field.key] : [];
                                        const updated = isSelected
                                          ? current.filter((id: number) => id !== r.id)
                                          : [...current, r.id];
                                        setFormData({ ...formData, [field.key]: updated });
                                      }}
                                      data-testid={`toggle-${field.key}-${r.id}`}
                                    >
                                      {r.name}
                                    </button>
                                  );
                                })}
                            </div>
                            {Array.isArray(formData[field.key]) && formData[field.key].length > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {formData[field.key].length} selected
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-destructive hover:underline"
                                  onClick={() => setFormData({ ...formData, [field.key]: [] })}
                                  data-testid={`clear-${field.key}`}
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      ) : field.type === "patient-picker" ? (
                        <div className="mt-1">
                          <PatientSearchSelect
                            value={formData[field.key] ? Number(formData[field.key]) : null}
                            onSelect={(p: PatientSearchResult | null) => {
                              if (p) {
                                setFormData({
                                  ...formData,
                                  [field.key]: p.id,
                                  name: p.name,
                                  phone: p.phoneE164 || formData.phone || "",
                                  email: p.email || formData.email || "",
                                });
                              } else {
                                setFormData({ ...formData, [field.key]: null });
                              }
                            }}
                            placeholder="Search patient by name or phone..."
                            data-testid={`input-${field.key}`}
                          />
                          {formData[field.key] && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Patient selected — name, phone and email have been auto-filled above.
                            </p>
                          )}
                        </div>
                      ) : field.type === "time" ? (
                        <Input
                          type="time"
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          data-testid={`input-${field.key}`}
                        />
                      ) : field.type === "date" ? (
                        <Input
                          type="date"
                          value={formData[field.key] ?? ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          data-testid={`input-${field.key}`}
                        />
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

              {importResult.sentToApproval && importResult.successCount > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300" data-testid="text-approval-queue-notice">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  <span>{importResult.successCount} record(s) have been sent to the approval queue. An admin must approve them before they become active.</span>
                </div>
              )}

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
    </AppLayout>
  );
}
