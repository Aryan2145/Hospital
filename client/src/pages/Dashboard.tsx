import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
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
  PhoneCall, ListChecks, Eye, FileText, User2, Building2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  CartesianGrid, PieChart, Pie
} from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useLocation } from "wouter";

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
  const { crmUser, roleCode, isAdmin, isManager, isSysAdmin } = useCurrentUser();
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

function ManagementDashboard({ lc, ec, ac, dashStats, todayTasks, dormantLeads, intelligenceStats, navigate, userName }: any) {
  const totalLeads = Number(lc.total_leads) || 0;
  const pipelineValue = Number(ec.pipeline_value) || 0;
  const realizedRevenue = Number(ec.realized_revenue) || 0;

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
            Management Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {userName} — Hospital CRM Overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />Management View</Badge>
          <Badge variant="secondary" className="text-xs">Live Data</Badge>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KPICard title="Total Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads")} />
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend={`${Number(ec.surgeries) || 0} surgeries`} up onClick={() => navigate("/leads?view=list")} />
        <KPICard title="Pipeline Value" value={`Rs.${formatINR(pipelineValue)}`} icon={IndianRupee} trend={`${Number(ec.total_episodes) || 0} total episodes`} onClick={() => navigate("/leads?view=list")} />
        <KPICard title="Revenue Realized" value={`Rs.${formatINR(realizedRevenue)}`} icon={IndianRupee} trend={`${Number(ec.completed) || 0} completed`} up={realizedRevenue > 0} onClick={() => navigate("/leads?status=Closed Won&view=list")} />
        <KPICard title="Today Appointments" value={(Number(ac.today_appointments) || 0).toString()} icon={CalendarCheck} trend={`${Number(ac.today_pending) || 0} pending`} onClick={() => navigate("/appointments")} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hot Leads" value={Number(lc.hot_leads) || 0} icon={Flame} color="text-orange-500" onClick={() => navigate("/leads?filter=hot&view=list")} />
        <StatCard label="Dormant Leads" value={Number(lc.dormant_leads) || 0} icon={Snowflake} color="text-blue-400" onClick={() => navigate("/leads?filter=dormant&view=list")} />
        <StatCard label="Overdue Actions" value={(Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)} icon={AlertTriangle} color="text-red-500" onClick={() => navigate("/leads?filter=overdue&view=list")} />
        <StatCard label="Insurance Cases" value={Number(ec.insurance_cases) || 0} icon={ShieldCheck} color="text-cyan-500" onClick={() => navigate("/leads?view=list")} />
      </div>

      <TasksAndActionsSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      {(dormantLeads?.length || 0) > 0 && (
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
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} className="cursor-pointer" onClick={(_: any, index: number) => navigate(`/leads?status=${encodeURIComponent(pipelineData[index].status)}&view=list`)}>
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

      {intelligenceStats && <IntelligenceOverview stats={intelligenceStats} navigate={navigate} />}

      <QuickActionsCard navigate={navigate} totalLeads={totalLeads} role="management" />
    </>
  );
}

function ManagerDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName }: any) {
  const totalLeads = Number(lc.total_leads) || 0;

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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="My Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Needs immediate attention" up onClick={() => navigate("/leads?filter=hot&view=list")} />
        <KPICard title="Active Episodes" value={(Number(ec.active_episodes) || 0).toString()} icon={FileText} trend={`${Number(ec.surgeries) || 0} surgeries`} onClick={() => navigate("/leads?view=list")} />
        <KPICard title="Today Appointments" value={(Number(ac.today_appointments) || 0).toString()} icon={CalendarCheck} trend={`${Number(ac.today_pending) || 0} pending`} onClick={() => navigate("/appointments")} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overdue Actions" value={(Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)} icon={AlertTriangle} color="text-red-500" onClick={() => navigate("/leads?filter=overdue&view=list")} />
        <StatCard label="Today's Actions" value={(Number(lc.today_actions) || 0) + (Number(ec.today_ep_actions) || 0)} icon={ListChecks} color="text-primary" onClick={() => navigate("/leads?view=list")} />
        <StatCard label="Dormant Leads" value={Number(lc.dormant_leads) || 0} icon={Snowflake} color="text-blue-400" onClick={() => navigate("/leads?filter=dormant&view=list")} />
        <StatCard label="Untouched Leads" value={Number(lc.raw_leads) || 0} icon={Eye} color="text-amber-500" onClick={() => navigate("/leads?status=Raw Lead Captured&view=list")} />
      </div>

      <TasksAndActionsSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

      {dashStats.teamStats && dashStats.teamStats.length > 0 && (
        <TeamPerformanceCard teamStats={dashStats.teamStats} navigate={navigate} />
      )}

      <QuickActionsCard navigate={navigate} totalLeads={totalLeads} role="manager" />
    </>
  );
}

