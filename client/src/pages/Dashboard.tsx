import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fmtTime } from "@/lib/date-utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLeads } from "@/hooks/use-leads";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, CalendarCheck, Target,
  ArrowUpRight, ArrowDownRight, Activity, Stethoscope, UserCheck,
  IndianRupee, BarChart3, PieChart as PieChartIcon,
  AlertTriangle, Phone, Clock, CheckCircle2, Flame, Snowflake, ChevronRight,
  Brain, Thermometer, TrendingDown, Ban, ShieldCheck, ClipboardList,
  PhoneCall, ListChecks, Eye, FileText, User2, Building2,
  ArrowRightLeft, Check, X, HeartPulse,
  BellRing, Megaphone, Receipt, TrendingUp, Wallet, UserPlus, ClipboardCheck
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  CartesianGrid, PieChart, Pie
} from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const VIROC_BLUE = "#0f4c81";
const VIROC_ORANGE = "#ff8c00";

function formatINR(value: number) {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function formatNumber(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("en-IN");
}

export default function Dashboard() {
  const { crmUser, roleCode, isAdmin, isManager, isSysAdmin, isMisViewer } = useCurrentUser();
  const [, navigate] = useLocation();

  const { data: dashStats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: todayTasks } = useQuery({
    queryKey: ['/api/tasks/today'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/today', { credentials: 'include' });
      if (!res.ok) return { overdue: [], dueToday: [], total: 0 };
      return res.json();
    },
  });

  const { data: dormantLeads } = useQuery({
    queryKey: ['/api/leads/dormant'],
    queryFn: async () => {
      const res = await fetch('/api/leads/dormant?days=5', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: intelligenceStats } = useQuery({
    queryKey: ['/api/intelligence/stats'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdmin,
  });

  if (isLoading || !dashStats) return <LoadingSpinner />;

  const lc = dashStats.leadCounts || {};
  const ec = dashStats.episodeCounts || {};
  const ac = dashStats.appointmentCounts || {};

  if (isMisViewer) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <ManagementDashboard
              lc={lc} ec={ec} ac={ac}
              dashStats={dashStats}
              todayTasks={todayTasks}
              dormantLeads={dormantLeads}
              intelligenceStats={intelligenceStats}
              navigate={navigate}
              userName={dashStats.userName}
              readOnly
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isAdmin) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <ManagementDashboard
              lc={lc} ec={ec} ac={ac}
              dashStats={dashStats}
              todayTasks={todayTasks}
              dormantLeads={dormantLeads}
              intelligenceStats={intelligenceStats}
              navigate={navigate}
              userName={dashStats.userName}
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isManager) {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <ManagerDashboard
              lc={lc} ec={ec} ac={ac}
              dashStats={dashStats}
              todayTasks={todayTasks}
              navigate={navigate}
              userName={dashStats.userName}
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "TELECALLER") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <TelecallerDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "RECEPTIONIST") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <ReceptionistDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "DOCTOR") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <DoctorDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "MEDICAL_ASSISTANT") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <MedicalAssistantDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "BILLING") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <BillingDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (roleCode === "MARKETING") {
    return (
      <AppLayout>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <MarketingDashboard lc={lc} ec={ec} ac={ac} dashStats={dashStats} todayTasks={todayTasks} navigate={navigate} userName={dashStats.userName} />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
          <IndividualDashboard
            lc={lc} ec={ec} ac={ac}
            dashStats={dashStats}
            todayTasks={todayTasks}
            navigate={navigate}
            userName={dashStats.userName}
            roleCode={roleCode}
          />
        </div>
      </div>
    </AppLayout>
  );
}

