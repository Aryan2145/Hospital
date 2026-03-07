import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Database, ChevronDown, ChevronUp, Eye, Pencil, Save, X } from "lucide-react";
import { fmtDate } from "@/lib/date-utils";

interface ExtraField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "ref" | "time" | "multiselect" | "multiref" | "date";
  options?: string[];
  refTable?: string;
}

const EXTRA_FIELDS: Record<string, ExtraField[]> = {
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
    { key: "departmentId", label: "Team", type: "ref", refTable: "administrativeDepartments" },
    { key: "designationId", label: "Designation", type: "ref", refTable: "designations" },
    { key: "employmentTypeId", label: "Employment Type", type: "ref", refTable: "employmentTypes" },
    { key: "systemRoleId", label: "System Role", type: "ref", refTable: "systemRoles" },
    { key: "accessScopeType", label: "Access Scope", type: "select", options: ["All", "Branch", "Team", "Self"] },
    { key: "phiAccessLevel", label: "PHI Access Level", type: "select", options: ["Full", "Masked", "None"] },
    { key: "isActive", label: "Is Active", type: "boolean" },
  ],
  doctors: [
    { key: "specialization", label: "Specialization", type: "text" },
    { key: "qualification", label: "Qualification", type: "text" },
    { key: "branchId", label: "Branch", type: "ref", refTable: "branches" },
    { key: "treatmentDepartmentId", label: "Department", type: "ref", refTable: "treatmentDepartments" },
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
  leadSources: [
    { key: "categoryId", label: "Source Category", type: "ref", refTable: "leadSourceCategories" },
  ],
  referrers: [
    { key: "type", label: "Type", type: "select", options: ["Doctor", "Patient", "Hospital", "Agent", "Other"] },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ],
  corporateInsurances: [
    { key: "type", label: "Type", type: "select", options: ["Corporate", "Insurance", "TPA"] },
  ],
  conversionStages: [
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
    { key: "isBusinessAchieved", label: "Is Business Achieved", type: "boolean" },
  ],
  leadStatuses: [
    { key: "isTerminal", label: "Is Terminal", type: "boolean" },
    { key: "isBusinessAchieved", label: "Is Business Achieved", type: "boolean" },
    { key: "requiresNextTask", label: "Requires Next Task", type: "boolean" },
    { key: "allowNurtureOption", label: "Allow Nurture Option", type: "boolean" },
    { key: "defaultOwnerRole", label: "Default Owner Role", type: "select", options: ["AGENT", "COUNSELLOR", "MANAGER", "ADMIN"] },
  ],
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
  slaRules: [
    { key: "triggerEvent", label: "Trigger Event", type: "text" },
    { key: "timeLimitMinutes", label: "Time Limit (minutes)", type: "number" },
    { key: "appliesToRole", label: "Applies To Role", type: "select", options: ["AGENT", "COUNSELLOR", "MANAGER", "ADMIN", "All"] },
    { key: "escalationRole", label: "Escalation Role", type: "select", options: ["MANAGER", "ADMIN", "SYS_ADMIN"] },
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
};

const HIDDEN_FIELDS = new Set([
  "id", "tenantId", "tenant_id", "table_name", "tableName",
  "_allFields", "createdAt", "created_at", "modifiedAt", "modified_at",
  "approvalStatus", "approval_status",
]);

const FIELD_LABELS: Record<string, string> = {
  code: "Code",
  name: "Name",
  status: "Status",
  displayOrder: "Display Order",
  createdBy: "Created By",
  qualification: "Qualification",
  specialization: "Specialization",
  branchId: "Branch",
  treatmentDepartmentId: "Department",
  phone: "Phone",
  email: "Email",
  categoryId: "Category",
  doctorId: "Doctor",
  dayOfWeek: "Day of Week",
  startTime: "Start Time",
  endTime: "End Time",
  maxPatients: "Max Patients",
  slotDuration: "Slot Duration (min)",
  leaveDate: "Leave Date",
  leaveEndDate: "Leave End Date",
  reason: "Reason",
  type: "Type",
  address: "Address",
  pinCode: "PIN Code",
  serviceable: "Serviceable",
  organisationId: "Organisation",
  cityId: "City",
  stateId: "State",
  countryId: "Country",
  phoneNumber: "Phone Number",
  provider: "Provider",
};

const NON_EDITABLE_FIELDS = new Set(["createdBy"]);

function formatFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/ Id$/, "")
    .trim();
}

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try {
      return fmtDate(new Date(value));
    } catch {
      return String(value);
    }
  }
  return String(value);
}

