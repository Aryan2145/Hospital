import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CrmUser, MasterRecord } from "@shared/schema";
import {
  UserPlus, Search, ChevronDown, ChevronRight, Mail, Phone, Shield, Eye,
  Users, UserCog, Network, List, Pencil, Trash2, KeyRound
} from "lucide-react";

type ViewMode = "list" | "tree";

interface UserFormData {
  code: string;
  name: string;
  email: string;
  phone: string;
  reportingTo: number | null;
  accessScopeType: string;
  phiAccessLevel: string;
  status: string;
}

const ACCESS_SCOPE_OPTIONS = [
  { value: "All", label: "All (Full Access)", description: "Can view all data across all branches" },
  { value: "Branch", label: "Branch", description: "Can view data within assigned branch" },
  { value: "Department", label: "Department", description: "Can view data within assigned department" },
  { value: "Self", label: "Self Only", description: "Can only view own data" },
];

const PHI_ACCESS_OPTIONS = [
  { value: "Full", label: "Full Access", description: "Can view all patient health information" },
  { value: "Masked", label: "Masked", description: "Sensitive data is partially hidden" },
  { value: "None", label: "No Access", description: "Cannot view patient health information" },
];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function AccessScopeBadge({ scope }: { scope: string }) {
  const colorMap: Record<string, string> = {
    All: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Branch: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Department: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Self: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colorMap[scope] || colorMap.Self}`}><Shield className="w-3 h-3" />{scope}</span>;
}

function PhiBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    Full: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    Masked: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    None: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colorMap[level] || colorMap.None}`}><Eye className="w-3 h-3" />{level}</span>;
}

