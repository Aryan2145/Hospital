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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, UserCog, Plus, Trash2, Save, Users, AlertTriangle, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_CODES = [
  { code: "SYS_ADMIN", label: "System Admin" },
  { code: "ADMIN", label: "Admin" },
  { code: "MANAGER", label: "Manager" },
  { code: "COUNSELLOR", label: "Counsellor" },
  { code: "PATIENT_COORDINATOR", label: "Patient Coordinator" },
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
type PermKey = typeof PERMS[number];
const PERM_LABELS: Record<PermKey, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
};

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface CrmUserEnriched {
  id: number;
  name: string;
  email: string | null;
  isActive: boolean;
  systemRoleId: number | null;
  phiAccessLevel: string;
  accessScopeType: string;
  roleName: string | null;
  roleCode: string | null;
}

interface DiscountApprover {
  id: number;
  crmUserId: number;
  name: string | null;
  email: string | null;
  designation: string | null;
}

interface UserPermissionOverride {
  id: number;
  crmUserId: number;
  module: string;
  action: string;
  isGranted: boolean;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

interface OverrideFormState {
  module: string;
  action: string;
  isGranted: boolean;
  reason: string;
  expiresAt: string;
}

interface OverridePayload {
  crmUserId: number;
  module: string;
  action: string;
  isGranted: boolean;
  reason: string | null;
  expiresAt: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccessControlPage() {
  const { isAdmin } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Role Permissions tab
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});

  // Discount Approvers tab
  const [addApproverOpen, setAddApproverOpen] = useState(false);
  const [selectedApproverUserId, setSelectedApproverUserId] = useState("");

