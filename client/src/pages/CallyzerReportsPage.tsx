import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, UserCheck, UserX, Filter, Download, Search,
  BarChart3, Users, Headphones, Link2, Unlink, ToggleLeft, ToggleRight
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const VIROC_BLUE = "#0f4c81";

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDurationShort(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallyzerReportsPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(today);
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("logs");

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("from", dateFrom);
  if (dateTo) queryParams.set("to", dateTo);
  if (callTypeFilter !== "all") queryParams.set("callType", callTypeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data, isLoading } = useQuery<{
    logs: any[];
    summary: {
      totalCalls: number;
      incomingCalls: number;
      outgoingCalls: number;
      missedCalls: number;
      matchedCalls: number;
      autoCreatedCalls: number;
      unmatchedCalls: number;
      totalDuration: number;
      avgDuration: number;
    };
    employeeStats: {
      name: string;
      total: number;
      incoming: number;
      outgoing: number;
      missed: number;
      totalDuration: number;
      matched: number;
    }[];
  }>({
    queryKey: ["/api/callyzer-webhook-logs", dateFrom, dateTo, callTypeFilter, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/callyzer-webhook-logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const summary = data?.summary || { totalCalls: 0, incomingCalls: 0, outgoingCalls: 0, missedCalls: 0, matchedCalls: 0, autoCreatedCalls: 0, unmatchedCalls: 0, totalDuration: 0, avgDuration: 0 };
  const employeeStats = data?.employeeStats || [];

  const filteredLogs = searchTerm
    ? logs.filter(l =>
        (l.clientNumber || "").includes(searchTerm) ||
        (l.employeeNumber || "").includes(searchTerm) ||
        (l.crmUserName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.leadName || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  const getCallTypeBadge = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("incoming")) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200" data-testid="badge-call-incoming"><PhoneIncoming className="w-3 h-3 mr-1" />Incoming</Badge>;
    if (t.includes("outgoing")) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200" data-testid="badge-call-outgoing"><PhoneOutgoing className="w-3 h-3 mr-1" />Outgoing</Badge>;
    if (t.includes("missed")) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200" data-testid="badge-call-missed"><PhoneMissed className="w-3 h-3 mr-1" />Missed</Badge>;
    return <Badge variant="outline" data-testid="badge-call-other">{type || "Unknown"}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100" data-testid="badge-status-matched"><UserCheck className="w-3 h-3 mr-1" />Matched</Badge>;
      case "auto_created": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100" data-testid="badge-status-auto-created"><Users className="w-3 h-3 mr-1" />Lead Created</Badge>;
      case "unmatched": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100" data-testid="badge-status-unmatched"><UserX className="w-3 h-3 mr-1" />Unmatched</Badge>;
      case "duplicate": return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100" data-testid="badge-status-duplicate">Duplicate</Badge>;
      case "skipped": return <Badge variant="secondary" data-testid="badge-status-skipped">Skipped</Badge>;
      case "processing": return <Badge variant="outline" data-testid="badge-status-processing">Processing</Badge>;
      default: return <Badge variant="outline" data-testid="badge-status-default">{status}</Badge>;
    }
  };

  const exportCsv = () => {
    const headers = ["Date/Time", "Client Number", "Employee", "CRM User", "Call Type", "Duration (sec)", "Status", "Matched Lead"];
    const rows = filteredLogs.map(l => [
      l.createdAt ? format(new Date(l.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
      l.clientNumber || "",
      l.employeeNumber || "",
      l.crmUserName || "",
      l.callType || "",
      l.callDuration || 0,
      l.processingStatus || "",
      l.leadName || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `callyzer-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="callyzer-reports-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: VIROC_BLUE }} data-testid="text-page-title">Callyzer Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">Call tracking analytics from Callyzer integration</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredLogs.length === 0} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-end" data-testid="filters-section">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" data-testid="input-date-from" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" data-testid="input-date-to" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Call Type</label>
            <Select value={callTypeFilter} onValueChange={setCallTypeFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-call-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Match Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="auto_created">Lead Created</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <Search className="absolute left-2.5 bottom-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Phone, name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 w-[180px]"
              data-testid="input-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3" data-testid="summary-cards">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Total Calls</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-total-calls">{summary.totalCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-sky-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneIncoming className="w-4 h-4 text-sky-500" />
                    <span className="text-xs text-muted-foreground">Incoming</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-incoming-calls">{summary.incomingCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneOutgoing className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Outgoing</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-outgoing-calls">{summary.outgoingCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneMissed className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Missed</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-missed-calls">{summary.missedCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Matched</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-matched-calls">{summary.matchedCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-400">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-muted-foreground">Leads Created</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-auto-created-calls">{summary.autoCreatedCalls}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Total Duration</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-total-duration">{formatDuration(summary.totalDuration)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-indigo-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs text-muted-foreground">Avg Duration</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-avg-duration">{formatDuration(summary.avgDuration)}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList data-testid="tabs-list">
                <TabsTrigger value="logs" data-testid="tab-call-logs"><Phone className="w-4 h-4 mr-1" />Call Logs</TabsTrigger>
                <TabsTrigger value="employees" data-testid="tab-employee-stats"><Users className="w-4 h-4 mr-1" />Employee Performance</TabsTrigger>
                <TabsTrigger value="team" data-testid="tab-telecalling-team"><Headphones className="w-4 h-4 mr-1" />Telecalling Team</TabsTrigger>
              </TabsList>

              <TabsContent value="logs" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Call Logs ({filteredLogs.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredLogs.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground" data-testid="empty-logs">
                        <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No call logs found</p>
                        <p className="text-sm mt-1">Call logs will appear here once Callyzer starts sending data via webhook.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[150px]">Date/Time</TableHead>
                              <TableHead>Client Number</TableHead>
                              <TableHead>Employee</TableHead>
                              <TableHead>CRM User</TableHead>
                              <TableHead>Call Type</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Matched Lead</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLogs.map((log: any) => (
                              <TableRow key={log.id} data-testid={`row-call-log-${log.id}`}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy HH:mm") : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-sm" data-testid={`text-client-number-${log.id}`}>
                                  {log.clientNumber || "—"}
                                </TableCell>
                                <TableCell className="text-sm">{log.employeeNumber || "—"}</TableCell>
                                <TableCell className="text-sm">{log.crmUserName || "—"}</TableCell>
                                <TableCell>{getCallTypeBadge(log.callType)}</TableCell>
                                <TableCell className="text-sm">{formatDurationShort(log.callDuration)}</TableCell>
                                <TableCell>{getStatusBadge(log.processingStatus)}</TableCell>
                                <TableCell className="text-sm">
                                  {log.leadName ? (
                                    <Link href={`/leads/${log.matchedLeadId}`} className="text-primary hover:underline" data-testid={`link-lead-${log.id}`}>
                                      {log.leadName}
                                    </Link>
                                  ) : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="employees" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Employee Call Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {employeeStats.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground" data-testid="empty-employees">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No employee data available</p>
                        <p className="text-sm mt-1">Employee performance stats appear once Callyzer sends call data.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead className="text-center">Total Calls</TableHead>
                              <TableHead className="text-center">Incoming</TableHead>
                              <TableHead className="text-center">Outgoing</TableHead>
                              <TableHead className="text-center">Missed</TableHead>
                              <TableHead className="text-center">Total Duration</TableHead>
                              <TableHead className="text-center">Avg Duration</TableHead>
                              <TableHead className="text-center">Matched Leads</TableHead>
                              <TableHead className="text-center">Match Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeStats.map((emp, idx) => (
                              <TableRow key={idx} data-testid={`row-employee-${idx}`}>
                                <TableCell className="font-medium" data-testid={`text-employee-name-${idx}`}>{emp.name}</TableCell>
                                <TableCell className="text-center font-semibold">{emp.total}</TableCell>
                                <TableCell className="text-center text-sky-600">{emp.incoming}</TableCell>
                                <TableCell className="text-center text-green-600">{emp.outgoing}</TableCell>
                                <TableCell className="text-center text-red-600">{emp.missed}</TableCell>
                                <TableCell className="text-center">{formatDuration(emp.totalDuration)}</TableCell>
                                <TableCell className="text-center">{formatDuration(emp.total > 0 ? Math.round(emp.totalDuration / emp.total) : 0)}</TableCell>
                                <TableCell className="text-center">{emp.matched}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={emp.total > 0 && (emp.matched / emp.total) > 0.5 ? "default" : "secondary"}>
                                    {emp.total > 0 ? Math.round((emp.matched / emp.total) * 100) : 0}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-4">
                <TelecallingTeamTab />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function TelecallingTeamTab() {
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/callyzer-employees"],
  });

  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
  });

  const mapMutation = useMutation({
    mutationFn: async ({ id, mappedCrmUserId }: { id: number; mappedCrmUserId: number | null }) => {
      await apiRequest("PATCH", `/api/callyzer-employees/${id}`, { mappedCrmUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/callyzer-employees"] });
      toast({ title: "Employee mapping updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/callyzer-employees/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/callyzer-employees"] });
      toast({ title: "Employee status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const activeCount = employees.filter(e => e.isActive).length;
  const mappedCount = employees.filter(e => e.mappedCrmUserId).length;
  const totalCallsAll = employees.reduce((s, e) => s + (e.totalCalls || 0), 0);
  const totalDurAll = employees.reduce((s, e) => s + (e.totalDurationSeconds || 0), 0);

  return (
    <div className="space-y-4" data-testid="telecalling-team-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Total Employees</div>
            <p className="text-xl font-bold" data-testid="text-total-employees">{employees.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Active</div>
            <p className="text-xl font-bold" data-testid="text-active-employees">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Mapped to CRM Users</div>
            <p className="text-xl font-bold" data-testid="text-mapped-employees">{mappedCount} / {employees.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Total Calls (All Time)</div>
            <p className="text-xl font-bold" data-testid="text-team-total-calls">{totalCallsAll.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Telecalling Employees from Callyzer
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Employees are auto-detected from Callyzer webhook data. Map them to CRM users to link call activities to the right team members.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground" data-testid="empty-team">
              <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No telecalling employees found</p>
              <p className="text-sm mt-1">Employees will appear here automatically once Callyzer starts sending call data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Emp Code</TableHead>
                    <TableHead className="text-center">Total Calls</TableHead>
                    <TableHead className="text-center">Incoming</TableHead>
                    <TableHead className="text-center">Outgoing</TableHead>
                    <TableHead className="text-center">Missed</TableHead>
                    <TableHead className="text-center">Total Duration</TableHead>
                    <TableHead>Last Call</TableHead>
                    <TableHead>Mapped CRM User</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp: any) => (
                    <TableRow key={emp.id} className={!emp.isActive ? "opacity-50" : ""} data-testid={`row-callyzer-emp-${emp.id}`}>
                      <TableCell className="font-medium" data-testid={`text-emp-name-${emp.id}`}>
                        {emp.empName || "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-emp-number-${emp.id}`}>
                        +{emp.empCountryCode || "91"} {emp.empNumber}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emp.empCode || "—"}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{emp.totalCalls || 0}</TableCell>
                      <TableCell className="text-center text-sky-600">{emp.totalIncoming || 0}</TableCell>
                      <TableCell className="text-center text-green-600">{emp.totalOutgoing || 0}</TableCell>
                      <TableCell className="text-center text-red-600">{emp.totalMissed || 0}</TableCell>
                      <TableCell className="text-center">{formatDuration(emp.totalDurationSeconds || 0)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {emp.lastCallAt ? format(new Date(emp.lastCallAt), "dd MMM yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={emp.mappedCrmUserId ? String(emp.mappedCrmUserId) : "none"}
                          onValueChange={(val) => {
                            mapMutation.mutate({
                              id: emp.id,
                              mappedCrmUserId: val === "none" ? null : Number(val),
                            });
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`select-map-crm-user-${emp.id}`}>
                            <SelectValue placeholder="Map to CRM User" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Unlink className="w-3 h-3" /> Not Mapped
                              </span>
                            </SelectItem>
                            {crmUsers.map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                <span className="flex items-center gap-1">
                                  <Link2 className="w-3 h-3" /> {u.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 ${emp.isActive ? "text-emerald-600" : "text-gray-400"}`}
                          onClick={() => toggleMutation.mutate({ id: emp.id, isActive: !emp.isActive })}
                          data-testid={`button-toggle-emp-${emp.id}`}
                        >
                          {emp.isActive ? (
                            <><ToggleRight className="w-5 h-5 mr-1" /> Active</>
                          ) : (
                            <><ToggleLeft className="w-5 h-5 mr-1" /> Inactive</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
