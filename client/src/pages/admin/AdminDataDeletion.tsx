import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Eye, Clock, CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  "Received": "bg-blue-100 text-blue-700",
  "Under Review": "bg-amber-100 text-amber-700",
  "Action Taken": "bg-purple-100 text-purple-700",
  "Completed": "bg-green-100 text-green-700",
  "Rejected": "bg-red-100 text-red-700",
};

const VERIFICATION_COLORS: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  "Auto Matched": "bg-teal-100 text-teal-700",
  "Manual Verification Required": "bg-orange-100 text-orange-700",
  "Verified": "bg-green-100 text-green-700",
  "Verification Failed": "bg-red-100 text-red-700",
};

export default function AdminDataDeletion() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionNotes, setActionNotes] = useState("");

  const { data: requests = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/data-deletion-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/data-deletion-requests?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["/api/admin/data-deletion-requests", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/data-deletion-requests/${selectedId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch detail");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const verificationMutation = useMutation({
    mutationFn: async (data: { id: number; verificationStatus: string; adminNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/data-deletion-requests/${data.id}/verification`, { verificationStatus: data.verificationStatus, adminNotes: data.adminNotes });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verification status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-deletion-requests"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async (data: { id: number; action: string; reason: string; adminNotes: string }) => {
      const res = await apiRequest("POST", `/api/admin/data-deletion-requests/${data.id}/action`, { action: data.action, reason: data.reason, adminNotes: data.adminNotes });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action taken successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-deletion-requests"] });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredRequests = requests.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.referenceNumber || "").toLowerCase().includes(q) ||
      (r.fullName || "").toLowerCase().includes(q) ||
      (r.mobileNumber || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.hospitalOrTenantName || "").toLowerCase().includes(q);
  });

  const openDetail = (id: number) => {
    setSelectedId(id);
    const record = requests.find(r => r.id === id);
    if (record) {
      setVerificationStatus(record.verificationStatus || "");
      setVerificationNotes(record.adminNotes || "");
      setActionValue("");
      setActionReason("");
      setActionNotes("");
    }
  };

  return (
    <AdminLayout>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" />
            Data Deletion Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and process DPDP/Meta compliance data deletion requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by reference, name, mobile, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Received">Received</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Action Taken">Action Taken</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading requests...</p>
      ) : filteredRequests.length === 0 ? (
        <Card className="p-8 text-center">
          <Trash2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No data deletion requests found</p>
        </Card>
      ) : (
        <Card className="overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Reference</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Requester</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Hospital</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Matched</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Verification</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Received</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(r => {
                const matched = r.matchedRecordsSummary as any;
                const matchCount = (matched?.leads || 0) + (matched?.contactPersons || 0);
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 font-mono text-xs font-semibold text-primary">{r.referenceNumber}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-sm">{r.fullName}</div>
                      <div className="text-xs text-muted-foreground">{r.mobileNumber || r.email}</div>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{r.hospitalOrTenantName || "—"}</td>
                    <td className="py-2 px-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", matchCount > 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500")}>
                        {matchCount > 0 ? `${matchCount} record(s)` : "No match"}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.requestStatus] || "bg-slate-100 text-slate-600")}>
                        {r.requestStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", VERIFICATION_COLORS[r.verificationStatus] || "bg-slate-100 text-slate-600")}>
                        {r.verificationStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {r.requestedAt ? format(new Date(r.requestedAt), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDetail(r.id)}>
                        <Eye className="w-3 h-3 mr-1" /> Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              {detail?.referenceNumber || "Loading..."}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-5 text-sm">
              {/* Requester info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                <InfoRow label="Name" value={detail.fullName} />
                <InfoRow label="Mobile" value={detail.mobileNumber || "—"} />
                <InfoRow label="Email" value={detail.email || "—"} />
                <InfoRow label="Hospital" value={detail.hospitalOrTenantName || "—"} />
                <InfoRow label="Interaction Date" value={detail.approximateInteractionDate || "—"} />
                <InfoRow label="Source" value={detail.sourceOfInteraction || "—"} />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Request Description</p>
                <p className="text-sm">{detail.requestDescription}</p>
              </div>

              {/* Matched records */}
              {detail.matchedRecordsSummary && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-xs font-medium text-teal-800 mb-1">Auto-Matched Records</p>
                  <p className="text-sm text-teal-700">
                    {(detail.matchedRecordsSummary as any).leads || 0} lead(s), {(detail.matchedRecordsSummary as any).contactPersons || 0} contact person(s)
                  </p>
                </div>
              )}

              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium", STATUS_COLORS[detail.requestStatus] || "bg-slate-100")}>
                  Status: {detail.requestStatus}
                </span>
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium", VERIFICATION_COLORS[detail.verificationStatus] || "bg-slate-100")}>
                  Verification: {detail.verificationStatus}
                </span>
                {detail.actionTaken && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                    Action: {detail.actionTaken}
                  </span>
                )}
              </div>

              {/* Already completed */}
              {(detail.requestStatus === "Completed" || detail.requestStatus === "Rejected") ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  This request has been {detail.requestStatus === "Completed" ? "completed" : "rejected"}
                  {detail.processedAt ? ` on ${format(new Date(detail.processedAt), "dd MMM yyyy")}` : ""}.
                  {detail.retentionReason && <span> Reason: {detail.retentionReason}</span>}
                </div>
              ) : (
                <>
                  {/* Verification update */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold">Update Verification Status</h3>
                    <div>
                      <Label className="text-xs">Verification Status</Label>
                      <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {["Not Started", "Auto Matched", "Manual Verification Required", "Verified", "Verification Failed"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Admin Notes</Label>
                      <Textarea value={verificationNotes} onChange={e => setVerificationNotes(e.target.value)} placeholder="Optional notes about verification..." rows={2} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => verificationMutation.mutate({ id: detail.id, verificationStatus, adminNotes: verificationNotes })} disabled={verificationMutation.isPending}>
                      {verificationMutation.isPending ? "Saving..." : "Save Verification Status"}
                    </Button>
                  </div>

                  {/* Final action */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold">Take Final Action</h3>
                    <div>
                      <Label className="text-xs">Action <span className="text-destructive">*</span></Label>
                      <Select value={actionValue} onValueChange={setActionValue}>
                        <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Anonymize">
                            <div>
                              <span className="font-medium">Anonymize</span>
                              <span className="text-xs text-muted-foreground ml-2">(Recommended) — Remove personal identifiers</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="Restrict">Restrict — Opt out of all communications</SelectItem>
                          <SelectItem value="Delete">Delete — Soft delete (blocked if clinical records exist)</SelectItem>
                          <SelectItem value="Retain">Retain — Keep data with documented reason</SelectItem>
                          <SelectItem value="Reject">Reject — Cannot fulfill request</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(actionValue === "Retain" || actionValue === "Reject") && (
                      <div>
                        <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
                        <Textarea value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Required for Retain and Reject actions..." rows={2} />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Admin Notes (optional)</Label>
                      <Textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)} placeholder="Any internal notes..." rows={2} />
                    </div>
                    <Button
                      size="sm"
                      variant={actionValue === "Delete" || actionValue === "Reject" ? "destructive" : "default"}
                      onClick={() => actionMutation.mutate({ id: detail.id, action: actionValue, reason: actionReason, adminNotes: actionNotes })}
                      disabled={!actionValue || actionMutation.isPending}
                    >
                      {actionMutation.isPending ? "Processing..." : `Confirm: ${actionValue || "Select action first"}`}
                    </Button>
                  </div>
                </>
              )}

              {/* Audit log */}
              {detail.auditLogs?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Audit Log</h3>
                  <div className="space-y-2">
                    {detail.auditLogs.map((log: any) => (
                      <div key={log.id} className="flex gap-3 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {log.createdAt ? format(new Date(log.createdAt), "dd MMM HH:mm") : "—"}
                        </span>
                        <span className="font-medium">{log.action.replace(/_/g, " ")}</span>
                        {log.newStatus && <span className="text-muted-foreground">→ {log.newStatus}</span>}
                        {log.notes && <span className="text-muted-foreground truncate">{log.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