function IndividualDashboard({ lc, ec, ac, dashStats, todayTasks, navigate, userName, roleCode }: any) {
  const totalLeads = Number(lc.total_leads) || 0;
  const roleLabel = roleCode === "COUNSELLOR" ? "Counsellor" : roleCode === "AGENT" ? "Tele-Caller" : "Team Member";

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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="My Leads" value={totalLeads.toString()} icon={Users} trend={`${Number(lc.today_new) || 0} new today`} up={Number(lc.today_new) > 0} onClick={() => navigate("/leads?filter=my-leads")} />
        <KPICard title="Hot Leads" value={(Number(lc.hot_leads) || 0).toString()} icon={Flame} trend="Priority follow-ups" up onClick={() => navigate("/leads?filter=hot&view=list")} />
        <KPICard title="Today's Actions" value={((Number(lc.today_actions) || 0) + (Number(ec.today_ep_actions) || 0)).toString()} icon={ListChecks} trend="Due today" onClick={() => navigate("/leads?view=list")} />
        <KPICard title="Overdue" value={((Number(lc.overdue_actions) || 0) + (Number(ec.overdue_ep_actions) || 0)).toString()} icon={AlertTriangle} trend="Needs attention" up={false} onClick={() => navigate("/leads?filter=overdue&view=list")} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Untouched Leads" value={Number(lc.raw_leads) || 0} icon={Eye} color="text-amber-500" onClick={() => navigate("/leads?status=Raw Lead Captured&view=list")} />
        <StatCard label="Contacted" value={Number(lc.contacted) || 0} icon={PhoneCall} color="text-blue-500" onClick={() => navigate("/leads?status=Contacted&view=list")} />
        <StatCard label="Qualified" value={Number(lc.qualified) || 0} icon={CheckCircle2} color="text-purple-500" onClick={() => navigate("/leads?status=Qualified&view=list")} />
        <StatCard label="Appt Booked" value={Number(lc.appointment_booked) || 0} icon={CalendarCheck} color="text-green-500" onClick={() => navigate("/leads?status=Appointment Booked&view=list")} />
      </div>

      <TasksAndActionsSection todayTasks={todayTasks} dashStats={dashStats} navigate={navigate} />

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

function TasksAndActionsSection({ todayTasks, dashStats, navigate }: any) {
  const hasOverdueActions = dashStats.overdueActions?.length > 0;
  const hasTodayActions = dashStats.nextActions?.length > 0;
  const hasTasks = (todayTasks?.total || 0) > 0;

  if (!hasOverdueActions && !hasTodayActions && !hasTasks) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(hasTasks) && (
        <Card data-testid="card-todays-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4 text-primary" />
              Today's Tasks
              <Badge variant="secondary" className="ml-auto text-xs">{todayTasks.total} pending</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.overdue.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue ({todayTasks.overdue.length})
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
            {todayTasks.dueToday.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">Due Today ({todayTasks.dueToday.length})</p>
                <div className="space-y-1.5">
                  {todayTasks.dueToday.slice(0, 5).map((task: any) => (
                    <div key={task.id} className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors" onClick={() => navigate(`/leads/${task.leadId}`)} data-testid={`today-task-${task.id}`}>
                      <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground">{task.dueDate && format(new Date(task.dueDate), "h:mm a")}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-next-actions">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <ListChecks className="h-4 w-4 text-primary" />
            Next Actions
            {hasOverdueActions && (
              <Badge variant="destructive" className="text-xs">{dashStats.overdueActions.length} overdue</Badge>
            )}
            {hasTodayActions && (
              <Badge variant="secondary" className="ml-auto text-xs">{dashStats.nextActions.length} today</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasOverdueActions && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-600 mb-1.5">Overdue</p>
              <div className="space-y-1.5">
                {dashStats.overdueActions.slice(0, 5).map((a: any, i: number) => (
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
          {hasTodayActions && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Due Today</p>
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
                        {a.next_action_date && format(new Date(a.next_action_date), "h:mm a")}
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
          {!hasOverdueActions && !hasTodayActions && (
            <p className="text-sm text-muted-foreground py-4 text-center">No actions scheduled for today</p>
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