function TreeNode({ user, allUsers, level = 0, onEdit, onDelete }: {
  user: CrmUser;
  allUsers: CrmUser[];
  level?: number;
  onEdit: (u: CrmUser) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = allUsers.filter(u => u.reportingTo === user.id);
  const hasChildren = children.length > 0;

  return (
    <div style={{ marginLeft: level > 0 ? 24 : 0 }}>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover-elevate group"
        data-testid={`tree-user-${user.id}`}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5" data-testid={`toggle-tree-${user.id}`}>
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {getInitials(user.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{user.name}</span>
            <span className="text-xs text-muted-foreground">({user.code})</span>
            <AccessScopeBadge scope={user.accessScopeType} />
          </div>
          {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
        </div>
        {hasChildren && <Badge variant="secondary" className="text-xs">{children.length} reports</Badge>}
        <div className="invisible group-hover:visible flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(user)} data-testid={`edit-user-${user.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(user.id)} data-testid={`delete-user-${user.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="border-l-2 border-border/50 ml-5">
          {children.map(c => (
            <TreeNode key={c.id} user={c} allUsers={allUsers} level={level + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CrmUser | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<CrmUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState<UserFormData>({
    code: "", name: "", email: "", phone: "",
    reportingTo: null, accessScopeType: "Self", phiAccessLevel: "None", status: "Active",
  });

  const { data: users = [], isLoading } = useQuery<CrmUser[]>({ queryKey: ["/api/crm-users"] });

  const { data: roles = [] } = useQuery<MasterRecord[]>({ queryKey: ["/api/masters/systemRoles"] });

  const createMutation = useMutation({
    mutationFn: (data: UserFormData) => apiRequest("POST", "/api/crm-users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
      toast({ title: "User created" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) => apiRequest("PATCH", `/api/crm-users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
      toast({ title: "User updated" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm-users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiRequest("POST", `/api/crm-users/${id}/set-password`, { password }),
    onSuccess: () => {
      toast({ title: "Password set successfully" });
      setPasswordDialogOpen(false);
      setPasswordTarget(null);
      setNewPassword("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    setFormData({ code: "", name: "", email: "", phone: "", reportingTo: null, accessScopeType: "Self", phiAccessLevel: "None", status: "Active" });
  }

  function openCreate() {
    setEditingUser(null);
    setFormData({ code: "", name: "", email: "", phone: "", reportingTo: null, accessScopeType: "Self", phiAccessLevel: "None", status: "Active" });
    setDialogOpen(true);
  }

  function openEdit(user: CrmUser) {
    setEditingUser(user);
    setFormData({
      code: user.code, name: user.name, email: user.email || "", phone: user.phone || "",
      reportingTo: user.reportingTo, accessScopeType: user.accessScopeType, phiAccessLevel: user.phiAccessLevel, status: user.status,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: "Validation Error", description: "Code and Name are required", variant: "destructive" });
      return;
    }
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function handleDelete(id: number) {
    const hasReports = users.some(u => u.reportingTo === id);
    if (hasReports) {
      toast({ title: "Cannot Delete", description: "User has direct reports. Reassign them first.", variant: "destructive" });
      return;
    }
    deleteMutation.mutate(id);
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const rootUsers = filteredUsers.filter(u => !u.reportingTo || !users.find(p => p.id === u.reportingTo));

  const getManagerName = (id: number | null) => {
    if (!id) return "-";
    const mgr = users.find(u => u.id === id);
    return mgr ? mgr.name : "-";
  };

  if (isLoading) return <div className="flex h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><LoadingSpinner /></main></div>;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Team Management</h2>
              <p className="text-muted-foreground mt-1">Manage CRM users, roles, reporting hierarchy, and access levels.</p>
            </div>
            <Button onClick={openCreate} data-testid="button-add-user"><UserPlus className="w-4 h-4 mr-2" />Add User</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Users className="w-5 h-5 text-blue-600" /></div>
                  <div><p className="text-2xl font-bold" data-testid="text-total-users">{users.length}</p><p className="text-xs text-muted-foreground">Total Users</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><UserCog className="w-5 h-5 text-green-600" /></div>
                  <div><p className="text-2xl font-bold" data-testid="text-active-users">{users.filter(u => u.isActive).length}</p><p className="text-xs text-muted-foreground">Active</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Shield className="w-5 h-5 text-purple-600" /></div>
                  <div><p className="text-2xl font-bold">{users.filter(u => u.accessScopeType === "All").length}</p><p className="text-xs text-muted-foreground">Full Access</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><Network className="w-5 h-5 text-amber-600" /></div>
                  <div><p className="text-2xl font-bold">{users.filter(u => users.some(r => r.reportingTo === u.id)).length}</p><p className="text-xs text-muted-foreground">Managers</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 mr-1" />List
              </Button>
              <Button
                size="sm"
                variant={viewMode === "tree" ? "default" : "ghost"}
                onClick={() => setViewMode("tree")}
                data-testid="button-view-tree"
              >
                <Network className="w-4 h-4 mr-1" />Org Tree
              </Button>
            </div>
          </div>

          {viewMode === "list" ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-users">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Reports To</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Access</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">PHI</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id} className="border-b last:border-0 hover-elevate" data-testid={`row-user-${user.id}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {getInitials(user.name)}
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{user.code}</td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              {user.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{user.email}</div>}
                              {user.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{user.phone}</div>}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{getManagerName(user.reportingTo)}</td>
                          <td className="p-3"><AccessScopeBadge scope={user.accessScopeType} /></td>
                          <td className="p-3"><PhiBadge level={user.phiAccessLevel} /></td>
                          <td className="p-3">
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setPasswordTarget(user); setNewPassword(""); setPasswordDialogOpen(true); }} title="Set Password" data-testid={`button-password-user-${user.id}`}><KeyRound className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(user.id)} data-testid={`button-delete-user-${user.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base">Organisation Hierarchy</CardTitle>
              </CardHeader>
              <CardContent>
                {rootUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No users found.</p>
                ) : (
                  rootUsers.map(u => (
                    <TreeNode key={u.id} user={u} allUsers={filteredUsers} onEdit={openEdit} onDelete={handleDelete} />
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input id="code" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} placeholder="AGT004" data-testid="input-user-code" />
              </div>
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" data-testid="input-user-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="john@viroc.in" data-testid="input-user-email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+919800000007" data-testid="input-user-phone" />
              </div>
            </div>
            <div>
              <Label>Reports To</Label>
              <SearchableSelect
                value={formData.reportingTo?.toString() || "none"}
                onValueChange={v => setFormData(p => ({ ...p, reportingTo: v === "none" ? null : Number(v) }))}
                options={[
                  { value: "none", label: "-- No Manager (Top Level) --" },
                  ...users.filter(u => u.id !== editingUser?.id).map(u => ({ value: u.id.toString(), label: `${u.name} (${u.code})` }))
                ]}
                placeholder="Select manager"
                data-testid="select-reporting-to"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Access Scope</Label>
                <SearchableSelect
                  value={formData.accessScopeType}
                  onValueChange={v => setFormData(p => ({ ...p, accessScopeType: v }))}
                  options={ACCESS_SCOPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  data-testid="select-access-scope"
                />
              </div>
              <div>
                <Label>PHI Access Level</Label>
                <SearchableSelect
                  value={formData.phiAccessLevel}
                  onValueChange={v => setFormData(p => ({ ...p, phiAccessLevel: v }))}
                  options={PHI_ACCESS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  data-testid="select-phi-level"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <SearchableSelect
                value={formData.status}
                onValueChange={v => setFormData(p => ({ ...p, status: v }))}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
                data-testid="select-user-status"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-user">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-user">
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set login password for <strong>{passwordTarget?.name}</strong>
            </p>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} data-testid="button-cancel-password">Cancel</Button>
            <Button
              onClick={() => passwordTarget && setPasswordMutation.mutate({ id: passwordTarget.id, password: newPassword })}
              disabled={setPasswordMutation.isPending || newPassword.length < 6}
              data-testid="button-save-password"
            >
              {setPasswordMutation.isPending ? "Setting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
