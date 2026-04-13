import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, UserCog, Plus, Trash2, Save, Users, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CODES = [
  { code: "SYS_ADMIN", label: "System Admin" },
  { code: "ADMIN", label: "Admin" },
  { code: "MANAGER", label: "Manager" },
  { code: "COUNSELLOR", label: "Counsellor" },
  { code: "AGENT", label: "Patient Coordinator" },
  { code: "TELECALLER", label: "Telecaller" },
  { code: "RECEPTIONIST", label: "Receptionist" },
  { code: "BILLING", label: "Billing Executive" },
  { code: "INSURANCE_DESK", label: "Insurance Desk" },
  { code: "DOCTOR", label: "Doctor" },
  { code: "MEDICAL_ASSISTANT", label: "Medical Assistant" },
  { code: "MIS_VIEWER", label: "MIS Viewer" },
];

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "episodes", label: "Episodes" },
  { key: "appointments", label: "Appointments" },
  { key: "campaigns", label: "Campaigns & Events" },
  { key: "transactions", label: "Transactions" },
  { key: "team", label: "Team" },
  { key: "masters", label: "Masters" },
  { key: "connectors", label: "Connectors & Config" },
  { key: "branding", label: "Branding" },
  { key: "settings", label: "Settings" },
  { key: "quotation", label: "Quotation" },
  { key: "insurance", label: "Insurance" },
  { key: "reports", label: "Reports" },
];

const PERMS = ["canView", "canCreate", "canEdit", "canDelete"] as const;
const PERM_LABELS: Record<string, string> = { canView: "View", canCreate: "Create", canEdit: "Edit", canDelete: "Delete" };