interface RefRecord {
  id: number;
  name: string;
  code?: string;
}

function EditableField({
  fieldKey,
  label,
  value,
  onChange,
  extraField,
  refData,
}: {
  fieldKey: string;
  label: string;
  value: any;
  onChange: (val: any) => void;
  extraField?: ExtraField;
  refData: Record<string, RefRecord[]>;
}) {
  if (extraField) {
    if (extraField.type === "ref" && extraField.refTable) {
      const options = (refData[extraField.refTable] || []).map((r) => ({
        value: String(r.id),
        label: r.name,
      }));
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <SearchableSelect
            value={value ? String(value) : ""}
            onValueChange={(v) => onChange(v ? Number(v) : null)}
            options={options}
            placeholder={`Select ${label}`}
            data-testid={`edit-field-${fieldKey}`}
          />
        </div>
      );
    }
    if (extraField.type === "select" && extraField.options) {
      const options = extraField.options.map((o) => ({ value: o, label: o }));
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <SearchableSelect
            value={value || ""}
            onValueChange={onChange}
            options={options}
            placeholder={`Select ${label}`}
            data-testid={`edit-field-${fieldKey}`}
          />
        </div>
      );
    }
    if (extraField.type === "boolean") {
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={!!value}
              onCheckedChange={onChange}
              data-testid={`edit-field-${fieldKey}`}
            />
            <span className="text-sm text-foreground">{value ? "Yes" : "No"}</span>
          </div>
        </div>
      );
    }
    if (extraField.type === "number") {
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            data-testid={`edit-field-${fieldKey}`}
          />
        </div>
      );
    }
    if (extraField.type === "date") {
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <Input
            type="date"
            value={value ? String(value).slice(0, 10) : ""}
            onChange={(e) => onChange(e.target.value || null)}
            data-testid={`edit-field-${fieldKey}`}
          />
        </div>
      );
    }
    if (extraField.type === "time") {
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <Input
            type="time"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            data-testid={`edit-field-${fieldKey}`}
          />
        </div>
      );
    }
    if (extraField.type === "multiselect" && extraField.options) {
      const selected: string[] = Array.isArray(value) ? value : value ? String(value).split(",").map((s: string) => s.trim()) : [];
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
          <div className="flex flex-wrap gap-1.5">
            {extraField.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  selected.includes(opt) ? "bg-primary text-white border-primary" : "bg-background border-border hover:bg-muted"
                }`}
                onClick={() => {
                  const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
                  onChange(next);
                }}
                data-testid={`edit-field-${fieldKey}-${opt}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }
  }

  if (fieldKey === "status") {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
        <SearchableSelect
          value={value || "Active"}
          onValueChange={onChange}
          options={[
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
          ]}
          placeholder="Select Status"
          data-testid={`edit-field-${fieldKey}`}
        />
      </div>
    );
  }

  if (fieldKey === "displayOrder") {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          data-testid={`edit-field-${fieldKey}`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
      <Input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`edit-field-${fieldKey}`}
      />
    </div>
  );
}

