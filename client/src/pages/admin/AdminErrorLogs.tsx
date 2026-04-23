import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDateTime } from "@/lib/date-utils";
import {
  AlertTriangle, RefreshCw, Trash2, Eye, Filter, X,
  User, Globe, Clock, AlertCircle, ShieldAlert,
} from "lucide-react";

const STATUS_COLORS: Record<number, string> = {
  400: "bg-amber-100 text-amber-700",
  401: "bg-orange-100 text-orange-700",
  403: "bg-red-100 text-red-700",
  404: "bg-slate-100 text-slate-700",
  429: "bg-purple-100 text-purple-700",
  500: "bg-red-200 text-red-900",
};

function statusColor(code: number) {
  return STATUS_COLORS[code] || (code >= 500 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800");
}

export default function AdminErrorLogs() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/admin/error-logs", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "300");
      if (statusFilter !== "all") params.set("statusCode", statusFilter);
      const res = await fetch(`/api/admin/error-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load error logs");
      return res.json();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/error-logs"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
      toast({ title: "Error logs cleared" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const logs = (data?.logs || []).filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.userName?.toLowerCase().includes(s) ||
      l.userPhone?.includes(s) ||
      l.endpoint?.toLowerCase().includes(s) ||
      l.errorMessage?.toLowerCase().includes(s) ||
      l.roleCode?.toLowerCase().includes(s)
    );
  });

  const stats = {
    total: data?.total || 0,
    errors500: (data?.logs || []).filter(l => l.statusCode >= 500).length,
    forbidden: (data?.logs || []).filter(l => l.statusCode === 403).length,
    notFound: (data?.logs || []).filter(l => l.statusCode === 404).length,
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-error-logs-title">System Error Logs</h1>
              <p className="text-slate-500 mt-0.5 text-sm">Track all API errors — who triggered them, what operation, and why</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-logs">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { if (confirm("Clear all error logs?")) clearMutation.mutate(); }}
              disabled={clearMutation.isPending}
              data-testid="button-clear-logs">
              <Trash2 className="w-4 h-4 mr-1" /> Clear All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Errors", value: stats.total, icon: AlertTriangle, color: "text-slate-700" },
            { label: "Server Errors (5xx)", value: stats.errors500, icon: AlertCircle, color: "text-red-600" },
            { label: "Forbidden (403)", value: stats.forbidden, icon: ShieldAlert, color: "text-orange-600" },
            { label: "Not Found (404)", value: stats.notFound, icon: Globe, color: "text-slate-500" },
          ].map(s => (
            <Card key={s.label} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <s.icon className={`w-8 h-8 opacity-20 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filters
              </CardTitle>
              <div className="flex gap-2 flex-1 flex-wrap">
                <Input
                  placeholder="Search by user, endpoint, error..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs text-sm h-8"
                  data-testid="input-search-logs"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-status-filter">
                    <SelectValue placeholder="All status codes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status codes</SelectItem>
                    <SelectItem value="400">400 Bad Request</SelectItem>
                    <SelectItem value="401">401 Unauthorized</SelectItem>
                    <SelectItem value="403">403 Forbidden</SelectItem>
                    <SelectItem value="404">404 Not Found</SelectItem>
                    <SelectItem value="429">429 Rate Limited</SelectItem>
                    <SelectItem value="500">500 Server Error</SelectItem>
                  </SelectContent>
                </Select>
                {search && (
                  <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <span className="text-sm text-slate-500 ml-auto">{logs.length} entries</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No error logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Time</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Operation</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Error</th>
                      <th className="w-10 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors" data-testid={`row-error-log-${log.id}`}>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtDateTime(log.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs font-mono ${statusColor(log.statusCode)}`}>
                            {log.statusCode}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-medium text-slate-800">{log.userName || <span className="text-slate-400 italic">Guest</span>}</div>
                              {log.userPhone && <div className="text-xs text-slate-400">{log.userPhone}</div>}
                              {log.roleCode && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">{log.roleCode}</Badge>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {log.method} {log.endpoint}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                          {log.errorMessage}
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setSelected(log)}
                            data-testid={`button-view-log-${log.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge className={`font-mono ${statusColor(selected.statusCode)}`}>{selected.statusCode}</Badge>
                Error Detail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Timestamp</p>
                  <p>{fmtDateTime(selected.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">IP Address</p>
                  <p className="font-mono text-xs">{selected.ipAddress || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">User</p>
                  <p>{selected.userName || "Guest"}</p>
                  {selected.userPhone && <p className="text-xs text-slate-400">{selected.userPhone}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Role</p>
                  <p>{selected.roleCode || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Operation</p>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{selected.method} {selected.endpoint}</code>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Tenant ID</p>
                  <p>{selected.tenantId || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Error Message</p>
                <div className="bg-red-50 border border-red-100 rounded p-3 text-red-800 text-sm font-medium">
                  {selected.errorMessage}
                </div>
              </div>
              {selected.errorDetails && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Details / Root Cause</p>
                  <div className="bg-slate-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap text-slate-700">
                    {selected.errorDetails}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
