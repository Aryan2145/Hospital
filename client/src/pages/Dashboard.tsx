import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { Sidebar } from "@/components/layout/Sidebar";
import { useLeads } from "@/hooks/use-leads";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, CalendarCheck, Target,
  ArrowUpRight, ArrowDownRight, Activity, Stethoscope, UserCheck,
  IndianRupee, BarChart3, PieChart as PieChartIcon,
  AlertTriangle, Phone, Clock, CheckCircle2, Flame, Snowflake, ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  CartesianGrid, PieChart, Pie, Line, AreaChart, Area
} from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useLocation } from "wouter";

const VIROC_BLUE = "#0f4c81";
const VIROC_ORANGE = "#ff8c00";

const campaignData = {
  facebook: {
    platform: "Facebook",
    totalSpend: 185000,
    impressions: 892400,
    clicks: 34210,
    leads: 487,
    conversions: 68,
    ctr: 3.83,
    cpl: 380,
    roas: 4.2,
    campaigns: [
      { name: "Robotic Knee Replacement Awareness", status: "Active", budget: 50000, spent: 42300, impressions: 245000, clicks: 11200, leads: 156, cpl: 271, startDate: "2026-01-01" },
      { name: "Free Ortho Camp - Vadodara", status: "Active", budget: 25000, spent: 21800, impressions: 189000, clicks: 8900, leads: 112, cpl: 195, startDate: "2026-01-15" },
      { name: "Dr. Vrajesh Shah - Expert Talks", status: "Active", budget: 35000, spent: 31200, impressions: 167000, clicks: 5400, leads: 78, cpl: 400, startDate: "2026-02-01" },
      { name: "Spine Surgery Success Stories", status: "Paused", budget: 30000, spent: 28500, impressions: 134000, clicks: 4200, leads: 54, cpl: 528, startDate: "2025-12-15" },
      { name: "Joint Pain? Visit VIROC", status: "Active", budget: 40000, spent: 38200, impressions: 112000, clicks: 3100, leads: 52, cpl: 735, startDate: "2026-01-20" },
      { name: "Insurance Cashless Surgery", status: "Active", budget: 20000, spent: 23000, impressions: 45400, clicks: 1410, leads: 35, cpl: 657, startDate: "2026-02-05" },
    ]
  },
  instagram: {
    platform: "Instagram",
    totalSpend: 125000,
    impressions: 654300,
    clicks: 21870,
    leads: 312,
    conversions: 41,
    ctr: 3.34,
    cpl: 401,
    roas: 3.8,
    campaigns: [
      { name: "Patient Testimonial Reels", status: "Active", budget: 30000, spent: 27800, impressions: 198000, clicks: 7200, leads: 89, cpl: 312, startDate: "2026-01-10" },
      { name: "Robotic NKR - How It Works", status: "Active", budget: 25000, spent: 22100, impressions: 156000, clicks: 5600, leads: 67, cpl: 330, startDate: "2026-01-20" },
      { name: "Dr. Paradkar Spine Stories", status: "Active", budget: 20000, spent: 19500, impressions: 112000, clicks: 3800, leads: 52, cpl: 375, startDate: "2026-02-01" },
      { name: "Sports Injury Recovery Reels", status: "Paused", budget: 15000, spent: 14200, impressions: 98000, clicks: 2900, leads: 44, cpl: 323, startDate: "2025-12-20" },
      { name: "VIROC Brand Awareness", status: "Active", budget: 35000, spent: 41400, impressions: 90300, clicks: 2370, leads: 60, cpl: 690, startDate: "2026-01-05" },
    ]
  },
  google: {
    platform: "Google Ads",
    totalSpend: 245000,
    impressions: 1234500,
    clicks: 48920,
    leads: 634,
    conversions: 92,
    ctr: 3.96,
    cpl: 387,
    roas: 5.1,
    campaigns: [
      { name: "Knee Replacement Vadodara (Search)", status: "Active", budget: 80000, spent: 72300, impressions: 345000, clicks: 15600, leads: 198, cpl: 365, startDate: "2025-11-01" },
      { name: "Best Orthopaedic Hospital Gujarat", status: "Active", budget: 60000, spent: 55200, impressions: 289000, clicks: 12400, leads: 156, cpl: 354, startDate: "2025-12-01" },
      { name: "Robotic Knee Surgery Cost (Search)", status: "Active", budget: 45000, spent: 41800, impressions: 198000, clicks: 8900, leads: 112, cpl: 373, startDate: "2026-01-01" },
      { name: "Spine Doctor Near Me (Search)", status: "Active", budget: 35000, spent: 42300, impressions: 234000, clicks: 7200, leads: 98, cpl: 431, startDate: "2026-01-15" },
      { name: "VIROC Display Network", status: "Active", budget: 25000, spent: 33400, impressions: 168500, clicks: 4820, leads: 70, cpl: 477, startDate: "2026-02-01" },
    ]
  }
};