  // User Overrides tab
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addOverrideOpen, setAddOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    module: "",
    action: "canView",
    isGranted: true,
    reason: "",
    expiresAt: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: rolePerms } = useQuery<RolePermRow[]>({
    queryKey: ["/api/admin/role-permissions"],
    enabled: isAdmin,
  });

  const { data: teamUsers } = useQuery<CrmUserEnriched[]>({
    queryKey: ["/api/crm-users/active"],
    enabled: isAdmin,
  });

  const { data: discountApprovers, refetch: refetchApprovers } = useQuery<DiscountApprover[]>({
    queryKey: ["/api/admin/discount-approvers"],
    enabled: isAdmin,
  });

  const { data: userOverrides, refetch: refetchOverrides } = useQuery<UserPermissionOverride[]>({
    queryKey: ["/api/admin/user-permission-overrides", selectedUserId],
    enabled: isAdmin && selectedUserId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/admin/user-permission-overrides/${selectedUserId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load overrides");
      return res.json() as Promise<UserPermissionOverride[]>;
    },
  });

  // ── Role permission helpers ────────────────────────────────────────────

  const permMap: Record<string, Record<string, boolean>> = {};
  (rolePerms ?? []).forEach(row => {
    permMap[`${row.roleCode}::${row.module}`] = {
      canView: row.canView,
      canCreate: row.canCreate,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    };
  });

  const getPerm = (rc: string, mod: string, perm: string): boolean => {
    const changeKey = `${rc}::${mod}::${perm}`;
    if (pendingChanges[changeKey] !== undefined) return pendingChanges[changeKey][perm] ?? false;
    return permMap[`${rc}::${mod}`]?.[perm] ?? false;
  };

  const togglePerm = (rc: string, mod: string, perm: string, val: boolean) => {
    if (rc === "SYS_ADMIN") return;
    setPendingChanges(prev => ({ ...prev, [`${rc}::${mod}::${perm}`]: { [perm]: val } }));
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // ── Mutations ──────────────────────────────────────────────────────────

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
        const current = permMap[`${rc}::${mod}`] ?? {
          canView: false, canCreate: false, canEdit: false, canDelete: false,
        };
        await apiRequest("PUT", `/api/admin/role-permissions/${rc}/${mod}`, { ...current, ...changes });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/role-permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/my-permissions"] });
      setPendingChanges({});
      toast({ title: "Permissions saved successfully" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to save permissions", variant: "destructive" });
    },
  });

  const addApproverMutation = useMutation({
    mutationFn: (crmUserId: number) =>
      apiRequest("POST", "/api/admin/discount-approvers", { crmUserId }),
    onSuccess: () => {
      refetchApprovers();
      setAddApproverOpen(false);
      setSelectedApproverUserId("");
      toast({ title: "Discount approver added" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to add approver", variant: "destructive" });
    },
  });

  const removeApproverMutation = useMutation({
    mutationFn: (crmUserId: number) =>
      apiRequest("DELETE", `/api/admin/discount-approvers/${crmUserId}`),
    onSuccess: () => {
      refetchApprovers();
      toast({ title: "Approver removed" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to remove approver", variant: "destructive" });
    },
  });

  const addOverrideMutation = useMutation({
    mutationFn: (payload: OverridePayload) =>
      apiRequest("POST", "/api/admin/user-permission-overrides", payload),
    onSuccess: () => {
      refetchOverrides();
      setAddOverrideOpen(false);
      setOverrideForm({ module: "", action: "canView", isGranted: true, reason: "", expiresAt: "" });
      toast({ title: "Permission override saved" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to save override", variant: "destructive" });
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/user-permission-overrides/${id}`),
    onSuccess: () => {
      refetchOverrides();
      toast({ title: "Override removed" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to remove override", variant: "destructive" });
    },
  });

  // ── Access guard ───────────────────────────────────────────────────────

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

  // ── Derived state ──────────────────────────────────────────────────────

  const approverUserIds = new Set((discountApprovers ?? []).map(a => a.crmUserId));
  const availableForApprover = (teamUsers ?? []).filter(u => !approverUserIds.has(u.id));

  const filteredUsers = (teamUsers ?? []).filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  const selectedUser = selectedUserId
    ? (teamUsers ?? []).find(u => u.id === selectedUserId)
    : null;

  const now = new Date();
  const activeOverrides = (userOverrides ?? []).filter(
    ov => !ov.expiresAt || new Date(ov.expiresAt) >= now
  );
  const expiredOverrides = (userOverrides ?? []).filter(
    ov => ov.expiresAt && new Date(ov.expiresAt) < now
  );

  const phiLabel = (level: string) =>
    level === "Full" ? "Full PHI" : level === "Partial" ? "Partial PHI" : "No PHI";

  const phiBadgeClass = (level: string) =>
    level === "Full"
      ? "bg-red-100 text-red-700 border-red-300"
      : level === "Partial"
      ? "bg-yellow-100 text-yellow-700 border-yellow-300"
      : "bg-muted text-muted-foreground";

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-sm text-muted-foreground">
            Manage role-based permissions, user-level overrides, and discount approval authority
          </p>
        </div>
      </div>

      <Tabs defaultValue="role-permissions">
        <TabsList>
          <TabsTrigger value="role-permissions" data-testid="tab-role-permissions">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="user-overrides" data-testid="tab-user-overrides">
            <UserCog className="w-4 h-4 mr-2" />
            User Overrides
          </TabsTrigger>
          <TabsTrigger value="discount-approvers" data-testid="tab-discount-approvers">
            <Users className="w-4 h-4 mr-2" />
            Discount Approvers
          </TabsTrigger>
        </TabsList>

        {/* ─── Role Permissions Tab ──────────────────────────────────────── */}
        <TabsContent value="role-permissions" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Permission Matrix</CardTitle>
                  <CardDescription>
                    Configure what each role can view, create, edit, or delete per module.
                  </CardDescription>
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
                    <Button
                      onClick={() => savePermsMutation.mutate()}
                      disabled={savePermsMutation.isPending}
                      data-testid="button-save-permissions"
                    >
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
                        <th key={p} className="px-4 py-3 font-medium text-muted-foreground text-center">
                          {PERM_LABELS[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, idx) => (
                      <tr
                        key={mod.key}
                        className={cn("border-b last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/10")}
                      >
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
                  <span className="text-sm text-orange-700">You have unsaved permission changes.</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingChanges({})}
                      data-testid="button-discard-changes"
                    >
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => savePermsMutation.mutate()}
                      disabled={savePermsMutation.isPending}
                      data-testid="button-save-permissions-bottom"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {savePermsMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── User Overrides Tab ────────────────────────────────────────── */}
        <TabsContent value="user-overrides" className="mt-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Left panel: team member list */}
            <div className="col-span-4">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Team Members</CardTitle>
                  <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-user-search"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[540px] overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                    ) : (
                      filteredUsers.map(u => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <button
                            key={u.id}
                            className={cn(
                              "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors",
                              isSelected && "bg-primary/5 border-l-2 border-l-primary"
                            )}
                            onClick={() => setSelectedUserId(u.id)}
                            data-testid={`user-row-${u.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{u.name}</p>
                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                  {u.roleName && (
                                    <span className="text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary font-medium">
                                      {u.roleName}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0 rounded-full border font-medium",
                                    phiBadgeClass(u.phiAccessLevel)
                                  )}>
                                    {phiLabel(u.phiAccessLevel)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right panel: override management */}
            <div className="col-span-8">
              {!selectedUser ? (
                <Card className="h-full flex items-center justify-center min-h-[300px]">
                  <div className="text-center text-muted-foreground">
                    <UserCog className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a team member to view and manage their permission overrides</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{selectedUser.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {selectedUser.roleName && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedUser.roleName}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn("text-xs", phiBadgeClass(selectedUser.phiAccessLevel))}
                            >
                              {phiLabel(selectedUser.phiAccessLevel)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Scope: {selectedUser.accessScopeType}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setAddOverrideOpen(true)} data-testid="button-add-override">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Override
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Overrides take precedence over the role's default permissions. Use them to grant or
                        revoke specific module access for this individual.
                      </span>
                    </div>

                    {/* Active overrides */}
                    {activeOverrides.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Active Overrides ({activeOverrides.length})
                        </p>
                        <div className="space-y-2">
                          {activeOverrides.map(ov => {
                            const modLabel = MODULES.find(m => m.key === ov.module)?.label ?? ov.module;
                            const actLabel = PERM_LABELS[ov.action as PermKey] ?? ov.action;
                            return (
                              <div
                                key={ov.id}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border",
                                  ov.isGranted ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                )}
                                data-testid={`override-row-${ov.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs font-semibold mt-0.5",
                                      ov.isGranted
                                        ? "bg-green-100 text-green-700 border-green-300"
                                        : "bg-red-100 text-red-700 border-red-300"
                                    )}
                                  >
                                    {ov.isGranted ? "Granted" : "Revoked"}
                                  </Badge>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {actLabel} — {modLabel}
                                    </p>
                                    {ov.reason && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Reason: {ov.reason}
                                      </p>
                                    )}
                                    {ov.expiresAt && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Expires: {format(new Date(ov.expiresAt), "dd/MM/yyyy")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => removeOverrideMutation.mutate(ov.id)}
                                  disabled={removeOverrideMutation.isPending}
                                  data-testid={`button-remove-override-${ov.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Expired overrides */}
                    {expiredOverrides.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Expired Overrides ({expiredOverrides.length})
                        </p>
                        <div className="space-y-2 opacity-60">
                          {expiredOverrides.map(ov => {
                            const modLabel = MODULES.find(m => m.key === ov.module)?.label ?? ov.module;
                            const actLabel = PERM_LABELS[ov.action as PermKey] ?? ov.action;
                            return (
                              <div
                                key={ov.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 border-muted"
                                data-testid={`override-expired-${ov.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Badge variant="outline" className="text-xs font-semibold mt-0.5 text-muted-foreground">
                                    Expired
                                  </Badge>
                                  <div>
                                    <p className="text-sm font-medium line-through text-muted-foreground">
                                      {actLabel} — {modLabel}
                                    </p>
                                    {ov.expiresAt && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Expired: {format(new Date(ov.expiresAt), "dd/MM/yyyy")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:bg-muted"
                                  onClick={() => removeOverrideMutation.mutate(ov.id)}
                                  disabled={removeOverrideMutation.isPending}
                                  data-testid={`button-remove-expired-${ov.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(userOverrides ?? []).length === 0 && (
                      <div className="text-center py-10 text-muted-foreground">
                        <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No overrides configured.</p>
                        <p className="text-xs mt-1">This user inherits all permissions from their role.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Discount Approvers Tab ────────────────────────────────────── */}
        <TabsContent value="discount-approvers" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Discount Approval Authority</CardTitle>
                  <CardDescription>
                    These users receive in-app notifications and email alerts whenever a team member
                    requests a discount on an episode.
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
                          {(approver.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{approver.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {approver.designation ?? ""}
                            {approver.designation && approver.email ? " · " : ""}
                            {approver.email ?? ""}
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
                <li>An <strong>email</strong> is sent to each approver with episode details and the discount amount.</li>
                <li>Approvers can approve or reject the discount from the Episode's Quotation tab.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Approver Dialog ───────────────────────────────────────────── */}
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
                        {u.name}{u.roleName ? ` · ${u.roleName}` : ""}
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

      {/* ── Add Override Dialog ───────────────────────────────────────────── */}
      <Dialog open={addOverrideOpen} onOpenChange={setAddOverrideOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Permission Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedUser && (
              <p className="text-sm text-muted-foreground">
                Override for: <strong>{selectedUser.name}</strong>
                {selectedUser.roleName && (
                  <span className="ml-1 text-muted-foreground/70">({selectedUser.roleName})</span>
                )}
              </p>
            )}

            <div>
              <Label>Module</Label>
              <Select
                value={overrideForm.module}
                onValueChange={v => setOverrideForm(f => ({ ...f, module: v }))}
              >
                <SelectTrigger className="mt-1" data-testid="select-override-module">
                  <SelectValue placeholder="Select module..." />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Permission</Label>
              <Select
                value={overrideForm.action}
                onValueChange={v => setOverrideForm(f => ({ ...f, action: v }))}
              >
                <SelectTrigger className="mt-1" data-testid="select-override-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMS.map(p => (
                    <SelectItem key={p} value={p}>{PERM_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch
                checked={overrideForm.isGranted}
                onCheckedChange={v => setOverrideForm(f => ({ ...f, isGranted: v }))}
                data-testid="switch-override-grant"
              />
              <div>
                <p className="text-sm font-medium">
                  {overrideForm.isGranted ? "Grant access" : "Revoke access"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overrideForm.isGranted
                    ? "User will be allowed this action even if their role doesn't permit it."
                    : "User will be denied this action even if their role normally permits it."}
                </p>
              </div>
            </div>

            <div>
              <Label>
                Reason{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                className="mt-1 text-sm"
                rows={2}
                placeholder="Why is this override being applied?"
                value={overrideForm.reason}
                onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                data-testid="textarea-override-reason"
              />
            </div>

            <div>
              <Label>
                Expires On{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="date"
                className="mt-1"
                value={overrideForm.expiresAt}
                onChange={e => setOverrideForm(f => ({ ...f, expiresAt: e.target.value }))}
                data-testid="input-override-expiry"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for a permanent override.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOverrideOpen(false)}>Cancel</Button>
            <Button
              disabled={!overrideForm.module || addOverrideMutation.isPending}
              onClick={() => {
                if (!selectedUserId || !overrideForm.module) return;
                const payload: OverridePayload = {
                  crmUserId: selectedUserId,
                  module: overrideForm.module,
                  action: overrideForm.action,
                  isGranted: overrideForm.isGranted,
                  reason: overrideForm.reason || null,
                  expiresAt: overrideForm.expiresAt || null,
                };
                addOverrideMutation.mutate(payload);
              }}
              data-testid="button-confirm-add-override"
            >
              {addOverrideMutation.isPending ? "Saving..." : "Save Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
