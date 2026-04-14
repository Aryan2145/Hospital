import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Trash2, Plus, UserCheck, Clock, Save } from "lucide-react";
import { fmtDate } from "@/lib/date-utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useEffect } from "react";

export default function DiscountApproversPage() {
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [slaInput, setSlaInput] = useState<string>("");

  const { data: approvers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/discount-approvers"],
    queryFn: async () => {
      const res = await fetch("/api/discount-approvers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: slaSettings, isLoading: slaLoading } = useQuery<{ discountApprovalSlaHours: number }>({
    queryKey: ["/api/settings/discount-sla"],
    queryFn: async () => {
      const res = await fetch("/api/settings/discount-sla", { credentials: "include" });
      if (!res.ok) return { discountApprovalSlaHours: 4 };
      return res.json();
    },
  });

  useEffect(() => {
    if (slaSettings && slaInput === "") {
      setSlaInput(String(slaSettings.discountApprovalSlaHours));
    }
  }, [slaSettings]);

  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addApprover = useMutation({
    mutationFn: async (crmUserId: number) => {
      await apiRequest("POST", "/api/discount-approvers", { crmUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-approvers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discount-approvers/me"] });
      toast({ title: "Discount approver added" });
      setSelectedUserId("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeApprover = useMutation({
    mutationFn: async (crmUserId: number) => {
      await apiRequest("DELETE", `/api/discount-approvers/${crmUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-approvers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discount-approvers/me"] });
      toast({ title: "Discount approver removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveSla = useMutation({
    mutationFn: async (hours: number) => {
      await apiRequest("PUT", "/api/settings/discount-sla", { discountApprovalSlaHours: hours });
    },
    onSuccess: (_, hours) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/discount-sla"] });
      toast({ title: `SLA window updated to ${hours} hours` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approverIds = new Set(approvers.map((a: any) => a.crmUserId));
  const availableUsers = (crmUsers as any[]).filter((u: any) => !approverIds.has(u.id));

  const handleSaveSla = () => {
    const hours = parseInt(slaInput, 10);
    if (!hours || hours < 1 || hours > 720) {
      toast({ title: "Invalid SLA", description: "Please enter a value between 1 and 720 hours", variant: "destructive" });
      return;
    }
    saveSla.mutate(hours);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading discount approvers..." />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground" data-testid="text-page-title">Discount Approvers</h1>
            <p className="text-xs text-muted-foreground">
              Configure which CRM users can approve discount requests and set the escalation SLA window
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card className="p-4" data-testid="card-discount-approvers-info">
          <div className="flex items-start gap-3">
            <UserCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                When discount approvers are configured, <strong>only the designated approvers</strong> will be able to
                approve or revoke discount requests on episode financial records.
              </p>
              <p>
                If <strong>no approvers are configured</strong>, the system falls back to allowing any{" "}
                <Badge variant="outline" className="text-xs">Admin</Badge> or{" "}
                <Badge variant="outline" className="text-xs">System Admin</Badge> to approve discounts.
              </p>
              <p>
                Approvers receive <strong>in-app notifications, email, and SMS alerts</strong> when a discount is requested.
              </p>
            </div>
          </div>
        </Card>

        {isAdmin && (
          <Card className="p-4" data-testid="card-sla-settings">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Escalation SLA Window
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              If no approver acts on a pending discount request within this time window, the system automatically
              escalates it to all Admin users via notification, email, and SMS.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="sla-hours" className="text-xs text-muted-foreground mb-1 block">SLA Window (hours)</Label>
                <Input
                  id="sla-hours"
                  type="number"
                  min={1}
                  max={720}
                  value={slaInput}
                  onChange={(e) => setSlaInput(e.target.value)}
                  placeholder={slaLoading ? "Loading..." : "4"}
                  disabled={slaLoading}
                  className="h-8 text-sm"
                  data-testid="input-sla-hours"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSaveSla}
                disabled={saveSla.isPending || slaLoading}
                data-testid="button-save-sla"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saveSla.isPending ? "Saving..." : "Save"}
              </Button>
              {slaSettings && (
                <p className="text-xs text-muted-foreground">
                  Current: <strong>{slaSettings.discountApprovalSlaHours}h</strong>
                </p>
              )}
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card className="p-4" data-testid="card-add-approver">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Add Discount Approver
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchableSelect
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  options={availableUsers.map((u: any) => ({
                    value: String(u.id),
                    label: u.name,
                  }))}
                  placeholder="Search and select a CRM user..."
                  triggerClassName="w-full"
                  data-testid="select-add-approver-user"
                />
              </div>
              <Button
                onClick={() => selectedUserId && addApprover.mutate(Number(selectedUserId))}
                disabled={!selectedUserId || addApprover.isPending}
                data-testid="button-add-approver"
              >
                <Plus className="w-4 h-4 mr-1" />
                {addApprover.isPending ? "Adding..." : "Add Approver"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-4" data-testid="card-approvers-list">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Current Approvers
            {approvers.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">{approvers.length}</Badge>
            )}
          </h3>

          {approvers.length === 0 ? (
            <div className="text-center py-8" data-testid="text-no-approvers">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No discount approvers configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Falling back to Admin / System Admin role for discount approvals
              </p>
            </div>
          ) : (
            <Table data-testid="table-approvers">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Designation</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Added On</TableHead>
                  {isAdmin && <TableHead className="text-xs text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvers.map((approver: any) => (
                  <TableRow key={approver.id} data-testid={`row-approver-${approver.crmUserId}`}>
                    <TableCell className="text-sm font-medium" data-testid={`text-approver-name-${approver.crmUserId}`}>
                      {approver.userName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" data-testid={`text-approver-designation-${approver.crmUserId}`}>
                      {approver.designationName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" data-testid={`text-approver-email-${approver.crmUserId}`}>
                      {approver.userEmail || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {approver.createdAt ? fmtDate(approver.createdAt) : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeApprover.mutate(approver.crmUserId)}
                          disabled={removeApprover.isPending}
                          data-testid={`button-remove-approver-${approver.crmUserId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