const monthlyTrends = [
  { month: "Sep", leads: 89, appointments: 42, conversions: 18, spend: 38000 },
  { month: "Oct", leads: 112, appointments: 56, conversions: 24, spend: 45000 },
  { month: "Nov", leads: 134, appointments: 67, conversions: 31, spend: 52000 },
  { month: "Dec", leads: 156, appointments: 78, conversions: 38, spend: 48000 },
  { month: "Jan", leads: 198, appointments: 94, conversions: 45, spend: 62000 },
  { month: "Feb", leads: 178, appointments: 86, conversions: 42, spend: 55000 },
];

const leadSourceData = [
  { name: "Google Ads", value: 634, color: "#4285F4" },
  { name: "Facebook", value: 487, color: "#1877F2" },
  { name: "Instagram", value: 312, color: "#E4405F" },
  { name: "JustDial", value: 156, color: "#1a73e8" },
  { name: "Practo", value: 98, color: "#14bef0" },
  { name: "viroc.in", value: 78, color: VIROC_BLUE },
  { name: "YouTube", value: 45, color: "#FF0000" },
  { name: "Doctor Referral", value: 89, color: "#10b981" },
  { name: "Patient Referral", value: 67, color: "#8b5cf6" },
  { name: "Walk-In", value: 34, color: "#f59e0b" },
];

const doctorPerformance = [
  { name: "Dr. Vrajesh Shah", appointments: 42, conversions: 18, revenue: 2850000, specialty: "Joint Replacement" },
  { name: "Dr. Rajiv Paradkar", appointments: 38, conversions: 15, revenue: 2400000, specialty: "Joint Replacement / Spine" },
  { name: "Dr. Pratik Patel", appointments: 28, conversions: 12, revenue: 1980000, specialty: "Spine Surgery" },
  { name: "Dr. Darshan Suthar", appointments: 22, conversions: 9, revenue: 890000, specialty: "Arthroscopy / Trauma" },
  { name: "Dr. Tanmay Jaysingani", appointments: 18, conversions: 7, revenue: 720000, specialty: "Arthroscopy / Robotic Knee" },
  { name: "Dr. Vihal Patel", appointments: 14, conversions: 5, revenue: 450000, specialty: "Foot & Ankle" },
  { name: "Dr. Mihir Shah", appointments: 8, conversions: 3, revenue: 180000, specialty: "Critical Care" },
];