function PendingHandoversCard({ navigate }: { navigate: (path: string) => void }) {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: handovers } = useQuery<any[]>({
    queryKey: ["/api/leads/pending-handovers"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handoverMutation = useMutation({
    mutationFn: ({ leadId, action, rejectionReason }: { leadId: number; action: string; rejectionReason?: string }) =>
      apiRequest("PATCH", `/api/leads/${leadId}/handover`, { action, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leads/pending-handovers"] });
      setRejectingId(null);
      setRejectReason("");
    },
  });

  if (!handovers || handovers.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/40 dark:bg-orange-950/10 dark:border-orange-900/40" data-testid="card-pending-handovers">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-orange-500" />
          Pending Handovers
          <Badge className="ml-auto text-xs bg-orange-500 text-white">{handovers.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">Leads transferred to you — accept or reject to proceed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {handovers.map((h: any) => (
            <div
              key={h.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-background border border-orange-200 dark:border-orange-900/50 rounded-lg"
              data-testid={`handover-row-${h.id}`}
            >
              <div className="flex-1 min-w-0">
                <button
                  className="text-sm font-semibold text-primary hover:underline text-left truncate block"
                  onClick={() => navigate(`/leads/${h.id}`)}
                  data-testid={`link-handover-lead-${h.id}`}
                >
                  {h.patientName}
                </button>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From <span className="font-medium text-foreground">{h.handoverFromUserName}</span>
                  {h.handoverAt && (
                    <span> · {formatDistanceToNow(new Date(h.handoverAt), { addSuffix: true })}</span>
                  )}
                  {h.handoverReason && (
                    <span> · "{h.handoverReason}"</span>
                  )}
                </p>
              </div>
              {rejectingId === h.id ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    className="text-xs border rounded px-2 py-1 w-36 bg-background"
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    data-testid={`input-reject-reason-${h.id}`}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2"
                    onClick={() => handoverMutation.mutate({ leadId: h.id, action: "reject", rejectionReason: rejectReason })}
                    disabled={handoverMutation.isPending}
                    data-testid={`button-confirm-reject-${h.id}`}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => { setRejectingId(null); setRejectReason(""); }}
                    data-testid={`button-cancel-reject-${h.id}`}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3 bg-primary text-white"
                    onClick={() => handoverMutation.mutate({ leadId: h.id, action: "accept" })}
                    disabled={handoverMutation.isPending}
                    data-testid={`button-accept-handover-${h.id}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => setRejectingId(h.id)}
                    disabled={handoverMutation.isPending}
                    data-testid={`button-reject-handover-${h.id}`}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ManagementDashboard({ lc, ec, ac, dashStats, todayTasks, dormantLeads, intelligenceStats, navigate, userName, readOnly }: any) {
  const totalLeads = Number(lc.total_leads) || 0;
  const pipelineValue = Number(ec.pipeline_value) || 0;
  const realizedRevenue = Number(ec.realized_revenue) || 0;

  // readOnly = true means MIS_VIEWER: show aggregated stats only, no drill-down links
  const nav = readOnly ? undefined : navigate;

  const pipelineData = [
    { name: "Raw Lead", count: Number(lc.raw_leads) || 0, color: "#94a3b8", status: "Raw Lead Captured" },
    { name: "Contacted", count: Number(lc.contacted) || 0, color: "#3b82f6", status: "Contacted" },
    { name: "Qualified", count: Number(lc.qualified) || 0, color: "#8b5cf6", status: "Qualified" },
    { name: "Appt Booked", count: Number(lc.appointment_booked) || 0, color: VIROC_ORANGE, status: "Appointment Booked" },
    { name: "Consulted", count: Number(lc.consultation_done) || 0, color: "#10b981", status: "Consultation Done" },
    { name: "Won", count: Number(lc.closed_won) || 0, color: "#22c55e", status: "Closed Won" },
    { name: "Lost", count: Number(lc.closed_lost) || 0, color: "#ef4444", status: "Closed Lost" },
    { name: "Nurture", count: Number(lc.nurture) || 0, color: "#f59e0b", status: "Nurture" },
  ];

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">
            {readOnly ? "Analytics Overview" : "Management Dashboard"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {readOnly ? `Welcome back, ${userName} — Aggregated Analytics View` : `Welcome back, ${userName} — Hospital CRM Overview`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {readOnly ? (
            <Badge variant="outline" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Analytics View</Badge>
          ) : (
            <Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />Management View</Badge>
          )}
          <Badge variant="secondary" className="text-xs">Live Data</Badge>
        </div>
      </div>

      {!readOnly && <PendingHandoversCard navigate={navigate} />}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KPICard title="Total Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={nav ? () => nav("/leads") : undefined} />
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend={`${Number(ec.surgeries) || 0} surgeries`} up onClick={nav ? () => nav("/transactions") : undefined} />
        <KPICard title="Pipeline Value" value={`Rs.${formatINR(pipelineValue)}`} icon={IndianRupee} trend={`${Number(ec.total_episodes) || 0} total episodes`} onClick={nav ? () => nav("/transactions") : undefined} />
        <KPICard title="Revenue Realized" value={`Rs.${formatINR(realizedRevenue)}`} icon={IndianRupee} trend={`${Number(ec.completed) || 0} completed`} up={realizedRevenue > 0} onClick={nav ? () => nav("/transactions?status=Closed Won") : undefined} />
        <KPICard title="Today Appointments" value={(Number(ac.today_appointments) || 0).toString()} icon={CalendarCheck} trend={`${Number(ac.today_pending) || 0} pending`} onClick={nav ? () => nav("/appointments") : undefined} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hot Leads" value={Number(lc.hot_leads) || 0} icon={Flame} color="text-orange-500" onClick={nav ? () => nav("/leads?filter=hot&view=list") : undefined} />
        <StatCard label="Dormant Leads" value={Number(lc.dormant_leads) || 0} icon={Snowflake} color="text-blue-400" onClick={nav ? () => nav("/leads?filter=dormant&view=list") : undefined} />
        <StatCard label="Overdue Actions" value={(Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)} icon={AlertTriangle} color="text-red-500" onClick={nav ? () => nav("/transactions?filter=overdue") : undefined} />
        <StatCard label="Insurance Cases" value={Number(ec.insurance_cases) || 0} icon={ShieldCheck} color="text-cyan-500" onClick={nav ? () => nav("/transactions") : undefined} />
      </div>

      {!readOnly && <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />}

      {!readOnly && (dormantLeads?.length || 0) > 0 && (
        <DormantLeadsCard dormantLeads={dormantLeads} navigate={navigate} />
      )}

      {dashStats.teamStats && dashStats.teamStats.length > 0 && (
        <TeamPerformanceCard teamStats={dashStats.teamStats} navigate={navigate} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              CRM Lead Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} className={nav ? "cursor-pointer" : ""} onClick={nav ? (_: any, index: number) => nav(`/leads?status=${encodeURIComponent(pipelineData[index].status)}&view=list`) : undefined}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              Episode Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: Number(ec.active_episodes) || 0, color: VIROC_BLUE },
                    { name: "Consultations", value: Number(ec.consultations) || 0, color: "#8b5cf6" },
                    { name: "Surgeries", value: Number(ec.surgeries) || 0, color: "#10b981" },
                    { name: "Completed", value: Number(ec.completed) || 0, color: "#22c55e" },
                    { name: "Discontinued", value: Number(ec.discontinued) || 0, color: "#ef4444" },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={2} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {[
                    { name: "Active", value: Number(ec.active_episodes) || 0, color: VIROC_BLUE },
                    { name: "Consultations", value: Number(ec.consultations) || 0, color: "#8b5cf6" },
                    { name: "Surgeries", value: Number(ec.surgeries) || 0, color: "#10b981" },
                    { name: "Completed", value: Number(ec.completed) || 0, color: "#22c55e" },
                    { name: "Discontinued", value: Number(ec.discontinued) || 0, color: "#ef4444" },
                  ].filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString("en-IN")} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {dashStats.conversionRatios && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-treatment-to-surgery-ratio">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-500" />
                Treatment Planned → Surgery Scheduled
              </CardTitle>
              <CardDescription className="text-xs">Conversion from treatment planning to surgery scheduling</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-violet-600" data-testid="text-treatment-surgery-ratio">
                  {dashStats.conversionRatios.treatmentToSurgeryRatio}%
                </span>
                <span className="text-xs text-muted-foreground mb-1">
                  {dashStats.conversionRatios.surgeryScheduledCount} of {dashStats.conversionRatios.treatmentPlannedCount} episodes
                </span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.min(dashStats.conversionRatios.treatmentToSurgeryRatio, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-surgery-to-done-ratio">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Surgery Scheduled → Surgery Done
              </CardTitle>
              <CardDescription className="text-xs">Completion rate of scheduled surgeries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-emerald-600" data-testid="text-surgery-done-ratio">
                  {dashStats.conversionRatios.surgeryToCompletionRatio}%
                </span>
                <span className="text-xs text-muted-foreground mb-1">
                  {dashStats.conversionRatios.surgeryDoneCount} of {dashStats.conversionRatios.surgeryScheduledCount} surgeries
                </span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(dashStats.conversionRatios.surgeryToCompletionRatio, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PreopCasesWidget navigate={navigate} readOnly={readOnly} />

      {intelligenceStats && !readOnly && <IntelligenceOverview stats={intelligenceStats} navigate={navigate} />}

      {!readOnly && <QuickActionsCard navigate={navigate} totalLeads={totalLeads} role="management" />}
    </>
  );
}

function ManagerDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const totalLeads = Number(lc.total_leads) || 0;
  const teamOverdue = dashStats.teamOverdueActions || [];

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">
            Department Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome, {userName} — Team & Lead Overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />Manager View</Badge>
          <Badge variant="secondary" className="text-xs">Live Data</Badge>
        </div>
      </div>

      <PendingHandoversCard navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="My Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Needs immediate attention" up onClick={() => navigate("/leads?filter=hot&view=list")} />
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend={`${Number(ec.surgeries) || 0} surgeries`} onClick={() => navigate("/transactions")} />
        <KPICard title="Today Appointments" value={(Number(ac.today_appointments) || 0).toString()} icon={CalendarCheck} trend={`${Number(ac.today_pending) || 0} pending`} onClick={() => navigate("/appointments")} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overdue Actions" value={(Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)} icon={AlertTriangle} color="text-red-500" onClick={() => navigate("/transactions?filter=overdue")} />
        <StatCard label="Today's Actions" value={(Number(lc.today_actions) || 0) + (Number(ec.today_ep_actions) || 0)} icon={ListChecks} color="text-primary" onClick={() => navigate("/leads?view=list")} />
        <StatCard label="Dormant Leads" value={Number(lc.dormant_leads) || 0} icon={Snowflake} color="text-blue-400" onClick={() => navigate("/leads?filter=dormant&view=list")} />
        <StatCard label="Untouched Leads" value={Number(lc.raw_leads) || 0} icon={Eye} color="text-amber-500" onClick={() => navigate("/leads?status=Raw Lead Captured&view=list")} />
      </div>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      {teamOverdue.length > 0 && (
        <Card data-testid="card-team-overdue-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Team Overdue Tasks
              <Badge variant="destructive" className="text-xs ml-auto">{teamOverdue.length} overdue</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Overdue actions assigned to your team members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {teamOverdue.slice(0, 10).map((a: any, i: number) => (
                <div
                  key={`team-overdue-${i}`}
                  className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                  onClick={() => navigate(a.entity_type === "lead" ? `/leads/${a.entity_id}` : `/episodes/${a.entity_id}`)}
                  data-testid={`team-overdue-action-${i}`}
                >
                  <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {a.action_type_name || "Follow Up"}: {a.entity_name}
                    </p>
                    <p className="text-[10px] text-red-500">
                      {a.next_action_date && formatDistanceToNow(new Date(a.next_action_date), { addSuffix: true })}
                      {a.assigned_to_name ? ` · Assigned to: ${a.assigned_to_name}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.entity_type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dashStats.conversionRatios && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-mgr-treatment-to-surgery-ratio">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-500" />
                Treatment Planned → Surgery Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-violet-600">{dashStats.conversionRatios.treatmentToSurgeryRatio}%</span>
                <span className="text-xs text-muted-foreground mb-1">{dashStats.conversionRatios.surgeryScheduledCount} of {dashStats.conversionRatios.treatmentPlannedCount}</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(dashStats.conversionRatios.treatmentToSurgeryRatio, 100)}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-mgr-surgery-to-done-ratio">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Surgery Scheduled → Surgery Done
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-emerald-600">{dashStats.conversionRatios.surgeryToCompletionRatio}%</span>
                <span className="text-xs text-muted-foreground mb-1">{dashStats.conversionRatios.surgeryDoneCount} of {dashStats.conversionRatios.surgeryScheduledCount}</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(dashStats.conversionRatios.surgeryToCompletionRatio, 100)}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dashStats.teamStats && dashStats.teamStats.length > 0 && (
        <TeamPerformanceCard teamStats={dashStats.teamStats} navigate={navigate} />
      )}

      <PreopCasesWidget navigate={navigate} />

      <QuickActionsCard navigate={navigate} totalLeads={totalLeads} role="manager" />
    </>
  );
}

function IndividualDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName, roleCode }: any) {
  const totalLeads = Number(lc.total_leads) || 0;
  const roleLabel = roleCode === "COUNSELLOR" ? "Counsellor" : roleCode === "PATIENT_COORDINATOR" ? "Patient Coordinator" : "Team Member";
  const perf = dashStats.individualPerformance || {};
  const callStats = perf.callStats || {};
  const leadSources = perf.leadSourceBreakdown || [];
  const myEpStats = perf.myEpisodeStats || {};
  const funnel = perf.conversionFunnel || {};
  const isAgent = roleCode === "PATIENT_COORDINATOR";
  const isCounsellor = roleCode === "COUNSELLOR";

  const funnelStages = [
    { label: "Raw", value: Number(funnel.raw) || 0, color: "#94a3b8" },
    { label: "Contacted", value: Number(funnel.contacted) || 0, color: "#60a5fa" },
    { label: "Qualified", value: Number(funnel.qualified) || 0, color: "#a78bfa" },
    { label: "Appt Booked", value: Number(funnel.appointment_booked) || 0, color: "#34d399" },
    { label: "Consult Done", value: Number(funnel.consultation_done) || 0, color: "#f59e0b" },
    { label: "Won", value: Number(funnel.closed_won) || 0, color: "#22c55e" },
  ];
  const maxFunnel = Math.max(...funnelStages.map(s => s.value), 1);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">
            My Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome, {userName} — Your daily tasks & leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs"><User2 className="w-3 h-3 mr-1" />{roleLabel}</Badge>
          <Badge variant="secondary" className="text-xs">Today</Badge>
        </div>
      </div>

      <PendingHandoversCard navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="My Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads?filter=my-leads")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Priority follow-ups" up onClick={() => navigate("/leads?filter=hot&view=list")} />
        <KPICard title="Today's Actions" value={((Number(lc.today_actions) || 0) + (Number(ec.today_ep_actions) || 0)).toString()} icon={ListChecks} trend="Due today" onClick={() => navigate("/leads?view=list")} />
        <KPICard title="Overdue" value={((Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)).toString()} icon={AlertTriangle} trend="Needs attention" up={false} onClick={() => navigate("/transactions?filter=overdue")} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Untouched Leads" value={Number(lc.raw_leads) || 0} icon={Eye} color="text-amber-500" onClick={() => navigate("/leads?status=Raw Lead Captured&view=list")} />
        <StatCard label="Contacted" value={Number(lc.contacted) || 0} icon={PhoneCall} color="text-blue-500" onClick={() => navigate("/leads?status=Contacted&view=list")} />
        <StatCard label="Qualified" value={Number(lc.qualified) || 0} icon={CheckCircle2} color="text-purple-500" onClick={() => navigate("/leads?status=Qualified&view=list")} />
        <StatCard label="Appt Booked" value={Number(lc.appointment_booked) || 0} icon={CalendarCheck} color="text-green-500" onClick={() => navigate("/leads?status=Appointment Booked&view=list")} />
      </div>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 md:grid-cols-2">
        {isAgent && (
          <Card data-testid="card-call-performance">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                My Call Performance
              </CardTitle>
              <CardDescription className="text-xs">Call activity and outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold text-foreground">{Number(callStats.today_calls) || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Today</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold text-foreground">{Number(callStats.week_calls) || 0}</p>
                  <p className="text-[10px] text-muted-foreground">This Week</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold text-foreground">{Math.round(Number(callStats.avg_call_duration) / 60) || 0}m</p>
                  <p className="text-[10px] text-muted-foreground">Avg Duration</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Outbound</span>
                  <span className="font-medium">{Number(callStats.outbound_calls) || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Inbound</span>
                  <span className="font-medium">{Number(callStats.inbound_calls) || 0}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-semibold text-foreground mb-1.5">Outcomes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex justify-between text-xs p-1.5 bg-green-50 dark:bg-green-950/20 rounded">
                      <span>Interested</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{Number(callStats.interested_outcomes) || 0}</Badge>
                    </div>
                    <div className="flex justify-between text-xs p-1.5 bg-blue-50 dark:bg-blue-950/20 rounded">
                      <span>Confirmed</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{Number(callStats.confirmed_outcomes) || 0}</Badge>
                    </div>
                    <div className="flex justify-between text-xs p-1.5 bg-amber-50 dark:bg-amber-950/20 rounded">
                      <span>Callback</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{Number(callStats.callback_outcomes) || 0}</Badge>
                    </div>
                    <div className="flex justify-between text-xs p-1.5 bg-red-50 dark:bg-red-950/20 rounded">
                      <span>Not Available</span>
                      <Badge variant="secondary" className="text-[10px] h-4">{Number(callStats.not_available_outcomes) || 0}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isCounsellor && (
          <Card data-testid="card-episode-progress">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                My Episode Progress
              </CardTitle>
              <CardDescription className="text-xs">Treatment episodes under your care</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-primary/5 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{Number(myEpStats.active_episodes) || 0}</p>
                  <p className="text-xs text-muted-foreground">Active Episodes</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{Number(myEpStats.completed_episodes) || 0}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Surgery Cases</span>
                  <span className="font-medium">{Number(myEpStats.surgery_episodes) || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Episodes</span>
                  <span className="font-medium">{Number(myEpStats.total_episodes) || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isCounsellor && (
          <Card data-testid="card-revenue-pipeline">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                My Revenue Pipeline
              </CardTitle>
              <CardDescription className="text-xs">Financial overview of your episodes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-xs text-muted-foreground">Active Pipeline Value</p>
                  <p className="text-xl font-bold text-foreground">Rs.{formatINR(Number(myEpStats.pipeline_value) || 0)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-[10px] text-muted-foreground">Realized Revenue</p>
                    <p className="text-sm font-bold text-green-600">Rs.{formatINR(Number(myEpStats.realized_revenue) || 0)}</p>
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <p className="text-[10px] text-muted-foreground">Expected Revenue</p>
                    <p className="text-sm font-bold text-amber-600">Rs.{formatINR(Number(myEpStats.expected_revenue) || 0)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAgent && leadSources.length > 0 && (
          <Card data-testid="card-lead-sources">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                My Lead Sources
              </CardTitle>
              <CardDescription className="text-xs">Where your leads come from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leadSources.map((s: any, i: number) => {
                  const total = Number(s.lead_count) || 0;
                  const converted = Number(s.converted) || 0;
                  const pct = totalLeads > 0 ? (total / totalLeads) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1" data-testid={`lead-source-${i}`}>
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground truncate max-w-[160px]">{s.source_name || "Unknown"}</span>
                        <span className="text-muted-foreground shrink-0">{total} leads · {converted} converted</span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded overflow-hidden">
                        <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card data-testid="card-conversion-funnel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            My Conversion Funnel
          </CardTitle>
          <CardDescription className="text-xs">Lead progression through stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funnelStages.map((stage, i) => (
              <div key={i} className="flex items-center gap-3" data-testid={`funnel-stage-${i}`}>
                <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{stage.label}</span>
                <div className="flex-1 h-7 bg-muted/20 rounded overflow-hidden relative">
                  <div className="h-full rounded transition-all duration-500 flex items-center px-2" style={{ width: `${Math.max((stage.value / maxFunnel) * 100, 3)}%`, backgroundColor: stage.color }}>
                    {stage.value > 0 && <span className="text-[10px] font-bold text-white drop-shadow">{stage.value}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(Number(funnel.nurture) || 0) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Snowflake className="w-3 h-3" />
              <span>{funnel.nurture} in Nurture · {Number(funnel.closed_lost) || 0} Lost</span>
            </div>
          )}
        </CardContent>
      </Card>

      {dashStats.recentActivities && dashStats.recentActivities.length > 0 && (
        <Card data-testid="card-recent-activities">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              My Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashStats.recentActivities.map((act: any) => (
                <div
                  key={act.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/leads/${act.lead_id}`)}
                  data-testid={`recent-activity-${act.id}`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {act.type === "call" ? <PhoneCall className="w-3.5 h-3.5 text-primary" /> :
                     act.type === "note" ? <FileText className="w-3.5 h-3.5 text-primary" /> :
                     <Activity className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{act.description || act.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {act.lead_name} · {act.outcome ? `${act.outcome} · ` : ""}{act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <QuickActionsCard navigate={navigate} totalLeads={totalLeads} role="individual" />
    </>
  );
}

function MyTodayAndOverdueSection({ todayTasks, dashStats, navigate }: any) {
  const hasOverdueActions = dashStats.overdueActions?.length > 0;
  const hasTodayActions = dashStats.nextActions?.length > 0;
  const hasOverdueTasks = (todayTasks?.overdue?.length || 0) > 0;
  const hasTodayTasks = (todayTasks?.dueToday?.length || 0) > 0;

  const hasTodayContent = hasTodayActions || hasTodayTasks;
  const hasOverdueContent = hasOverdueActions || hasOverdueTasks;

  if (!hasTodayContent && !hasOverdueContent) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card data-testid="card-my-today-tasks">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Clock className="h-4 w-4 text-primary" />
            My Today's Tasks
            {(hasTodayActions || hasTodayTasks) && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {(dashStats.nextActions?.length || 0) + (todayTasks?.dueToday?.length || 0)} due
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasTodayTasks && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-foreground mb-1.5">System Tasks ({todayTasks.dueToday.length})</p>
              <div className="space-y-1.5">
                {todayTasks.dueToday.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors" onClick={() => navigate(`/leads/${task.leadId}`)} data-testid={`today-task-${task.id}`}>
                    <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">{task.dueDate && fmtTime(task.dueDate)}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasTodayActions && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Follow-Up Actions ({dashStats.nextActions.length})</p>
              <div className="space-y-1.5">
                {dashStats.nextActions.slice(0, 8).map((a: any, i: number) => (
                  <div
                    key={`today-${i}`}
                    className="flex items-center gap-2 p-2 bg-primary/5 rounded-md cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => navigate(a.entity_type === "lead" ? `/leads/${a.entity_id}` : `/episodes/${a.entity_id}`)}
                    data-testid={`today-action-${i}`}
                  >
                    <ListChecks className="w-3 h-3 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {a.action_type_name || "Follow Up"}: {a.entity_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.next_action_date && fmtTime(a.next_action_date)}
                        {a.assigned_to_name ? ` · ${a.assigned_to_name}` : ""}
                        {a.next_action_notes ? ` · ${a.next_action_notes}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{a.entity_type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!hasTodayContent && (
            <p className="text-sm text-muted-foreground py-4 text-center">No tasks scheduled for today</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-my-overdue-tasks">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            My Overdue Tasks
            {hasOverdueContent && (
              <Badge variant="destructive" className="ml-auto text-xs">
                {(dashStats.overdueActions?.length || 0) + (todayTasks?.overdue?.length || 0)} overdue
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasOverdueTasks && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                System Tasks ({todayTasks.overdue.length})
              </p>
              <div className="space-y-1.5">
                {todayTasks.overdue.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors" onClick={() => navigate(`/leads/${task.leadId}`)} data-testid={`overdue-task-${task.id}`}>
                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-[10px] text-red-500">{task.dueDate && formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasOverdueActions && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5">Overdue Follow-Ups ({dashStats.overdueActions.length})</p>
              <div className="space-y-1.5">
                {dashStats.overdueActions.slice(0, 8).map((a: any, i: number) => (
                  <div
                    key={`overdue-${i}`}
                    className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                    onClick={() => navigate(a.entity_type === "lead" ? `/leads/${a.entity_id}` : `/episodes/${a.entity_id}`)}
                    data-testid={`overdue-action-${i}`}
                  >
                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {a.action_type_name || "Follow Up"}: {a.entity_name}
                      </p>
                      <p className="text-[10px] text-red-500">
                        {a.next_action_date && formatDistanceToNow(new Date(a.next_action_date), { addSuffix: true })}
                        {a.assigned_to_name ? ` · ${a.assigned_to_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{a.entity_type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!hasOverdueContent && (
            <p className="text-sm text-muted-foreground py-4 text-center">No overdue tasks — great job!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamPerformanceCard({ teamStats, navigate }: { teamStats: any[]; navigate: (path: string) => void }) {
  return (
    <Card data-testid="card-team-performance">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Team Performance
          <Button variant="outline" size="sm" className="ml-auto text-xs h-7" onClick={() => navigate("/team")} data-testid="button-view-team">
            View Team
          </Button>
        </CardTitle>
        <CardDescription className="text-xs">Lead distribution across team members</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-team-performance">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Team Member</th>
                <th className="text-center py-2 pr-4 font-medium">Role</th>
                <th className="text-right py-2 pr-4 font-medium">Total Leads</th>
                <th className="text-right py-2 pr-4 font-medium">Untouched</th>
                <th className="text-right py-2 pr-4 font-medium">New Today</th>
                <th className="text-right py-2 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.map((member: any) => (
                <tr key={member.id} className="border-b border-border/50 last:border-0" data-testid={`team-row-${member.id}`}>
                  <td className="py-2.5 pr-4 font-medium text-foreground">{member.name}</td>
                  <td className="py-2.5 pr-4 text-center">
                    <Badge variant="secondary" className="text-xs">{member.role_code}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-right">{Number(member.total_leads) || 0}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {Number(member.untouched) > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{member.untouched}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right">{Number(member.today_new) || 0}</td>
                  <td className="py-2.5 text-right">
                    {Number(member.overdue) > 0 ? (
                      <Badge variant="destructive" className="text-xs">{member.overdue}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DormantLeadsCard({ dormantLeads, navigate }: { dormantLeads: any[]; navigate: (path: string) => void }) {
  return (
    <Card data-testid="card-dormant-leads">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Snowflake className="h-4 w-4 text-blue-500" />
          Dormant Leads
          <Badge variant="outline" className="ml-auto text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">{dormantLeads.length} cold</Badge>
        </CardTitle>
        <CardDescription className="text-xs">No activity for 5+ days — needs attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {dormantLeads.slice(0, 8).map((lead: any) => {
            const lastDate = lead.lastContactAt || lead.updatedAt || lead.createdAt;
            return (
              <div key={lead.id} className="flex items-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" onClick={() => navigate(`/leads/${lead.id}`)} data-testid={`dormant-lead-${lead.id}`}>
                <Snowflake className="w-3 h-3 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-[10px] text-muted-foreground">{lead.status} · {lastDate ? formatDistanceToNow(new Date(lastDate), { addSuffix: true }) : "no activity"}</p>
                </div>
                <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 shrink-0">{lead.status === "Raw Lead Captured" ? "Untouched" : "Cold"}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
        {dormantLeads.length > 8 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-blue-600" onClick={() => navigate("/leads")} data-testid="button-view-all-dormant">
            View all {dormantLeads.length} dormant leads
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function IntelligenceOverview({ stats, navigate }: { stats: any; navigate: (path: string) => void }) {
  const temp = stats.temperatureBreakdown || {};
  const ep = stats.episodeStats || {};
  const noShowDoctors = stats.noShowByDoctor || [];
  const dropOff = stats.dropOffByStage || [];

  const totalActive = Number(temp.total_leads) || 0;
  const convertedLeads = Number(temp.converted_leads) || 0;
  const consultationConvRate = totalActive > 0 ? ((convertedLeads / totalActive) * 100).toFixed(1) : "0";

  const totalEpisodes = Number(ep.total_episodes) || 0;
  const surgeryCount = Number(ep.surgery_count) || 0;
  const consultToSurgeryRate = totalEpisodes > 0 ? ((surgeryCount / totalEpisodes) * 100).toFixed(1) : "0";

  const insuranceCases = Number(ep.insurance_cases) || 0;
  const insuranceApproved = Number(ep.insurance_approved) || 0;
  const insuranceApprovalRate = insuranceCases > 0 ? ((insuranceApproved / insuranceCases) * 100).toFixed(1) : "0";

  const revenueForecast = Number(ep.revenue_forecast) || 0;
  const lostCount = Number(ep.lost_count) || 0;

  const temperatureData = [
    { name: "Very Hot", count: Number(temp.very_hot) || 0, color: "#dc2626" },
    { name: "Hot", count: Number(temp.hot) || 0, color: "#ea580c" },
    { name: "Warm++", count: Number(temp.warm_plus_plus) || 0, color: "#f97316" },
    { name: "Warm+", count: Number(temp.warm_plus) || 0, color: "#fb923c" },
    { name: "Warm", count: Number(temp.warm) || 0, color: "#fbbf24" },
    { name: "Cold", count: Number(temp.cold) || 0, color: "#94a3b8" },
    { name: "Dormant", count: Number(temp.dormant) || 0, color: "#475569" },
  ];
  const totalTempLeads = temperatureData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-4" data-testid="section-intelligence-overview">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Intelligence Overview
        </h3>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card data-testid="card-intel-lead-conversion" className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?status=Consultation Done&view=list")}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Lead→Consultation</span>
            <div className="text-xl font-bold text-foreground mt-1">{consultationConvRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{convertedLeads} of {totalActive}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-intel-surgery-rate" className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?view=list")}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Consultation→Surgery</span>
            <div className="text-xl font-bold text-foreground mt-1">{consultToSurgeryRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{surgeryCount} of {totalEpisodes}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-intel-insurance" className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?view=list")}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Insurance Approval</span>
            <div className="text-xl font-bold text-foreground mt-1">{insuranceApprovalRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{insuranceApproved} of {insuranceCases}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-intel-revenue-forecast" className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?view=list")}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Revenue Forecast</span>
            <div className="text-xl font-bold text-foreground mt-1">Rs.{formatINR(revenueForecast)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-intel-drop-off" className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?status=Closed Lost&view=list")}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground">Drop-Off</span>
            <div className="text-xl font-bold text-foreground mt-1">{lostCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Discontinued</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-temperature-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              Lead Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {temperatureData.map((t) => {
                const pct = totalTempLeads > 0 ? (t.count / totalTempLeads) * 100 : 0;
                const tempFilter = t.name === "Dormant" ? "dormant" : (["Very Hot", "Hot"].includes(t.name) ? "hot" : null);
                return (
                  <div
                    key={t.name}
                    className={`flex items-center gap-2 ${tempFilter ? "cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" : ""}`}
                    data-testid={`temp-bar-${t.name.toLowerCase().replace(/[+ ]/g, "")}`}
                    onClick={tempFilter ? () => navigate(`/leads?filter=${tempFilter}&view=list`) : undefined}
                  >
                    <div className="w-16 text-xs text-muted-foreground shrink-0 text-right">{t.name}</div>
                    <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                      <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: t.color }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-noshow-doctors">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-muted-foreground" />
              No-Show Rate by Doctor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {noShowDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No no-show data yet</p>
            ) : (
              <div className="space-y-2">
                {noShowDoctors.slice(0, 5).map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30" data-testid={`noshow-doctor-${i}`}>
                    <span className="text-sm font-medium truncate flex-1">{doc.doctor_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{doc.no_show_count} no-shows</Badge>
                      <Badge variant={Number(doc.no_show_rate) > 15 ? "destructive" : "outline"} className="text-xs">
                        {Number(doc.no_show_rate).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-drop-off-stages">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Drop-Off by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dropOff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No drop-off data yet</p>
            ) : (
              <div className="space-y-2">
                {dropOff.slice(0, 5).map((stage: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30" data-testid={`dropoff-stage-${i}`}>
                    <span className="text-sm font-medium truncate flex-1">{stage.stage}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{stage.count} lost</Badge>
                      {stage.total_lost_value > 0 && (
                        <Badge variant="outline" className="text-xs">Rs.{formatINR(Number(stage.total_lost_value))}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickActionsCard({ navigate, totalLeads, role }: { navigate: (path: string) => void; totalLeads: number; role: string }) {
  return (
    <Card className="bg-gradient-to-br from-[#0f4c81] to-[#0a3259] text-white border-none" data-testid="card-quick-actions">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="ghost" onClick={() => navigate("/leads")} className="justify-start bg-white/10 text-white hover:bg-white/20 h-auto py-3" data-testid="button-quick-view-leads">
            <Users className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <p className="font-medium text-sm">Leads</p>
              <p className="text-xs opacity-70">{totalLeads} active</p>
            </div>
          </Button>
          <Button variant="ghost" onClick={() => navigate("/appointments")} className="justify-start bg-white/10 text-white hover:bg-white/20 h-auto py-3" data-testid="button-quick-appointments">
            <CalendarCheck className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <p className="font-medium text-sm">Appointments</p>
              <p className="text-xs opacity-70">Schedule</p>
            </div>
          </Button>
          {(role === "management" || role === "manager") && (
            <Button variant="ghost" onClick={() => navigate("/team")} className="justify-start bg-white/10 text-white hover:bg-white/20 h-auto py-3" data-testid="button-quick-team">
              <UserCheck className="w-5 h-5 mr-3 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Team</p>
                <p className="text-xs opacity-70">Management</p>
              </div>
            </Button>
          )}
          {role === "management" && (
            <Button variant="ghost" onClick={() => navigate("/masters")} className="justify-start bg-white/10 text-white hover:bg-white/20 h-auto py-3" data-testid="button-quick-masters">
              <Activity className="w-5 h-5 mr-3 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Masters</p>
                <p className="text-xs opacity-70">Configuration</p>
              </div>
            </Button>
          )}
          {role === "individual" && (
            <Button variant="ghost" onClick={() => navigate("/leads")} className="justify-start bg-white/10 text-white hover:bg-white/20 h-auto py-3" data-testid="button-quick-my-leads">
              <ClipboardList className="w-5 h-5 mr-3 shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">My Leads</p>
                <p className="text-xs opacity-70">View assigned</p>
              </div>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PreopCasesWidget({ navigate, readOnly }: { navigate: (path: string) => void; readOnly?: boolean }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/preop-cases"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/preop-cases", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const cases = data || [];
  if (isLoading || cases.length === 0) return null;

  const pendingClearance = cases.filter((c: any) => !c.preop_clearance_given);
  const cleared = cases.filter((c: any) => c.preop_clearance_given);

  return (
    <Card data-testid="card-preop-cases-widget">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <HeartPulse className="h-4 w-4 text-amber-500" />
          Pre-op Assessment Cases
          <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ml-auto">
            {cases.length} active
          </Badge>
          {pendingClearance.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingClearance.length} awaiting clearance
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Episodes currently in Pre-op Assessment stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {cases.slice(0, 15).map((c: any, i: number) => (
            <div
              key={`preop-case-${c.id}`}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                c.preop_clearance_given
                  ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30"
                  : "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30"
              }`}
              onClick={() => !readOnly && navigate(`/episodes/${c.id}`)}
              data-testid={`preop-case-row-${c.id}`}
            >
              {(() => {
                const surgeryDate = c.surgery_date ? new Date(c.surgery_date) : null;
                const hoursUntilSurgery = surgeryDate ? (surgeryDate.getTime() - Date.now()) / (1000 * 60 * 60) : null;
                const enteredAt = c.preop_entered_at ? new Date(c.preop_entered_at) : null;
                const hoursOverdue = enteredAt ? (Date.now() - enteredAt.getTime()) / (1000 * 60 * 60) : 0;
                // Color rules per spec:
                // Green:  Ready OR clearance given
                // Red:    surgery ≤ 3 days OR no update ≥ 96h (overdue/imminent)
                // Yellow: Not Ready (revisit pending)
                // Amber:  Pending / other
                const isReady = c.assessment_readiness_status === "Ready" || c.preop_clearance_given;
                const isNotReady = c.assessment_readiness_status === "Not Ready";
                const isOverdueOrImminent = !c.preop_clearance_given && (
                  (hoursUntilSurgery !== null && hoursUntilSurgery <= 72) || hoursOverdue >= 96
                );
                const dotColor = isReady ? "bg-green-500"
                  : isOverdueOrImminent ? "bg-red-500 animate-pulse"
                  : isNotReady ? "bg-yellow-500"
                  : "bg-amber-500";
                const surgeryLabel = surgeryDate
                  ? hoursUntilSurgery !== null && hoursUntilSurgery < 0
                    ? "Surgery past"
                    : hoursUntilSurgery !== null && hoursUntilSurgery < 24
                    ? `Surgery in ${Math.round(hoursUntilSurgery)}h ⚠️`
                    : hoursUntilSurgery !== null
                    ? `Surgery in ${Math.ceil(hoursUntilSurgery / 24)}d`
                    : ""
                  : "";
                return (
                  <>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{c.patient_name || c.episode_name || `Episode #${c.id}`}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {surgeryLabel || (enteredAt ? `${Math.round(hoursOverdue)}h since entry` : "")}
                        {c.last_contact_at && (() => {
                          const days = Math.round((Date.now() - new Date(c.last_contact_at).getTime()) / (1000 * 60 * 60 * 24));
                          return ` · ${days}d since contact`;
                        })()}
                        {c.assigned_user_name ? ` · ${c.assigned_user_name}` : ""}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] h-4 shrink-0 ${
                        isReady
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : isOverdueOrImminent
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : isNotReady
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {isReady ? "Cleared" : isOverdueOrImminent ? "Urgent" : isNotReady ? "Not Ready" : c.assessment_readiness_status || "Pending"}
                    </Badge>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        {cases.length > 15 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">{cases.length - 15} more cases not shown</p>
        )}
      </CardContent>
    </Card>
  );
}

function KPICard({ title, value, icon: Icon, trend, up, onClick }: any) {
  return (
    <Card
      data-testid={`card-kpi-${title.toLowerCase().replace(/\s/g, "-")}`}
      className={onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold text-foreground mt-1">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {up !== undefined && (up ? <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" /> : <ArrowDownRight className="h-3 w-3 text-red-500 dark:text-red-400" />)}
          <span className={`text-xs ${up ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{trend}</span>
          {onClick && <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color, onClick }: { label: string; value: number; icon: any; color: string; onClick?: () => void }) {
  return (
    <Card
      data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CardContent>
    </Card>
  );
}

// ─── Universal Dashboard Header ───────────────────────────────────────────────

function UniversalDashboardHeader({ userName, roleLabel, todayTasks, dashStats, navigate }: {
  userName: string; roleLabel: string; todayTasks: any; dashStats: any; navigate: (p: string) => void;
}) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: handovers } = useQuery<any[]>({
    queryKey: ["/api/leads/pending-handovers"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const handoverMutation = useMutation({
    mutationFn: ({ leadId, action }: { leadId: number; action: string }) =>
      apiRequest("PATCH", `/api/leads/${leadId}/handover`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/leads/pending-handovers"] }),
  });

  const overdueCount = (todayTasks?.overdue?.length || 0) + (dashStats?.overdueActions?.length || 0);
  const dueTodayCount = (todayTasks?.dueToday?.length || 0) + (dashStats?.nextActions?.length || 0);

  const urgentItems = [
    ...(dashStats?.overdueActions || []).map((a: any, i: number) => ({
      id: `oa-${a.entity_id}-${i}`,
      label: `${a.action_type_name || "Follow Up"}: ${a.entity_name}`,
      sub: a.next_action_date ? formatDistanceToNow(new Date(a.next_action_date), { addSuffix: true }) : "overdue",
      href: a.entity_type === "lead" ? `/leads/${a.entity_id}` : `/episodes/${a.entity_id}`,
    })),
    ...(todayTasks?.overdue || []).map((t: any) => ({
      id: `ot-${t.id}`,
      label: t.title,
      sub: t.dueDate ? formatDistanceToNow(new Date(t.dueDate), { addSuffix: true }) : "overdue",
      href: `/leads/${t.leadId}`,
    })),
  ].filter(item => !dismissed.has(item.id)).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome, {userName} — {roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs"><User2 className="w-3 h-3 mr-1" />{roleLabel}</Badge>
          <Badge variant="secondary" className="text-xs">Live Data</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => navigate("/leads?view=list")} data-testid="card-universal-my-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-[10px] text-muted-foreground">Overdue</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{dueTodayCount}</p>
                <p className="text-[10px] text-muted-foreground">Due Today</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">0</p>
                <p className="text-[10px] text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={handovers && handovers.length > 0 ? "border-orange-200 bg-orange-50/40 dark:bg-orange-950/10 dark:border-orange-900/40" : ""} data-testid="card-universal-handovers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-orange-500" />
              Pending Handovers
              {handovers && handovers.length > 0 && (
                <Badge className="ml-auto text-xs bg-orange-500 text-white">{handovers.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!handovers || handovers.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-xs text-muted-foreground">No pending handovers</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {handovers.slice(0, 3).map((h: any) => (
                  <div key={h.id} className="flex items-center gap-2 p-1.5 bg-white dark:bg-background border border-orange-200 dark:border-orange-900/50 rounded">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/leads/${h.id}`)}>
                      <p className="text-xs font-medium text-primary truncate">{h.patientName}</p>
                      <p className="text-[10px] text-muted-foreground">From {h.handoverFromUserName}</p>
                    </div>
                    <Button size="sm" className="h-6 text-[10px] px-2 bg-primary text-white shrink-0" onClick={() => handoverMutation.mutate({ leadId: h.id, action: "accept" })} disabled={handoverMutation.isPending}>
                      <Check className="w-3 h-3 mr-1" />Accept
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-universal-attention">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-500" />
              Attention Required
              {urgentItems.length > 0 && <Badge variant="destructive" className="text-xs ml-auto">{urgentItems.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urgentItems.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-xs text-muted-foreground">All caught up — nothing urgent!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {urgentItems.map(item => (
                  <div key={item.id} className="flex items-start gap-2 p-1.5 bg-red-50 dark:bg-red-950/20 rounded">
                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(item.href)}>
                      <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-[10px] text-red-500">{item.sub}</p>
                    </div>
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setDismissed(d => new Set(Array.from(d).concat(item.id)))}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Telecaller Dashboard ──────────────────────────────────────────────────────

function TelecallerDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const perf = dashStats.individualPerformance || {};
  const callStats = perf.callStats || {};
  const funnel = perf.conversionFunnel || {};
  const totalLeads = Number(lc.total_leads) || 0;
  const recentActivities = dashStats.recentActivities || [];

  const allQueue = [
    ...(dashStats.overdueActions || []).map((a: any) => ({ ...a, _overdue: true })),
    ...(dashStats.nextActions || []).map((a: any) => ({ ...a, _overdue: false })),
  ];

  const funnelStages = [
    { label: "Raw", value: Number(funnel.raw) || 0, color: "#94a3b8" },
    { label: "Contacted", value: Number(funnel.contacted) || 0, color: "#60a5fa" },
    { label: "Qualified", value: Number(funnel.qualified) || 0, color: "#a78bfa" },
    { label: "Appt Booked", value: Number(funnel.appointment_booked) || 0, color: "#34d399" },
    { label: "Consult Done", value: Number(funnel.consultation_done) || 0, color: "#f59e0b" },
    { label: "Won", value: Number(funnel.closed_won) || 0, color: "#22c55e" },
  ];
  const maxFunnel = Math.max(...funnelStages.map(s => s.value), 1);

  const callActivities = recentActivities.filter((a: any) => a.type === "call");
  const dispositionMap: Record<string, number> = {};
  callActivities.forEach((a: any) => { if (a.outcome) dispositionMap[a.outcome] = (dispositionMap[a.outcome] || 0) + 1; });

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Telecaller" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="My Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads?filter=my-leads")} />
        <KPICard title="Calls Today" value={(Number(callStats.today_calls) || 0).toString()} icon={PhoneCall} trend={`${Number(callStats.week_calls) || 0} this week`} up onClick={() => navigate("/leads")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Priority calls" up onClick={() => navigate("/leads?filter=hot&view=list")} />
        <KPICard title="Overdue Follow-ups" value={((Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)).toString()} icon={AlertTriangle} trend="Needs attention" up={false} onClick={() => navigate("/transactions?filter=overdue")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-telecaller-lead-queue">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              My Lead Queue
              <Badge variant="secondary" className="ml-auto text-xs">{allQueue.length} pending</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Prioritised by urgency — overdue first</CardDescription>
          </CardHeader>
          <CardContent>
            {allQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No leads in queue — great work!</p>
            ) : (
              <div className="space-y-1.5">
                {allQueue.slice(0, 8).map((a: any, i: number) => (
                  <div key={`q-${i}`} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${a._overdue ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30" : "bg-primary/5 hover:bg-primary/10"}`} onClick={() => navigate(`/leads/${a.entity_id}`)}>
                    <PhoneCall className={`w-3 h-3 shrink-0 ${a._overdue ? "text-red-500" : "text-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{a.entity_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.action_type_name || "Follow Up"}
                        {a.next_action_date ? ` · ${formatDistanceToNow(new Date(a.next_action_date), { addSuffix: true })}` : ""}
                      </p>
                    </div>
                    {a._overdue && <Badge variant="destructive" className="text-[10px] h-4 shrink-0">Overdue</Badge>}
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-telecaller-dispositions">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Today's Dispositions
            </CardTitle>
            <CardDescription className="text-xs">Call outcomes logged today</CardDescription>
          </CardHeader>
          <CardContent>
            {callActivities.length === 0 ? (
              <div className="space-y-1.5">
                {["Interested", "Not Reachable", "Callback Requested", "Not Interested"].map(label => (
                  <div key={label} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant="secondary" className="text-xs">0</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(dispositionMap).map(([outcome, count]) => (
                  <div key={outcome} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                    <span className="text-foreground font-medium">{outcome}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground pt-1">{callActivities.length} calls logged total today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-telecaller-funnel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            My Lead Funnel
          </CardTitle>
          <CardDescription className="text-xs">Lead progression through pipeline stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funnelStages.map((stage, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{stage.label}</span>
                <div className="flex-1 h-7 bg-muted/20 rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500 flex items-center px-2" style={{ width: `${Math.max((stage.value / maxFunnel) * 100, 3)}%`, backgroundColor: stage.color }}>
                    {stage.value > 0 && <span className="text-[10px] font-bold text-white drop-shadow">{stage.value}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      {recentActivities.length > 0 && (
        <Card data-testid="card-telecaller-recent-activity">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities.slice(0, 10).map((act: any) => (
                <div key={act.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/leads/${act.lead_id}`)}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {act.type === "call" ? <PhoneCall className="w-3.5 h-3.5 text-primary" /> : <Activity className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{act.description || act.type}</p>
                    <p className="text-[10px] text-muted-foreground">{act.lead_name}{act.outcome ? ` · ${act.outcome}` : ""}{act.created_at ? ` · ${formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}` : ""}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ─── Receptionist Dashboard ───────────────────────────────────────────────────

function ReceptionistDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const today = new Date().toISOString().split("T")[0];

  const { data: todayAppts, isLoading: apptLoading } = useQuery<any[]>({
    queryKey: ["/api/appointments", "today-receptionist"],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?dateFrom=${today}&dateTo=${today}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const appts = todayAppts || [];
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const arrivingSoon = appts.filter((a: any) => {
    const t = new Date(a.appointmentDate || a.appointment_date || a.scheduledAt);
    return t >= now && t <= twoHoursLater && (a.status === "Scheduled" || a.status === "scheduled");
  });

  const checkedIn = appts.filter((a: any) => ["Checked In", "checked_in", "CheckedIn"].includes(a.status)).length;
  const pending = appts.filter((a: any) => ["Scheduled", "scheduled"].includes(a.status)).length;
  const cancelled = appts.filter((a: any) => ["Cancelled", "cancelled"].includes(a.status)).length;

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Receptionist" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Today's Appointments" value={(Number(ac.today_appointments) || appts.length).toString()} icon={CalendarCheck} trend={`${arrivingSoon.length} arriving soon`} up onClick={() => navigate("/appointments")} />
        <KPICard title="Checked In" value={checkedIn.toString()} icon={UserCheck} trend="Arrived today" up={checkedIn > 0} onClick={() => navigate("/appointments")} />
        <KPICard title="Pending" value={pending.toString()} icon={Clock} trend="Yet to arrive" onClick={() => navigate("/appointments")} />
        <KPICard title="Cancelled" value={cancelled.toString()} icon={X} trend="Today's cancellations" up={false} onClick={() => navigate("/appointments")} />
      </div>

      <Card data-testid="card-receptionist-arriving-soon">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Arriving Soon
            <Badge className="ml-auto text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{arrivingSoon.length} in next 2h</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Patients with appointments in the next 2 hours</CardDescription>
        </CardHeader>
        <CardContent>
          {apptLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
          ) : arrivingSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No appointments in the next 2 hours</p>
          ) : (
            <div className="space-y-1.5">
              {arrivingSoon.map((a: any, i: number) => (
                <div key={a.id || i} className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => navigate(`/leads/${a.leadId || a.lead_id}`)}>
                  <div className="w-12 text-center shrink-0">
                    <p className="text-xs font-bold text-amber-700">{fmtTime(a.appointmentDate || a.appointment_date || a.scheduledAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{a.patientName || a.patient_name || a.leadName || "Patient"}</p>
                    <p className="text-[10px] text-muted-foreground">{a.doctorName || a.doctor_name || "Doctor TBD"}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.status || "Scheduled"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-receptionist-new-leads">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              New Leads Today
              <Badge variant="secondary" className="ml-auto text-xs">{Number(lc.today_new) || 0} new</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Walk-ins and enquiries registered today</CardDescription>
          </CardHeader>
          <CardContent>
            {(Number(lc.today_new) || 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No new leads today yet</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                  <div>
                    <p className="text-lg font-bold text-foreground">{Number(lc.today_new) || 0}</p>
                    <p className="text-xs text-muted-foreground">New enquiries today</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/leads?status=Raw Lead Captured&view=list")}>
                    View <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-sm font-bold">{Number(lc.raw_leads) || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Untouched</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <p className="text-sm font-bold">{Number(lc.appointment_booked) || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Appt Booked</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-receptionist-appt-requests">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Appointment Requests
              <Badge variant="secondary" className="ml-auto text-xs">{(dashStats.nextActions || []).length}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Leads pending appointment scheduling</CardDescription>
          </CardHeader>
          <CardContent>
            {(dashStats.nextActions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending appointment requests</p>
            ) : (
              <div className="space-y-1.5">
                {(dashStats.nextActions || []).slice(0, 6).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-primary/5 rounded-md cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => navigate(`/leads/${a.entity_id}`)}>
                    <CalendarCheck className="w-3 h-3 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{a.entity_name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.action_type_name || "Follow Up"}{a.next_action_date ? ` · ${fmtTime(a.next_action_date)}` : ""}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />
    </>
  );
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────

function DoctorDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const today = new Date().toISOString().split("T")[0];

  const { data: todayAppts, isLoading: apptLoading } = useQuery<any[]>({
    queryKey: ["/api/appointments", "today-doctor"],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?dateFrom=${today}&dateTo=${today}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const appts = todayAppts || [];
  const doneCount = appts.filter((a: any) => ["Consultation Done", "consultation_done"].includes(a.status)).length;
  const recentActivities = dashStats.recentActivities || [];
  const overdueCount = (Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0);

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Doctor" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Today's Consultations" value={apptLoading ? "…" : appts.length.toString()} icon={Stethoscope} trend={`${doneCount} completed`} up onClick={() => navigate("/appointments")} />
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend={`${Number(ec.surgeries) || 0} surgeries`} onClick={() => navigate("/appointments")} />
        <KPICard title="Surgeries This Week" value={(Number(ec.surgeries) || 0).toString()} icon={HeartPulse} trend="Scheduled" up={Number(ec.surgeries) > 0} onClick={() => navigate("/appointments")} />
        <KPICard title="Overdue Actions" value={overdueCount.toString()} icon={AlertTriangle} trend="Needs attention" up={false} />
      </div>

      <Card data-testid="card-doctor-today-schedule">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Today's Schedule
            <Badge variant="secondary" className="ml-auto text-xs">{apptLoading ? "…" : `${appts.length} appointments`}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Consultations scheduled for today</CardDescription>
        </CardHeader>
        <CardContent>
          {apptLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
          ) : appts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No appointments scheduled for today</p>
          ) : (
            <div className="space-y-1.5">
              {appts.map((a: any, i: number) => {
                const isDone = ["Consultation Done", "consultation_done"].includes(a.status);
                return (
                  <div key={a.id || i} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isDone ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100" : "bg-primary/5 hover:bg-primary/10"}`} onClick={() => navigate(`/leads/${a.leadId || a.lead_id}`)}>
                    <div className="w-12 text-center shrink-0">
                      <p className="text-xs font-bold text-primary">{fmtTime(a.appointmentDate || a.appointment_date || a.scheduledAt)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{a.patientName || a.patient_name || "Patient"}</p>
                      <p className="text-[10px] text-muted-foreground">{a.treatmentDepartment || a.treatment_department || a.consultationType || "General"}</p>
                    </div>
                    <Badge variant={isDone ? "default" : "outline"} className="text-[10px] shrink-0">{a.status || "Scheduled"}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PreopCasesWidget navigate={navigate} />

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      {recentActivities.length > 0 && (
        <Card data-testid="card-doctor-recent-activity">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Patient Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities.slice(0, 8).map((act: any) => (
                <div key={act.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/leads/${act.lead_id}`)}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{act.description || act.type}</p>
                    <p className="text-[10px] text-muted-foreground">{act.lead_name}{act.created_at ? ` · ${formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}` : ""}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ─── Medical Assistant Dashboard ──────────────────────────────────────────────

function MedicalAssistantDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const { data: preopCases, isLoading: preopLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/preop-cases"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/preop-cases", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const cases = preopCases || [];
  const cleared = cases.filter((c: any) => c.preop_clearance_given || c.assessment_readiness_status === "Ready");
  const blocked = cases.filter((c: any) => ["Not Fit", "Not Ready"].includes(c.assessment_readiness_status));
  const pending = cases.filter((c: any) => !c.preop_clearance_given && !["Not Fit", "Not Ready"].includes(c.assessment_readiness_status));

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Medical Assistant" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {preopLoading ? (
          [1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)
        ) : (
          <>
            <KPICard title="Pre-op Cases" value={cases.length.toString()} icon={ClipboardList} trend={`${cleared.length} cleared`} up onClick={() => navigate("/appointments")} />
            <KPICard title="Cleared" value={cleared.length.toString()} icon={CheckCircle2} trend="Clearance given" up={cleared.length > 0} />
            <KPICard title="Pending Assessment" value={pending.length.toString()} icon={Clock} trend="Awaiting review" onClick={() => navigate("/appointments")} />
            <KPICard title="Blocked / Not Fit" value={blocked.length.toString()} icon={AlertTriangle} trend="Escalation needed" up={false} />
          </>
        )}
      </div>

      <Card data-testid="card-ma-preop-queue">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
            Pre-op Checklist Queue
            {blocked.length > 0 && <Badge variant="destructive" className="text-xs ml-auto">{blocked.length} blocked</Badge>}
          </CardTitle>
          <CardDescription className="text-xs">Episodes currently in pre-op assessment stage</CardDescription>
        </CardHeader>
        <CardContent>
          {preopLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pre-op cases at this time</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {cases.map((c: any) => {
                const surgDate = c.surgery_date ? new Date(c.surgery_date) : null;
                const hoursUntil = surgDate ? (surgDate.getTime() - Date.now()) / (1000 * 60 * 60) : null;
                const isReady = c.preop_clearance_given || c.assessment_readiness_status === "Ready";
                const isBlocked = ["Not Fit", "Not Ready"].includes(c.assessment_readiness_status);
                const isUrgent = !isReady && hoursUntil !== null && hoursUntil <= 72;
                const bgCls = isReady ? "bg-green-50 dark:bg-green-950/20" : isBlocked ? "bg-red-50 dark:bg-red-950/20" : isUrgent ? "bg-orange-50 dark:bg-orange-950/20" : "bg-amber-50 dark:bg-amber-950/20";
                const dotCls = isReady ? "bg-green-500" : isBlocked ? "bg-red-500" : isUrgent ? "bg-orange-500 animate-pulse" : "bg-amber-500";
                const badgeCls = isReady ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : isBlocked ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : isUrgent ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
                return (
                  <div key={c.id} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${bgCls} hover:opacity-80`} onClick={() => navigate(`/episodes/${c.id}`)}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{c.patient_name || c.episode_name || `Episode #${c.id}`}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {surgDate ? (hoursUntil !== null && hoursUntil > 0 ? `Surgery in ${Math.ceil(hoursUntil / 24)}d` : "Surgery past") : "No surgery date set"}
                        {c.assigned_user_name ? ` · ${c.assigned_user_name}` : ""}
                      </p>
                    </div>
                    <Badge className={`text-[10px] h-4 shrink-0 ${badgeCls}`}>
                      {isReady ? "Cleared" : isBlocked ? "Blocked" : isUrgent ? "Urgent" : c.assessment_readiness_status || "Pending"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />
    </>
  );
}

// ─── Billing Dashboard ────────────────────────────────────────────────────────

function BillingDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const { data: episodes, isLoading: epLoading } = useQuery<any[]>({
    queryKey: ["/api/episodes", "billing-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/episodes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const allEpisodes = episodes || [];
  const pipelineValue = Number(ec.pipeline_value) || 0;
  const realizedRevenue = Number(ec.realized_revenue) || 0;
  const overdueCount = (Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0);

  const pendingBilling = allEpisodes
    .filter((e: any) => e.status && !["Completed", "Discontinued"].includes(e.status))
    .slice(0, 8);

  const collectionPct = pipelineValue > 0 ? Math.min((realizedRevenue / pipelineValue) * 100, 100) : 0;

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Billing" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend="Pending billing" onClick={() => navigate("/transactions")} />
        <KPICard title="Pipeline Value" value={`Rs.${formatINR(pipelineValue)}`} icon={IndianRupee} trend={`${Number(ec.total_episodes) || 0} episodes`} up onClick={() => navigate("/transactions")} />
        <KPICard title="Revenue Realized" value={`Rs.${formatINR(realizedRevenue)}`} icon={Wallet} trend={`${Number(ec.completed) || 0} completed`} up={realizedRevenue > 0} onClick={() => navigate("/transactions")} />
        <KPICard title="Overdue Actions" value={overdueCount.toString()} icon={AlertTriangle} trend="Needs follow-up" up={false} />
      </div>

      {(pipelineValue > 0 || realizedRevenue > 0) && (
        <Card data-testid="card-billing-collection-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Collection Progress
            </CardTitle>
            <CardDescription className="text-xs">Realized revenue vs pipeline value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-3xl font-bold text-emerald-600">Rs.{formatINR(realizedRevenue)}</span>
              <span className="text-xs text-muted-foreground mb-1">of Rs.{formatINR(pipelineValue)} pipeline</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${collectionPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{collectionPct.toFixed(1)}% collected</p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-billing-episodes">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Active Episodes
            <Badge variant="secondary" className="ml-auto text-xs">{pendingBilling.length} pending</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Episodes requiring billing attention</CardDescription>
        </CardHeader>
        <CardContent>
          {epLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : pendingBilling.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pending billing episodes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium text-xs">Patient / Episode</th>
                    <th className="text-left py-2 pr-4 font-medium text-xs">Stage</th>
                    <th className="text-right py-2 font-medium text-xs">Est. Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBilling.map((ep: any) => (
                    <tr key={ep.id} className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/episodes/${ep.id}`)}>
                      <td className="py-2.5 pr-4">
                        <p className="text-xs font-medium text-foreground truncate max-w-[150px]">{ep.patientName || ep.patient_name || ep.episodeName || ep.episode_name || `Episode #${ep.id}`}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className="text-[10px]">{ep.status || "Active"}</Badge>
                      </td>
                      <td className="py-2.5 text-right text-xs font-medium">
                        {ep.expectedRevenue || ep.expected_revenue ? `Rs.${formatINR(Number(ep.expectedRevenue || ep.expected_revenue))}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {allEpisodes.length > 8 && (
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary" onClick={() => navigate("/transactions")}>
              View all {allEpisodes.length} episodes
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Episodes" value={Number(ec.total_episodes) || 0} icon={FileText} color="text-primary" onClick={() => navigate("/transactions")} />
        <StatCard label="Active" value={Number(ec.active_episodes) || 0} icon={Activity} color="text-blue-500" onClick={() => navigate("/transactions")} />
        <StatCard label="Completed" value={Number(ec.completed) || 0} icon={CheckCircle2} color="text-green-500" onClick={() => navigate("/transactions")} />
        <StatCard label="Surgeries" value={Number(ec.surgeries) || 0} icon={HeartPulse} color="text-violet-500" />
      </div>

      <MyTodayAndOverdueSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />
    </>
  );
}

// ─── Marketing Dashboard ──────────────────────────────────────────────────────

function MarketingDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const { data: campaigns, isLoading: campLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const perf = dashStats.individualPerformance || {};
  const leadSources = perf.leadSourceBreakdown || [];
  const totalLeads = Number(lc.total_leads) || 0;
  const consulted = Number(lc.consultation_done) || 0;
  const convRate = totalLeads > 0 ? ((consulted / totalLeads) * 100).toFixed(1) : "0";
  const activeCampaigns = (campaigns || []).filter((c: any) => ["Active", "active"].includes(c.status)).length;
  const recentActivities = dashStats.recentActivities || [];

  const funnelData = [
    { label: "Raw", value: Number(lc.raw_leads) || 0, color: "#94a3b8" },
    { label: "Contacted", value: Number(lc.contacted) || 0, color: "#60a5fa" },
    { label: "Qualified", value: Number(lc.qualified) || 0, color: "#a78bfa" },
    { label: "Appt Booked", value: Number(lc.appointment_booked) || 0, color: "#34d399" },
    { label: "Consulted", value: consulted, color: "#f59e0b" },
    { label: "Won", value: Number(lc.closed_won) || 0, color: "#22c55e" },
  ];
  const maxFunnel = Math.max(...funnelData.map(s => s.value), 1);

  return (
    <>
      <UniversalDashboardHeader userName={userName} roleLabel="Marketing" todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/campaigns")} />
        <KPICard title="Lead→Consultation" value={`${convRate}%`} icon={TrendingUp} trend={`${consulted} consultations`} up={Number(convRate) > 0} />
        <KPICard title="Active Campaigns" value={activeCampaigns.toString()} icon={Megaphone} trend={`${(campaigns || []).length} total`} up={activeCampaigns > 0} onClick={() => navigate("/campaigns")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Priority prospects" up onClick={() => navigate("/campaigns")} />
      </div>

      {leadSources.length > 0 && (
        <Card data-testid="card-marketing-lead-sources">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Lead Source Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Where leads are coming from this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadSources.map((s: any, i: number) => {
                const count = Number(s.lead_count) || 0;
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground truncate max-w-[200px]">{s.source_name || "Unknown"}</span>
                      <span className="text-muted-foreground shrink-0">{count} leads · {Number(s.converted) || 0} converted</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded overflow-hidden">
                      <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-marketing-campaigns">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Campaign Performance
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate("/campaigns")}>View All</Button>
          </CardTitle>
          <CardDescription className="text-xs">Active and recent campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {campLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !campaigns || campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No campaigns yet — <button className="text-primary underline" onClick={() => navigate("/campaigns")}>create one</button></p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium text-xs">Campaign</th>
                    <th className="text-center py-2 pr-4 font-medium text-xs">Status</th>
                    <th className="text-right py-2 font-medium text-xs">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 8).map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/campaigns")}>
                      <td className="py-2.5 pr-4">
                        <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{c.name || `Campaign #${c.id}`}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <Badge variant={["Active", "active"].includes(c.status) ? "default" : "secondary"} className="text-[10px]">{c.status || "Draft"}</Badge>
                      </td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">{c.source || c.leadSource || c.lead_source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-marketing-funnel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Follow-up Funnel
          </CardTitle>
          <CardDescription className="text-xs">Stage-wise count across the marketing pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funnelData.map((stage, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{stage.label}</span>
                <div className="flex-1 h-7 bg-muted/20 rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500 flex items-center px-2" style={{ width: `${Math.max((stage.value / maxFunnel) * 100, 3)}%`, backgroundColor: stage.color }}>
                    {stage.value > 0 && <span className="text-[10px] font-bold text-white drop-shadow">{stage.value}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {recentActivities.length > 0 && (
        <Card data-testid="card-marketing-recent-leads">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Lead Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities.slice(0, 10).map((act: any) => (
                <div key={act.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/leads/${act.lead_id}`)}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{act.lead_name || act.description}</p>
                    <p className="text-[10px] text-muted-foreground">{act.type}{act.created_at ? ` · ${formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}` : ""}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