interface RolePermRow {
  id: number;
  tenantId: number;
  roleCode: string;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface CrmUserBasic {
  id: number;
  name: string;
  email: string | null;
  designation: string | null;
  isActive: boolean;
}

interface DiscountApprover {
  id: number;
  crmUserId: number;
  name: string | null;
  email: string | null;
  designation: string | null;
}

export default function AccessControlPage() {
  const { isAdmin, isSysAdmin, roleCode } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [addApproverOpen, setAddApproverOpen] = useState(false);
  const [selectedApproverUserId, setSelectedApproverUserId] = useState("");

  const { data: rolePerms } = useQuery<RolePermRow[]>({
    queryKey: ["/api/admin/role-permissions"],
    enabled: isAdmin,
  });

  const { data: teamUsers } = useQuery<CrmUserBasic[]>({
    queryKey: ["/api/crm-users/active"],
    enabled: isAdmin,
  });

  const { data: discountApprovers, refetch: refetchApprovers } = useQuery<DiscountApprover[]>({
    queryKey: ["/api/admin/discount-approvers"],
    enabled: isAdmin,
  });

  const permMap: Record<string, Record<string, boolean>> = {};
  (rolePerms || []).forEach(row => {
    const key = `${row.roleCode}::${row.module}`;
    permMap[key] = {
      canView: row.canView,
      canCreate: row.canCreate,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    };
  });

  const getPerm = (rc: string, mod: string, perm: string): boolean => {
    const changeKey = `${rc}::${mod}::${perm}`;
    if (pendingChanges[changeKey] !== undefined) return pendingChanges[changeKey][perm] ?? false;
    const rowKey = `${rc}::${mod}`;
    return permMap[rowKey]?.[perm] ?? false;
  };

  const togglePerm = (rc: string, mod: string, perm: string, val: boolean) => {
    if (rc === "SYS_ADMIN") return;
    const changeKey = `${rc}::${mod}::${perm}`;
    setPendingChanges(prev => ({ ...prev, [changeKey]: { [perm]: val } }));
  };

  const savePermsMutation = useMutation({
    mutationFn: async () => {
      const grouped: Record<string, Record<string, boolean>> = {};
      Object.entries(pendingChanges).forEach(([key, val]) => {
        const [rc, mod, perm] = key.split("::");
        if (!grouped[`${rc}::${mod}`]) grouped[`${rc}::${mod}`] = {};
        grouped[`${rc}::${mod}`][perm] = val[perm];
      });
      for (const [key, changes] of Object.entries(grouped)) {
        const [rc, mod] = key.split("::");
        const rowKey = `${rc}::${mod}`;
        const current = permMap[rowKey] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
        const merged = { ...current, ...changes };
        await apiRequest("PUT", `/api/admin/role-permissions/${rc}/${mod}`, merged);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/role-permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/my-permissions"] });
      setPendingChanges({});
      toast({ title: "Permissions saved successfully" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to save permissions", variant: "destructive" });
    },
  });

  const addApproverMutation = useMutation({
    mutationFn: (crmUserId: number) => apiRequest("POST", "/api/admin/discount-approvers", { crmUserId }),
    onSuccess: () => {
      refetchApprovers();
      setAddApproverOpen(false);
      setSelectedApproverUserId("");
      toast({ title: "Discount approver added" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to add approver", variant: "destructive" });
    },
  });

  const removeApproverMutation = useMutation({
    mutationFn: (crmUserId: number) => apiRequest("DELETE", `/api/admin/discount-approvers/${crmUserId}`),
    onSuccess: () => {
      refetchApprovers();
      toast({ title: "Approver removed" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to remove approver", variant: "destructive" });
    },
  });

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const approverUserIds = new Set((discountApprovers || []).map(a => a.crmUserId));
  const availableForApprover = (teamUsers || []).filter(u => !approverUserIds.has(u.id));

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-sm text-muted-foreground">Manage role-based permissions and discount approval authority</p>
        </div>
      </div>

      <Tabs defaultValue="role-permissions">
        <TabsList>
          <TabsTrigger value="role-permissions" data-testid="tab-role-permissions">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="discount-approvers" data-testid="tab-discount-approvers">
            <Users className="w-4 h-4 mr-2" />
            Discount Approvers
          </TabsTrigger>
        </TabsList>

        {/* ─── Role Permissions Tab ─────────────────────────────────────── */}
        <TabsContent value="role-permissions" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Permission Matrix</CardTitle>
                  <CardDescription>Configure what each role can view, create, edit, or delete per module.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-52" data-testid="select-role-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_CODES.map(r => (
                        <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPendingChanges && (
                    <Button onClick={() => savePermsMutation.mutate()} disabled={savePermsMutation.isPending} data-testid="button-save-permissions">
                      <Save className="w-4 h-4 mr-2" />
                      {savePermsMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  )}
                </div>
              </div>
              {selectedRole === "SYS_ADMIN" && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  System Admin always has full access to all modules. These permissions cannot be edited.
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground w-52">Module</th>
                      {PERMS.map(p => (
                        <th key={p} className="px-4 py-3 font-medium text-muted-foreground text-center">{PERM_LABELS[p]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, idx) => (
                      <tr key={mod.key} className={cn("border-b last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                        <td className="px-4 py-3 font-medium">{mod.label}</td>
                        {PERMS.map(perm => {
                          const val = selectedRole === "SYS_ADMIN" ? true : getPerm(selectedRole, mod.key, perm);
                          return (
                            <td key={perm} className="px-4 py-3 text-center">
                              <Checkbox
                                checked={val}
                                onCheckedChange={(checked) => togglePerm(selectedRole, mod.key, perm, !!checked)}
                                disabled={selectedRole === "SYS_ADMIN"}
                                data-testid={`perm-${selectedRole}-${mod.key}-${perm}`}
                                className={cn(val ? "data-[state=checked]:bg-primary" : "")}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasPendingChanges && (
                <div className="px-4 py-3 border-t bg-orange-50 flex items-center justify-between">
                  <span className="text-sm text-orange-700">
                    You have unsaved permission changes.
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPendingChanges({})} data-testid="button-discard-changes">
                      Discard
                    </Button>
                    <Button size="sm" onClick={() => savePermsMutation.mutate()} disabled={savePermsMutation.isPending} data-testid="button-save-permissions-bottom">
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {savePermsMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Discount Approvers Tab ───────────────────────────────────── */}
        <TabsContent value="discount-approvers" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Discount Approval Authority</CardTitle>
                  <CardDescription>
                    These users will receive in-app notifications and email alerts whenever a team member requests a discount on an episode.
                  </CardDescription>
                </div>
                <Button onClick={() => setAddApproverOpen(true)} data-testid="button-add-approver">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Approver
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!discountApprovers || discountApprovers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No discount approvers configured yet.</p>
                  <p className="text-xs mt-1">Add at least one approver to enable the discount notification workflow.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {discountApprovers.map(approver => (
                    <div
                      key={approver.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                      data-testid={`approver-row-${approver.crmUserId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                          {(approver.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{approver.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {approver.designation || ""}{approver.designation && approver.email ? " · " : ""}{approver.email || ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeApproverMutation.mutate(approver.crmUserId)}
                        disabled={removeApproverMutation.isPending}
                        data-testid={`button-remove-approver-${approver.crmUserId}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                How Discount Notifications Work
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>When a team member submits a discount request on an episode:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>All configured approvers receive an <strong>in-app notification</strong> (bell icon in sidebar).</li>
                <li>An <strong>email</strong> is sent to each approver with episode details and the discount request.</li>
                <li>Approvers can approve or reject the discount from the Episode's Quotation tab.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Approver Dialog */}
      <Dialog open={addApproverOpen} onOpenChange={setAddApproverOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Discount Approver</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Select Team Member</Label>
              <Select value={selectedApproverUserId} onValueChange={setSelectedApproverUserId}>
                <SelectTrigger className="mt-1" data-testid="select-approver-user">
                  <SelectValue placeholder="Choose a team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableForApprover.length === 0 ? (
                    <SelectItem value="__none__" disabled>All team members are already approvers</SelectItem>
                  ) : (
                    availableForApprover.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}{u.designation ? ` · ${u.designation}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddApproverOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedApproverUserId || addApproverMutation.isPending}
              onClick={() => {
                if (selectedApproverUserId) addApproverMutation.mutate(Number(selectedApproverUserId));
              }}
              data-testid="button-confirm-add-approver"
            >
              {addApproverMutation.isPending ? "Adding..." : "Add Approver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