const conversionFunnel = [
  { stage: "Impressions", value: 2781200, fill: "#e2e8f0" },
  { stage: "Clicks", value: 105000, fill: "#93c5fd" },
  { stage: "Leads Generated", value: 1433, fill: "#3b82f6" },
  { stage: "Qualified", value: 856, fill: "#8b5cf6" },
  { stage: "Appointments", value: 412, fill: VIROC_ORANGE },
  { stage: "Consultations", value: 289, fill: "#f97316" },
  { stage: "Conversions", value: 201, fill: "#10b981" },
];

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
  const { data: leads, isLoading } = useLeads();
  const [, navigate] = useLocation();
  const [campaignTab, setCampaignTab] = useState("overview");

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

  if (isLoading) return <LoadingSpinner />;

  const totalLeads = leads?.length || 0;
  const newLeads = leads?.filter(l => l.status === "Raw Lead Captured").length || 0;
  const qualified = leads?.filter(l => l.status === "Qualified").length || 0;
  const booked = leads?.filter(l => l.status === "Appointment Booked").length || 0;
  const consulted = leads?.filter(l => l.status === "Consultation Done").length || 0;

  const pipelineData = [
    { name: "Raw Lead", count: newLeads, color: "#94a3b8" },
    { name: "Contacted", count: leads?.filter(l => l.status === "Contacted").length || 0, color: "#3b82f6" },
    { name: "Qualified", count: qualified, color: "#8b5cf6" },
    { name: "Appt Booked", count: booked, color: VIROC_ORANGE },
    { name: "Consulted", count: consulted, color: "#10b981" },
    { name: "Nurture", count: leads?.filter(l => l.status === "Nurture").length || 0, color: "#f59e0b" },
  ];

  const totalCampaignSpend = campaignData.facebook.totalSpend + campaignData.instagram.totalSpend + campaignData.google.totalSpend;
  const totalCampaignLeads = campaignData.facebook.leads + campaignData.instagram.leads + campaignData.google.leads;
  const totalConversions = campaignData.facebook.conversions + campaignData.instagram.conversions + campaignData.google.conversions;
  const overallCPL = Math.round(totalCampaignSpend / totalCampaignLeads);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">Dashboard</h2>
              <p className="text-sm text-muted-foreground mt-0.5">VIROC Super Speciality Orthopaedic Hospital - CRM Analytics</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">Live Data</Badge>
              <Badge variant="secondary" className="text-xs">Feb 2026</Badge>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <KPICard title="Total Leads" value={totalCampaignLeads.toLocaleString("en-IN")} icon={Users} trend="+27% vs last month" up />
            <KPICard title="Ad Spend" value={`${formatINR(totalCampaignSpend)}`} prefix="Rs." icon={IndianRupee} trend="Rs.5.55L total" />
            <KPICard title="Avg CPL" value={`Rs.${overallCPL}`} icon={Target} trend="-8% vs last month" up />
            <KPICard title="Conversions" value={totalConversions.toString()} icon={UserCheck} trend="14% conv. rate" up />
            <KPICard title="Revenue" value="Rs.94.7L" icon={IndianRupee} trend="ROAS 4.4x" up />
          </div>

          {((todayTasks?.total || 0) > 0 || (dormantLeads?.length || 0) > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {(todayTasks?.total || 0) > 0 && (
                <Card>
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
                            <div key={task.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md cursor-pointer hover-elevate" onClick={() => navigate(`/leads/${task.leadId}`)} data-testid={`overdue-task-${task.id}`}>
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
                            <div key={task.id} className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md cursor-pointer hover-elevate" onClick={() => navigate(`/leads/${task.leadId}`)} data-testid={`today-task-${task.id}`}>
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

              {(dormantLeads?.length || 0) > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      Dormant Leads
                      <Badge variant="outline" className="ml-auto text-xs bg-blue-50 text-blue-700 border-blue-200">{dormantLeads.length} cold</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">No activity for 5+ days — needs attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {dormantLeads.slice(0, 8).map((lead: any) => {
                        const lastDate = lead.lastContactAt || lead.updatedAt || lead.createdAt;
                        return (
                          <div key={lead.id} className="flex items-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-md cursor-pointer hover-elevate" onClick={() => navigate(`/leads/${lead.id}`)} data-testid={`dormant-lead-${lead.id}`}>
                            <Snowflake className="w-3 h-3 text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                              <p className="text-[10px] text-muted-foreground">{lead.status} · {lastDate ? formatDistanceToNow(new Date(lastDate), { addSuffix: true }) : "no activity"}</p>
                            </div>
                            <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 shrink-0">{lead.status === "Raw Lead Captured" ? "Untouched" : "Cold"}</Badge>
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
              )}
            </div>
          )}

          {/* Campaign Analytics Section */}
          <Tabs value={campaignTab} onValueChange={setCampaignTab}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-foreground">Campaign Analytics</h3>
              <TabsList>
                <TabsTrigger value="overview" data-testid="tab-campaign-overview">Overview</TabsTrigger>
                <TabsTrigger value="facebook" data-testid="tab-campaign-facebook">Facebook</TabsTrigger>
                <TabsTrigger value="instagram" data-testid="tab-campaign-instagram">Instagram</TabsTrigger>
                <TabsTrigger value="google" data-testid="tab-campaign-google">Google Ads</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <PlatformSummaryCard data={campaignData.facebook} color="#1877F2" />
                <PlatformSummaryCard data={campaignData.instagram} color="#E4405F" />
                <PlatformSummaryCard data={campaignData.google} color="#4285F4" />
              </div>
            </TabsContent>

            <TabsContent value="facebook" className="mt-4">
              <CampaignTable campaigns={campaignData.facebook.campaigns} color="#1877F2" />
            </TabsContent>
            <TabsContent value="instagram" className="mt-4">
              <CampaignTable campaigns={campaignData.instagram.campaigns} color="#E4405F" />
            </TabsContent>
            <TabsContent value="google" className="mt-4">
              <CampaignTable campaigns={campaignData.google.campaigns} color="#4285F4" />
            </TabsContent>
          </Tabs>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Monthly Trends */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Monthly Trends (6 months)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={VIROC_BLUE} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={VIROC_BLUE} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="leads" stroke={VIROC_BLUE} fill="url(#leadGrad)" strokeWidth={2} name="Leads" />
                    <Area type="monotone" dataKey="appointments" stroke={VIROC_ORANGE} fill="transparent" strokeWidth={2} strokeDasharray="4 2" name="Appointments" />
                    <Area type="monotone" dataKey="conversions" stroke="#10b981" fill="url(#convGrad)" strokeWidth={2} name="Conversions" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lead Source Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  Lead Source Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {leadSourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString("en-IN")} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel + Lead Pipeline */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Conversion Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversionFunnel.map((stage, i) => {
                    const maxVal = conversionFunnel[0].value;
                    const pct = (stage.value / maxVal) * 100;
                    const dropoff = i > 0 ? ((1 - stage.value / conversionFunnel[i - 1].value) * 100).toFixed(1) : null;
                    return (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <div className="w-28 text-xs text-muted-foreground shrink-0 text-right">{stage.stage}</div>
                        <div className="flex-1 relative h-7 bg-muted/30 rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stage.fill }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
                            {formatNumber(stage.value)}
                          </span>
                        </div>
                        {dropoff && (
                          <span className="text-xs text-red-500 dark:text-red-400 w-12 shrink-0">-{dropoff}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* CRM Lead Pipeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  CRM Lead Pipeline
                </CardTitle>
                <CardDescription className="text-xs">Current leads in system by status</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Doctor Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                Doctor Performance - This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-doctor-performance">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Doctor</th>
                      <th className="text-left py-2 pr-4 font-medium">Specialty</th>
                      <th className="text-right py-2 pr-4 font-medium">Appointments</th>
                      <th className="text-right py-2 pr-4 font-medium">Conversions</th>
                      <th className="text-right py-2 pr-4 font-medium">Conv. Rate</th>
                      <th className="text-right py-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorPerformance.map((doc) => (
                      <tr key={doc.name} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-foreground">{doc.name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{doc.specialty}</td>
                        <td className="py-2.5 pr-4 text-right">{doc.appointments}</td>
                        <td className="py-2.5 pr-4 text-right">{doc.conversions}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <Badge variant="secondary" className="text-xs">
                            {((doc.conversions / doc.appointments) * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right font-medium">Rs.{formatINR(doc.revenue)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2.5 pr-4">Total</td>
                      <td className="py-2.5 pr-4"></td>
                      <td className="py-2.5 pr-4 text-right">{doctorPerformance.reduce((s, d) => s + d.appointments, 0)}</td>
                      <td className="py-2.5 pr-4 text-right">{doctorPerformance.reduce((s, d) => s + d.conversions, 0)}</td>
                      <td className="py-2.5 pr-4 text-right">
                        <Badge variant="secondary" className="text-xs">
                          {((doctorPerformance.reduce((s, d) => s + d.conversions, 0) / doctorPerformance.reduce((s, d) => s + d.appointments, 0)) * 100).toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">Rs.{formatINR(doctorPerformance.reduce((s, d) => s + d.revenue, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ad Spend vs Leads Chart + Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  Monthly Ad Spend vs Leads
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number, name: string) => name === "Ad Spend" ? `Rs.${value.toLocaleString("en-IN")}` : value} />
                    <Bar yAxisId="left" dataKey="spend" fill={VIROC_BLUE} radius={[4, 4, 0, 0]} barSize={28} name="Ad Spend" opacity={0.7} />
                    <Line yAxisId="right" type="monotone" dataKey="leads" stroke={VIROC_ORANGE} strokeWidth={2.5} dot={{ fill: VIROC_ORANGE, r: 4 }} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#0f4c81] to-[#0a3259] text-white border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/leads")}
                  className="w-full justify-start bg-white/10 text-white"
                  data-testid="button-quick-view-leads"
                >
                  <Users className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">View Leads</p>
                    <p className="text-xs opacity-70">{totalLeads} active leads</p>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/appointments")}
                  className="w-full justify-start bg-white/10 text-white"
                  data-testid="button-quick-appointments"
                >
                  <CalendarCheck className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Appointments</p>
                    <p className="text-xs opacity-70">8 scheduled today</p>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/team")}
                  className="w-full justify-start bg-white/10 text-white"
                  data-testid="button-quick-team"
                >
                  <UserCheck className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Team Management</p>
                    <p className="text-xs opacity-70">7 doctors, 4 counsellors</p>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/masters")}
                  className="w-full justify-start bg-white/10 text-white"
                  data-testid="button-quick-masters"
                >
                  <Activity className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Master Data</p>
                    <p className="text-xs opacity-70">9 categories, 50+ tables</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Social Media Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <SocialCard platform="Instagram" handle="@viroc_hospital" followers="3,224" posts="575" engagement="4.2%" color="#E4405F" />
            <SocialCard platform="Facebook" handle="VIROC Hospital" followers="8,456" posts="892" engagement="3.1%" color="#1877F2" />
            <SocialCard platform="YouTube" handle="VIROC Hospital" subscribers="1,245" videos="86" engagement="5.8%" color="#FF0000" />
            <SocialCard platform="LinkedIn" handle="viroc-hospital" followers="2,180" posts="234" engagement="2.4%" color="#0077B5" />
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, trend, up }: any) {
  return (
    <Card data-testid={`card-kpi-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold text-foreground mt-1">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {up !== undefined && (up ? <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" /> : <ArrowDownRight className="h-3 w-3 text-red-500 dark:text-red-400" />)}
          <span className={`text-xs ${up ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformSummaryCard({ data, color }: { data: typeof campaignData.facebook; color: string }) {
  return (
    <Card data-testid={`card-platform-${data.platform.toLowerCase().replace(/\s/g, "")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          {data.platform}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Spend</p>
            <p className="text-sm font-semibold">Rs.{formatINR(data.totalSpend)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Impressions</p>
            <p className="text-sm font-semibold">{formatNumber(data.impressions)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-sm font-semibold">{formatNumber(data.clicks)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="text-sm font-semibold">{data.ctr}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Leads</p>
            <p className="text-sm font-semibold text-foreground">{data.leads}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPL</p>
            <p className="text-sm font-semibold">Rs.{data.cpl}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conversions</p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{data.conversions}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="text-sm font-semibold">{data.roas}x</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{data.campaigns.length} campaigns</span>
            <Badge variant="secondary" className="text-xs">{data.campaigns.filter(c => c.status === "Active").length} Active</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignTable({ campaigns, color }: { campaigns: typeof campaignData.facebook.campaigns; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Campaign</th>
                <th className="text-center py-2 pr-4 font-medium">Status</th>
                <th className="text-right py-2 pr-4 font-medium">Budget</th>
                <th className="text-right py-2 pr-4 font-medium">Spent</th>
                <th className="text-right py-2 pr-4 font-medium">Impressions</th>
                <th className="text-right py-2 pr-4 font-medium">Clicks</th>
                <th className="text-right py-2 pr-4 font-medium">Leads</th>
                <th className="text-right py-2 font-medium">CPL</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.name} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    <Badge variant={c.status === "Active" ? "default" : "secondary"} className="text-xs">
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">Rs.{formatINR(c.budget)}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={c.spent > c.budget ? "text-red-500 dark:text-red-400 font-medium" : ""}>
                      Rs.{formatINR(c.spent)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">{formatNumber(c.impressions)}</td>
                  <td className="py-2.5 pr-4 text-right">{formatNumber(c.clicks)}</td>
                  <td className="py-2.5 pr-4 text-right font-medium">{c.leads}</td>
                  <td className="py-2.5 text-right">Rs.{c.cpl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SocialCard({ platform, handle, followers, posts, engagement, color }: any) {
  return (
    <Card data-testid={`card-social-${platform.toLowerCase()}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-medium text-sm text-foreground">{platform}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{handle}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-sm font-semibold">{followers}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Posts</p>
            <p className="text-sm font-semibold">{posts}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-sm font-semibold" style={{ color }}>{engagement}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
