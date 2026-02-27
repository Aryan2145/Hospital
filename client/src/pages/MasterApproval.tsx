import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Database, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { format } from "date-fns";

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
      return format(new Date(value), "MMM d, yyyy");
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function MasterApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["/api/masters-pending"],
    queryFn: async () => {
      const res = await fetch("/api/masters-pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending items");
      return res.json();
    },
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

  const getDisplayFields = (item: any) => {
    const entries: { label: string; value: string }[] = [];
    const seen = new Set<string>();

    for (const [key, value] of Object.entries(item)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      if (key.startsWith("_")) continue;
      const lowerKey = key.toLowerCase();
      if (seen.has(lowerKey)) continue;
      seen.add(lowerKey);

      if (value === null || value === undefined || value === "") continue;

      entries.push({
        label: formatFieldLabel(key),
        value: formatFieldValue(value),
      });
    }
    return entries;
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-approval-title">
            <Database className="w-5 h-5 text-primary" />
            Master Data Approval
          </h1>
          <p className="text-sm text-muted-foreground">Review and approve master data items before they become active</p>
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
              const fields = getDisplayFields(item);

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
                          {item.createdAt && <span>Created {format(new Date(item.createdAt), "MMM d, h:mm a")}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                          className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => approveMutation.mutate({ tableName: item.tableName, id: item.id })}
                          disabled={approveMutation.isPending}
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
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${item.tableName}-${item.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                        {fields.map((f, idx) => (
                          <div key={idx} className="flex flex-col" data-testid={`field-${f.label.toLowerCase().replace(/\s+/g, "-")}`}>
                            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{f.label}</span>
                            <span className="text-sm text-foreground">{f.value}</span>
                          </div>
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