export default function MasterApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["/api/masters-pending"],
    queryFn: async () => {
      const res = await fetch("/api/masters-pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending items");
      return res.json();
    },
  });

  const neededRefTables = (() => {
    if (!pendingItems?.length) return [];
    const tables = new Set<string>();
    for (const item of pendingItems) {
      const extras = EXTRA_FIELDS[item.tableName] || [];
      for (const f of extras) {
        if ((f.type === "ref" || f.type === "multiref") && f.refTable) {
          tables.add(f.refTable);
        }
      }
    }
    return Array.from(tables);
  })();

  const { data: refDataMap = {} } = useQuery<Record<string, RefRecord[]>>({
    queryKey: ["/api/masters/ref-data", ...neededRefTables],
    queryFn: async () => {
      const result: Record<string, RefRecord[]> = {};
      await Promise.all(
        neededRefTables.map(async (tbl) => {
          try {
            const res = await fetch(`/api/masters/${tbl}`, { credentials: "include" });
            if (res.ok) {
              result[tbl] = await res.json();
            }
          } catch {}
        })
      );
      return result;
    },
    enabled: neededRefTables.length > 0,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      const res = await fetch(`/api/masters/${tableName}/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
      toast({ title: "Item approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      const res = await fetch(`/api/masters/${tableName}/${id}/reject`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
      toast({ title: "Item rejected" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ tableName, id, data }: { tableName: string; id: number; data: Record<string, any> }) => {
      const res = await fetch(`/api/masters/${tableName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to update" }));
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
    },
  });

  const saveAndApproveMutation = useMutation({
    mutationFn: async ({ tableName, id, data }: { tableName: string; id: number; data: Record<string, any> }) => {
      const updateRes = await fetch(`/api/masters/${tableName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({ message: "Failed to update" }));
        throw new Error(err.message || "Failed to update");
      }
      const approveRes = await fetch(`/api/masters/${tableName}/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!approveRes.ok) throw new Error("Failed to approve");
      return approveRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
      setEditingItem(null);
      toast({ title: "Changes saved and item approved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formatTableName = (name: string) => {
    return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
  };

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEditing = (item: any) => {
    const itemKey = `${item.tableName}-${item.id}`;
    const formValues: Record<string, any> = {};
    for (const [key, value] of Object.entries(item)) {
      if (!HIDDEN_FIELDS.has(key) && !key.startsWith("_") && !NON_EDITABLE_FIELDS.has(key)) {
        formValues[key] = value;
      }
    }
    setEditFormData(formValues);
    setEditingItem(itemKey);
    setExpandedItems((prev) => new Set(prev).add(itemKey));
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditFormData({});
  };

  const normalizeFormData = (item: any) => {
    const changedData: Record<string, any> = {};
    const extras = EXTRA_FIELDS[item.tableName] || [];
    for (const [key, value] of Object.entries(editFormData)) {
      if (HIDDEN_FIELDS.has(key) || NON_EDITABLE_FIELDS.has(key)) continue;
      const ef = extras.find((f) => f.key === key);
      if (ef?.type === "multiselect" && Array.isArray(value)) {
        changedData[key] = value.join(", ");
      } else {
        changedData[key] = value;
      }
    }
    return changedData;
  };

  const handleSaveOnly = async (item: any) => {
    const changedData = normalizeFormData(item);
    try {
      await updateMutation.mutateAsync({ tableName: item.tableName, id: item.id, data: changedData });
      setEditingItem(null);
      toast({ title: "Changes saved", description: "Record updated but still pending approval." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveAndApprove = (item: any) => {
    const changedData = normalizeFormData(item);
    saveAndApproveMutation.mutate({ tableName: item.tableName, id: item.id, data: changedData });
  };

  const getDisplayFields = (item: any) => {
    const entries: { key: string; label: string; value: string }[] = [];
    const seen = new Set<string>();

    for (const [key, value] of Object.entries(item)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      if (key.startsWith("_")) continue;
      const lowerKey = key.toLowerCase();
      if (seen.has(lowerKey)) continue;
      seen.add(lowerKey);

      if (value === null || value === undefined || value === "") continue;

      entries.push({
        key,
        label: formatFieldLabel(key),
        value: formatFieldValue(value),
      });
    }
    return entries;
  };

  const getEditableFields = (item: any) => {
    const commonFields = [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "status", label: "Status" },
      { key: "displayOrder", label: "Display Order" },
    ];

    const extras = EXTRA_FIELDS[item.tableName] || [];

    const allKeys = new Set<string>();
    const fields: { key: string; label: string; extraField?: ExtraField }[] = [];

    for (const cf of commonFields) {
      if (item[cf.key] !== undefined || cf.key === "status" || cf.key === "displayOrder") {
        allKeys.add(cf.key);
        fields.push({ key: cf.key, label: cf.label });
      }
    }

    for (const ef of extras) {
      if (!allKeys.has(ef.key)) {
        allKeys.add(ef.key);
        fields.push({ key: ef.key, label: ef.label, extraField: ef });
      }
    }

    return fields;
  };

  const getRefName = (refTable: string, id: any): string => {
    if (!id) return "—";
    const records = refDataMap[refTable] || [];
    const found = records.find((r) => r.id === Number(id));
    return found ? found.name : `#${id}`;
  };

  const resolveDisplayValue = (item: any, key: string, fallback: string): string => {
    const value = item[key];
    const extras = EXTRA_FIELDS[item.tableName] || [];
    const extraField = extras.find((f) => f.key === key);
    if (extraField?.type === "ref" && extraField.refTable) {
      return getRefName(extraField.refTable, value);
    }
    if (extraField?.type === "boolean") {
      return value ? "Yes" : "No";
    }
    if (extraField?.type === "select" || extraField?.type === "multiselect") {
      return value ? String(value) : "—";
    }
    return fallback;
  };

  const isBusy = approveMutation.isPending || rejectMutation.isPending || updateMutation.isPending || saveAndApproveMutation.isPending;

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-approval-title">
            <Database className="w-5 h-5 text-primary" />
            Master Data Approval
          </h1>
          <p className="text-sm text-muted-foreground">Review, edit and approve master data items before they become active</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading pending items...</div>
        ) : !pendingItems?.length ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending master data items to review.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{pendingItems.length} item(s) pending approval</p>
            {pendingItems.map((item: any) => {
              const itemKey = `${item.tableName}-${item.id}`;
              const isExpanded = expandedItems.has(itemKey);
              const isEditing = editingItem === itemKey;
              const fields = getDisplayFields(item);
              const editableFields = getEditableFields(item);

              return (
                <Card key={itemKey} className="overflow-hidden" data-testid={`card-approval-${item.tableName}-${item.id}`}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground text-sm">{item.name}</span>
                          <Badge variant="outline" className="text-[10px]">{formatTableName(item.tableName)}</Badge>
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                            <Clock className="w-2.5 h-2.5 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Code: <span className="font-mono">{item.code}</span></span>
                          {item.createdBy && <span>By: {item.createdBy}</span>}
                          {item.createdAt && <span>Created {fmtDate(item.createdAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              onClick={() => toggleExpand(itemKey)}
                              data-testid={`button-details-${item.tableName}-${item.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Details
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-700 border-blue-300 hover:bg-blue-50"
                              onClick={() => startEditing(item)}
                              data-testid={`button-edit-${item.tableName}-${item.id}`}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => approveMutation.mutate({ tableName: item.tableName, id: item.id })}
                              disabled={isBusy}
                              data-testid={`button-approve-${item.tableName}-${item.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate({ tableName: item.tableName, id: item.id })}
                              disabled={isBusy}
                              data-testid={`button-reject-${item.tableName}-${item.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {isEditing && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-muted-foreground"
                              onClick={cancelEditing}
                              disabled={isBusy}
                              data-testid={`button-cancel-edit-${item.tableName}-${item.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-700 border-blue-300 hover:bg-blue-50"
                              onClick={() => handleSaveOnly(item)}
                              disabled={isBusy}
                              data-testid={`button-save-${item.tableName}-${item.id}`}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleSaveAndApprove(item)}
                              disabled={isBusy}
                              data-testid={`button-save-approve-${item.tableName}-${item.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Save & Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && !isEditing && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                        {fields.map((f, idx) => (
                          <div key={idx} className="flex flex-col" data-testid={`field-${f.label.toLowerCase().replace(/\s+/g, "-")}`}>
                            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{f.label}</span>
                            <span className="text-sm text-foreground">{resolveDisplayValue(item, f.key, f.value)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-700 border-blue-300 hover:bg-blue-50"
                          onClick={() => startEditing(item)}
                          data-testid={`button-edit-details-${item.tableName}-${item.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit & Correct
                        </Button>
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="border-t bg-blue-50/40 px-4 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                        {editableFields.map((field) => (
                          <EditableField
                            key={field.key}
                            fieldKey={field.key}
                            label={field.label}
                            value={editFormData[field.key]}
                            onChange={(val) => setEditFormData((prev) => ({ ...prev, [field.key]: val }))}
                            extraField={field.extraField}
                            refData={refDataMap}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
