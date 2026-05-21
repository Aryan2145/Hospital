import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { CrmUser, MasterRecord } from "@shared/schema";
import {
  UserPlus, Search, ChevronDown, ChevronRight, Mail, Phone, Shield, Eye, EyeOff,
  Users, UserCog, Network, List, Pencil, Trash2, KeyRound, Building2, RotateCcw, LockOpen, Lock, Megaphone,
  Upload, Download, FileText, AlertCircle, CheckCircle2
} from "lucide-react";

type ViewMode = "list" | "tree";

interface UserFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  systemRoleId: number | null;
  branchId: number | null;
  reportingTo: number | null;
  accessScopeType: string;
  phiAccessLevel: string;
  status: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
}

const EMPTY_FORM: UserFormData = {
  name: "", email: "", phone: "",
  password: "", confirmPassword: "",
  systemRoleId: null, branchId: null,
  reportingTo: null, accessScopeType: "Self", phiAccessLevel: "None",
  status: "Active", showPassword: false, showConfirmPassword: false,
};


const ACCESS_SCOPE_OPTIONS = [
  { value: "All", label: "All (Full Access)", description: "Can view all data across all branches" },
  { value: "Branch", label: "Branch", description: "Can view data within assigned branch" },
  { value: "Department", label: "Team", description: "Can view data within assigned team" },
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
          <Button size="icon" variant="ghost" onClick={() => onEdit(user)} data-testid={`button-edit-user-${user.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(user.id)} data-testid={`button-delete-user-${user.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
  const { isAdmin, isSysAdmin } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CrmUser | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<CrmUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ ...EMPTY_FORM });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ total: number; valid: number; invalid: number; errors: { row: number; message: string }[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);

  const usersQueryKey = showInactive && isAdmin ? ["/api/crm-users", "includeInactive"] : ["/api/crm-users"];
  const usersQueryUrl = showInactive && isAdmin ? "/api/crm-users?includeInactive=true" : "/api/crm-users";
  const { data: users = [], isLoading } = useQuery<CrmUser[]>({
    queryKey: usersQueryKey,
    queryFn: () => fetch(usersQueryUrl, { credentials: "include" }).then(r => r.json()),
  });
  const { data: roles = [] } = useQuery<MasterRecord[]>({ queryKey: ["/api/masters/systemRoles"], staleTime: 0 });
  const { data: branches = [] } = useQuery<MasterRecord[]>({ queryKey: ["/api/masters/branches"] });

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

  const reviveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/crm-users/${id}/revive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users", "includeInactive"] });
      toast({ title: "User reactivated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/crm-users/${id}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
      toast({ title: "Account unlocked", description: "The user can now log in again." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function closeImportDialog() {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setImportLoading(false);
  }

  async function handleImportPreview(file: File) {
    setImportLoading(true);
    setImportPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/crm-users/import?mode=preview", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Preview failed");
      setImportPreview(data);
    } catch (err: any) {
      toast({ title: "Preview Failed", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/crm-users/import", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      setImportResult({ imported: data.imported, failed: data.failed });
      queryClient.invalidateQueries({ queryKey: ["/api/crm-users"] });
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
      setImportLoading(false);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    setFormData({ ...EMPTY_FORM });
  }

  function openCreate() {
    setEditingUser(null);
    setFormData({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(user: CrmUser) {
    setEditingUser(user);
    setFormData({
      name: user.name, email: user.email || "", phone: user.phone || "",
      password: "", confirmPassword: "",
      systemRoleId: user.systemRoleId, branchId: user.branchId,
      reportingTo: user.reportingTo, accessScopeType: user.accessScopeType, phiAccessLevel: user.phiAccessLevel,
      status: user.status, showPassword: false, showConfirmPassword: false,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Full Name is required", variant: "destructive" });
      return;
    }
    const rawPhone = formData.phone.replace(/\s+/g, "").replace(/^\+91/, "");
    if (!rawPhone || !/^\d{10}$/.test(rawPhone)) {
      toast({ title: "Validation Error", description: "Enter a valid 10-digit Indian mobile number", variant: "destructive" });
      return;
    }
    if (!formData.systemRoleId) {
      toast({ title: "Validation Error", description: "System Role is required", variant: "destructive" });
      return;
    }
    if (!editingUser) {
      if (!formData.password || formData.password.length < 6) {
        toast({ title: "Validation Error", description: "Password must be at least 6 characters", variant: "destructive" });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({ title: "Validation Error", description: "Passwords do not match", variant: "destructive" });
        return;
      }
    }
    const { confirmPassword, showPassword, showConfirmPassword, ...rest } = formData;
    const payload: any = {
      ...rest,
      phone: "+91" + rawPhone,
      isActive: formData.status === "Active",
    };
    if (editingUser) {
      delete payload.password;
      updateMutation.mutate({ id: editingUser.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const adminRole = roles.find((r: any) => r.code === "ADMIN");
  const activeAdminCount = adminRole ? users.filter(u => u.systemRoleId === adminRole.id && u.isActive !== false).length : 0;
  const isLastAdmin = (user: CrmUser) => !!adminRole && user.systemRoleId === adminRole.id && activeAdminCount <= 1;

  function confirmDelete(id: number) {
    const user = users.find(u => u.id === id);
    if (user && isLastAdmin(user)) {
      toast({ title: "Cannot Delete", description: "Cannot delete the last admin. Assign another admin first.", variant: "destructive" });
      return;
    }
    const hasReports = users.some(u => u.reportingTo === id);
    if (hasReports) {
      toast({ title: "Cannot Delete", description: "User has direct reports. Reassign them first.", variant: "destructive" });
      return;
    }
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  }

  function executeDelete() {
    if (deleteTargetId !== null) {
      deleteMutation.mutate(deleteTargetId);
    }
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  }

  const getRoleName = (roleId: number | null) => {
    if (!roleId) return null;
    const role = roles.find((r: any) => r.id === roleId);
    return role ? role.name : null;
  };

  const getRoleCode = (roleId: number | null) => {
    if (!roleId) return null;
    const role = roles.find((r: any) => r.id === roleId);
    return role ? role.code : null;
  };

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return null;
    const branch = branches.find((b: any) => b.id === branchId);
    return branch ? branch.name : null;
  };

  const marketingRole = roles.find((r: any) => r.code === "MARKETING");
  const marketingUsers = marketingRole
    ? users.filter(u => u.systemRoleId === marketingRole.id && u.isActive !== false)
    : [];

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (roleFilter === "all") return true;
    const role = roles.find((r: any) => r.id === u.systemRoleId);
    return role ? role.code === roleFilter : roleFilter === "none";
  });

  const rootUsers = filteredUsers.filter(u => !u.reportingTo || !users.find(p => p.id === u.reportingTo));

  const getManagerName = (id: number | null) => {
    if (!id) return "-";
    const mgr = users.find(u => u.id === id);
    return mgr ? mgr.name : "-";
  };

  if (isLoading) return <AppLayout><div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Users</h2>
              <p className="text-muted-foreground mt-1">Manage users, roles, reporting hierarchy, and access levels.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => window.open("/api/crm-users/import/template")} title="Download CSV template" data-testid="button-import-template">
                <FileText className="w-4 h-4 mr-1" />Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open("/api/crm-users/export")} title="Export users as CSV" data-testid="button-export-users">
                <Download className="w-4 h-4 mr-1" />Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} data-testid="button-import-users">
                <Upload className="w-4 h-4 mr-1" />Import CSV
              </Button>
              <Button onClick={openCreate} data-testid="button-add-user"><UserPlus className="w-4 h-4 mr-2" />Add User</Button>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
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
            <Card
              className={`cursor-pointer transition-all ${roleFilter === "MARKETING" ? "ring-2 ring-orange-400 bg-orange-50 dark:bg-orange-900/20" : "hover:bg-orange-50/50 dark:hover:bg-orange-900/10"}`}
              onClick={() => setRoleFilter(roleFilter === "MARKETING" ? "all" : "MARKETING")}
              data-testid="card-marketing-filter"
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><Megaphone className="w-5 h-5 text-orange-600" /></div>
                  <div><p className="text-2xl font-bold" data-testid="text-marketing-users">{marketingUsers.length}</p><p className="text-xs text-muted-foreground">Marketing</p></div>
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
            <SearchableSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "all", label: "All Roles" },
                { value: "none", label: "No Role Assigned" },
                ...roles
                  .filter((r: any) => r.status === "Active" && (isSysAdmin || r.code !== "SYS_ADMIN"))
                  .sort((a: any, b: any) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
                  .map((r: any) => ({ value: r.code, label: r.name })),
              ]}
              className="w-44"
              data-testid="select-role-filter-team"
            />
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

          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowInactive(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                data-testid="button-toggle-inactive-users"
              >
                {showInactive ? "Hide inactive users" : "Show inactive users"}
              </button>
            </div>
          )}

          {roleFilter === "MARKETING" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800" data-testid="banner-marketing-team">
              <Megaphone className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Marketing Team</p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/80">
                  {filteredUsers.length === 0 ? "No marketing staff yet." : `${filteredUsers.length} marketing staff member${filteredUsers.length === 1 ? "" : "s"}.`} Marketing users manage campaigns, events, and lead generation.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ ...EMPTY_FORM, systemRoleId: marketingRole?.id ?? null });
                  setDialogOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                data-testid="button-add-marketing-user"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />Add Marketing User
              </Button>
            </div>
          )}

          {viewMode === "list" ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-users">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Branch</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Reports To</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Access</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => {
                        const isInactive = user.isActive === false;
                        const isLocked = !isInactive && !!user.lockedUntil && new Date(user.lockedUntil) > new Date();
                        const remainingMin = isLocked ? Math.ceil((new Date(user.lockedUntil!).getTime() - Date.now()) / 60000) : 0;
                        const roleCode = getRoleCode(user.systemRoleId);
                        const isDoctor = roleCode === "DOCTOR";
                        return (
                          <tr key={user.id} className={`border-b last:border-0 ${isDoctor ? 'bg-blue-50/30 dark:bg-blue-950/10' : isInactive ? 'opacity-60 bg-muted/20' : isLocked ? 'bg-red-50/50' : 'cursor-pointer hover-elevate'}`} onClick={() => !isDoctor && openEdit(user)} data-testid={`row-user-${user.id}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isInactive ? 'bg-muted text-muted-foreground' : isLocked ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : getInitials(user.name)}
                                </div>
                                <span className={`font-medium ${isInactive ? 'text-muted-foreground line-through' : ''}`}>{user.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">{user.code}</td>
                            <td className="p-3">
                              {getRoleName(user.systemRoleId) ? (
                                <Badge variant="outline" className="text-xs">{getRoleName(user.systemRoleId)}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="space-y-0.5">
                                {user.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{user.email}</div>}
                                {user.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{user.phone}</div>}
                              </div>
                            </td>
                            <td className="p-3">
                              {getBranchName(user.branchId) ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="w-3 h-3" />{getBranchName(user.branchId)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">{getManagerName(user.reportingTo)}</td>
                            <td className="p-3"><AccessScopeBadge scope={user.accessScopeType} /></td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                                  {user.status}
                                </Badge>
                                {isLocked && (
                                  <Badge variant="destructive" className="text-[10px] gap-1 w-fit">
                                    <Lock className="w-2.5 h-2.5" />
                                    Locked {remainingMin}m
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                              {isDoctor ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation("/master-data?table=doctors")}
                                  className="text-xs h-7 px-2"
                                  data-testid={`button-edit-doctor-${user.id}`}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />Edit in Doctors Master
                                </Button>
                              ) : isInactive ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviveMutation.mutate(user.id)}
                                  disabled={reviveMutation.isPending}
                                  className="text-green-700 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                                  data-testid={`button-revive-user-${user.id}`}
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />Revive
                                </Button>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  {isLocked && (
                                    <Button size="icon" variant="ghost"
                                      onClick={() => unlockMutation.mutate(user.id)}
                                      disabled={unlockMutation.isPending}
                                      title="Unlock account"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      data-testid={`button-unlock-user-${user.id}`}>
                                      <LockOpen className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => { setPasswordTarget(user); setNewPassword(""); setPasswordDialogOpen(true); }} title="Set Password" data-testid={`button-password-user-${user.id}`}><KeyRound className="w-3.5 h-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => confirmDelete(user.id)} disabled={isLastAdmin(user)} title={isLastAdmin(user) ? "Cannot delete the last admin" : "Delete user"} data-testid={`button-delete-user-${user.id}`}><Trash2 className={`w-3.5 h-3.5 ${isLastAdmin(user) ? "text-muted-foreground" : "text-destructive"}`} /></Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
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
              <CardContent className="overflow-x-auto">
                {rootUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No users found.</p>
                ) : (
                  rootUsers.map(u => (
                    <TreeNode key={u.id} user={u} allUsers={filteredUsers} onEdit={openEdit} onDelete={confirmDelete} />
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user details, role, and access permissions." : "Create a new CRM user with role and access assignments."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</p>
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" data-testid="input-user-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Mobile Number (Login Username) *</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="phone"
                    value={formData.phone.replace(/^\+91/, "")}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                      setFormData(p => ({ ...p, phone: val }));
                    }}
                    placeholder="9800000007"
                    className="rounded-l-none"
                    maxLength={10}
                    data-testid="input-user-phone"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">10-digit Indian mobile number</p>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="john@hospital.in" data-testid="input-user-email" />
              </div>
            </div>

            {!editingUser && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-800/40 p-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />Login Password <span className="text-amber-600 dark:text-amber-400 normal-case font-normal">— required</span>
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">User cannot log in without a password. Set it now before saving.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input id="password" type={formData.showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="Minimum 6 characters" className="pr-10" data-testid="input-user-password" />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setFormData(p => ({ ...p, showPassword: !p.showPassword }))} tabIndex={-1} data-testid="button-toggle-password">
                        {formData.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formData.password.length > 0 && formData.password.length < 6 && (
                      <p className="text-xs text-destructive mt-1">Minimum 6 characters</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm Password *</Label>
                    <div className="relative">
                      <Input id="confirm-password" type={formData.showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Re-enter password" className="pr-10" data-testid="input-user-confirm-password" />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setFormData(p => ({ ...p, showConfirmPassword: !p.showConfirmPassword }))} tabIndex={-1} data-testid="button-toggle-confirm-password">
                        {formData.showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                    )}
                    {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Passwords match</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Role & Organisation</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>System Role *</Label>
                <SearchableSelect
                  value={formData.systemRoleId?.toString() || "none"}
                  onValueChange={v => setFormData(p => ({ ...p, systemRoleId: v === "none" ? null : Number(v) }))}
                  options={[
                    { value: "none", label: "-- Select Role --" },
                    ...roles.filter((r: any) => r.status === "Active" && (isSysAdmin || r.code !== "SYS_ADMIN") && r.code !== "DOCTOR").map((r: any) => ({ value: r.id.toString(), label: r.name }))
                  ]}
                  placeholder="Select role"
                  data-testid="select-system-role"
                />
              </div>
              <div>
                <Label>Branch</Label>
                <SearchableSelect
                  value={formData.branchId?.toString() || "none"}
                  onValueChange={v => setFormData(p => ({ ...p, branchId: v === "none" ? null : Number(v) }))}
                  options={[
                    { value: "none", label: "-- No Branch --" },
                    ...branches.filter((b: any) => b.status === "Active").map((b: any) => ({ value: b.id.toString(), label: b.name }))
                  ]}
                  placeholder="Select branch"
                  data-testid="select-branch"
                />
              </div>
            </div>

            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Hierarchy & Access</p>
            </div>
            <div>
              <Label>Reports To</Label>
              <SearchableSelect
                value={formData.reportingTo?.toString() || "none"}
                onValueChange={v => setFormData(p => ({ ...p, reportingTo: v === "none" ? null : Number(v) }))}
                options={[
                  { value: "none", label: "-- No Manager (Top Level) --" },
                  ...users.filter(u => u.id !== editingUser?.id).map(u => ({ value: u.id.toString(), label: `${u.name}` }))
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
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending || updateMutation.isPending ||
                !formData.systemRoleId ||
                (!editingUser && (formData.password.length < 6 || formData.password !== formData.confirmPassword))
              }
              data-testid="button-save-user"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingUser ? "Update" : "Create User"}
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
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  data-testid="input-new-password"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPassword(v => !v)} tabIndex={-1} data-testid="button-toggle-new-password">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={v => { if (!v) closeImportDialog(); else setImportDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Users from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to create multiple users at once. Every row must include a <strong>password</strong>. Download the template first if you need the column format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!importResult ? (
              <>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById("import-file-input")?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">{importFile ? importFile.name : "Click to choose a CSV file"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Columns: name, phone, email, password, systemRoleCode, branchCode, accessScopeType, phiAccessLevel</p>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setImportFile(file);
                      setImportPreview(null);
                      if (file) handleImportPreview(file);
                    }}
                  />
                </div>

                {importLoading && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                    <LoadingSpinner />Validating file...
                  </div>
                )}

                {importPreview && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-lg font-bold">{importPreview.total}</p>
                        <p className="text-xs text-muted-foreground">Total Rows</p>
                      </div>
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                        <p className="text-lg font-bold text-green-700 dark:text-green-400">{importPreview.valid}</p>
                        <p className="text-xs text-muted-foreground">Valid</p>
                      </div>
                      <div className={`rounded-lg p-3 ${importPreview.invalid > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted"}`}>
                        <p className={`text-lg font-bold ${importPreview.invalid > 0 ? "text-destructive" : ""}`}>{importPreview.invalid}</p>
                        <p className="text-xs text-muted-foreground">Invalid</p>
                      </div>
                    </div>
                    {importPreview.errors.length > 0 && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 max-h-40 overflow-y-auto space-y-1">
                        {importPreview.errors.slice(0, 20).map((e, i) => (
                          <p key={i} className="text-xs text-destructive flex gap-1"><AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /><span><strong>Row {e.row}:</strong> {e.message}</span></p>
                        ))}
                        {importPreview.errors.length > 20 && <p className="text-xs text-muted-foreground">...and {importPreview.errors.length - 20} more errors</p>}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
                <p className="text-lg font-semibold">{importResult.imported} user{importResult.imported !== 1 ? "s" : ""} imported</p>
                {importResult.failed > 0 && <p className="text-sm text-destructive">{importResult.failed} row{importResult.failed !== 1 ? "s" : ""} failed</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && importPreview && importPreview.valid > 0 && (
              <Button onClick={handleImportConfirm} disabled={importLoading} data-testid="button-confirm-import">
                {importLoading ? "Importing..." : `Import ${importPreview.valid} User${importPreview.valid !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{users.find(u => u.id === deleteTargetId)?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
