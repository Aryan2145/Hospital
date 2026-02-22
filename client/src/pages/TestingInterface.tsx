import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  FlaskConical,
  Users,
  UserCheck,
  BarChart3,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Activity,
  CalendarDays,
  ClipboardList,
  Stethoscope,
  Eye,
  EyeOff,
} from "lucide-react";

interface TestStats {
  counts: {
    leads: number;
    patients: number;
    appointments: number;
    tasks: number;
    activities: number;
    crmUsers: number;
  };
  leadsByStatus: Record<string, number>;
  leadsByPriority: Record<string, number>;
  leadsByAssignment: Record<string, number>;
}

interface CrmUserWithRole {
  id: number;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  systemRoleId: number | null;
  accessScopeType: string;
  phiAccessLevel: string;
  userId: string | null;
  roleName: string | null;
  roleCode: string | null;
  reportingTo: number | null;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  AGENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  COUNSELLOR: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const ACCESS_SCOPE_LABELS: Record<string, string> = {
  All: "Sees everything",
  Branch: "Own branch only",
  Department: "Own department only",
  Self: "Own leads only",
};

const PAGES_BY_ROLE: Record<string, string[]> = {
  ADMIN: ["Dashboard", "Leads", "Appointments", "Team", "Masters", "Testing"],
  MANAGER: ["Dashboard", "Leads", "Appointments", "Team"],
  AGENT: ["Dashboard", "Leads", "Appointments"],
  COUNSELLOR: ["Dashboard", "Leads", "Appointments"],
};

export default function TestingInterface() {
  const { toast } = useToast();
  const { crmUser, isAdmin } = useCurrentUser();
  const [seedCount, setSeedCount] = useState(10);
  const [showAccessDetails, setShowAccessDetails] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<TestStats>({
    queryKey: ["/api/testing/stats"],
    refetchInterval: 30000,
  });

  const { data: crmUsers, isLoading: usersLoading } = useQuery<CrmUserWithRole[]>({
    queryKey: ["/api/testing/crm-users"],
  });

  const switchRoleMutation = useMutation({
    mutationFn: async (targetCrmUserId: number) => {
      const res = await apiRequest("POST", "/api/testing/switch-role", { targetCrmUserId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Role Switched", description: `Now acting as ${data.crmUser?.name} (${data.crmUser?.roleName})` });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/crm-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to switch role", variant: "destructive" });
    },
  });

  const seedDataMutation = useMutation({
    mutationFn: async ({ type, count }: { type: string; count: number }) => {
      const res = await apiRequest("POST", "/api/testing/seed-sample-data", { type, count });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Data Created", description: `Created: ${JSON.stringify(data.created)}` });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create data", variant: "destructive" });
    },
  });

  const clearDataMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("DELETE", "/api/testing/clear-data", { type });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Data Cleared", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/testing/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to clear data", variant: "destructive" });
    },
  });

  const isCurrentUser = (userId: string | null) => userId !== null && crmUser?.userId === userId;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-testing-title">Testing Interface</h1>
                <p className="text-sm text-muted-foreground">Switch roles and generate test data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Activity className="w-3 h-3" />
                Current: {crmUser?.name || "Unknown"}
              </Badge>
              {crmUser?.roleCode && (
                <Badge className={ROLE_COLORS[crmUser.roleCode] || ""}>
                  <Shield className="w-3 h-3 mr-1" />
                  {crmUser.roleName}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats && Object.entries(stats.counts).map(([key, value]) => {
              const icons: Record<string, any> = {
                leads: Users,
                patients: Stethoscope,
                appointments: CalendarDays,
                tasks: ClipboardList,
                activities: Activity,
                crmUsers: UserCheck,
              };
              const Icon = icons[key] || BarChart3;
              return (
                <Card key={key} data-testid={`stat-card-${key}`}>
                  <CardContent className="p-4 text-center">
                    <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </CardContent>
                </Card>
              );
            })}
            {statsLoading && Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <div className="animate-pulse h-12 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5" />
                    Role Switcher
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAccessDetails(!showAccessDetails)}
                    data-testid="button-toggle-access-details"
                  >
                    {showAccessDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click on any team member to switch your role. The system will re-link your login to the selected CRM user, giving you their role and access permissions.
                  </p>
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {crmUsers?.map((user) => {
                        const isCurrent = isCurrentUser(user.userId);
                        const pages = PAGES_BY_ROLE[user.roleCode || ""] || [];
                        return (
                          <div
                            key={user.id}
                            className={`flex items-center gap-3 p-3 rounded-md border ${
                              isCurrent ? "border-primary bg-primary/5" : "border-border"
                            }`}
                            data-testid={`role-card-${user.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-foreground">{user.name}</span>
                                <Badge className={`text-[10px] ${ROLE_COLORS[user.roleCode || ""] || ""}`}>
                                  {user.roleName || "No Role"}
                                </Badge>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-[10px] gap-0.5 border-primary text-primary">
                                    <CheckCircle className="w-2.5 h-2.5" /> Active
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {user.code} {user.email ? `| ${user.email}` : ""}
                              </div>
                              {showAccessDetails && (
                                <div className="mt-2 space-y-1">
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Scope: <span className="font-medium text-foreground">{user.accessScopeType}</span>
                                    <span className="text-muted-foreground/60">({ACCESS_SCOPE_LABELS[user.accessScopeType] || user.accessScopeType})</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    PHI: <span className="font-medium text-foreground">{user.phiAccessLevel}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {pages.map(p => (
                                      <Badge key={p} variant="secondary" className="text-[10px] px-1.5">
                                        {p}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isCurrent ? "outline" : "default"}
                              disabled={isCurrent || switchRoleMutation.isPending}
                              onClick={() => switchRoleMutation.mutate(user.id)}
                              data-testid={`button-switch-${user.id}`}
                            >
                              {switchRoleMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isCurrent ? "Current" : "Switch"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Leads by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(stats.leadsByStatus).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No leads yet</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(stats.leadsByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                            const total = Object.values(stats.leadsByStatus).reduce((s, v) => s + v, 0);
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={status} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-foreground font-medium truncate">{status}</span>
                                  <span className="text-muted-foreground ml-2">{count}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Leads by Assignment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(stats.leadsByAssignment).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No leads yet</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(stats.leadsByAssignment).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                            const total = Object.values(stats.leadsByAssignment).reduce((s, v) => s + v, 0);
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-foreground font-medium truncate">{name}</span>
                                  <span className="text-muted-foreground ml-2">{count}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-orange-500 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="w-5 h-5" />
                    Generate Test Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Records per type</label>
                    <div className="flex items-center gap-2">
                      {[5, 10, 20, 50].map(n => (
                        <Button
                          key={n}
                          variant={seedCount === n ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSeedCount(n)}
                          data-testid={`button-count-${n}`}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {!isAdmin && (
                    <p className="text-xs text-destructive mb-2">Switch to an Admin role to generate data.</p>
                  )}
                  <div className="space-y-2">
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => seedDataMutation.mutate({ type: "all", count: seedCount })}
                      disabled={seedDataMutation.isPending || !isAdmin}
                      data-testid="button-seed-all"
                    >
                      {seedDataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Generate All Types
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => seedDataMutation.mutate({ type: "leads", count: seedCount })}
                      disabled={seedDataMutation.isPending || !isAdmin}
                      data-testid="button-seed-leads"
                    >
                      <Users className="w-4 h-4" /> Generate Leads
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => seedDataMutation.mutate({ type: "patients", count: seedCount })}
                      disabled={seedDataMutation.isPending || !isAdmin}
                      data-testid="button-seed-patients"
                    >
                      <Stethoscope className="w-4 h-4" /> Generate Patients
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => seedDataMutation.mutate({ type: "appointments", count: seedCount })}
                      disabled={seedDataMutation.isPending || !isAdmin}
                      data-testid="button-seed-appointments"
                    >
                      <CalendarDays className="w-4 h-4" /> Generate Appointments
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => seedDataMutation.mutate({ type: "tasks", count: seedCount })}
                      disabled={seedDataMutation.isPending || !isAdmin}
                      data-testid="button-seed-tasks"
                    >
                      <ClipboardList className="w-4 h-4" /> Generate Tasks
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                    <Trash2 className="w-5 h-5" />
                    Clear Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Remove test data from the system. This will permanently delete records.
                  </p>
                  {!isAdmin && (
                    <p className="text-xs text-destructive mb-2">Switch to an Admin role to clear data.</p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/30 text-destructive"
                    onClick={() => clearDataMutation.mutate("leads")}
                    disabled={clearDataMutation.isPending || !isAdmin}
                    data-testid="button-clear-leads"
                  >
                    {clearDataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Clear Leads & Related
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/30 text-destructive"
                    onClick={() => clearDataMutation.mutate("patients")}
                    disabled={clearDataMutation.isPending || !isAdmin}
                    data-testid="button-clear-patients"
                  >
                    <Trash2 className="w-4 h-4" /> Clear Patients
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/30 text-destructive"
                    onClick={() => clearDataMutation.mutate("all")}
                    disabled={clearDataMutation.isPending || !isAdmin}
                    data-testid="button-clear-all"
                  >
                    <AlertTriangle className="w-4 h-4" /> Clear Everything
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <RefreshCw className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/testing/stats"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/testing/crm-users"] });
                      toast({ title: "Refreshed", description: "Stats and user data refreshed" });
                    }}
                    data-testid="button-refresh-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh All Data
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
