import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, XCircle, Calendar, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

type MessageType = "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER_24HR" | "APPOINTMENT_REMINDER_2HR";
type StatusType = "SENT" | "FAILED" | "PENDING";

interface WhatsAppLog {
  id: number;
  tenant_id: number;
  appointment_id: number | null;
  patient_id: number | null;
  mobile_number: string | null;
  template_name: string | null;
  message_type: MessageType;
  status: StatusType;
  wati_response: string | null;
  wati_local_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  appointment_date: string | null;
  lead_id: number | null;
}

interface LogsResponse {
  logs: WhatsAppLog[];
  total: number;
  page: number;
  limit: number;
  summary: {
    sent_today: string;
    failed_today: string;
    sent_this_month: string;
  };
}

const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  APPOINTMENT_CONFIRMATION: "Booking Confirmation",
  APPOINTMENT_REMINDER_24HR: "24h Reminder",
  APPOINTMENT_REMINDER_2HR: "2h Reminder",
};

function StatusBadge({ status }: { status: StatusType }) {
  if (status === "SENT") {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Sent</Badge>;
  }
  if (status === "FAILED") {
    return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return "—";
  try {
    return format(new Date(dt), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

export default function WhatsAppLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [messageType, setMessageType] = useState("all");
  const [status, setStatus] = useState("all");
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const queryParams = new URLSearchParams({ page: String(page), limit: "25" });
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (messageType !== "all") queryParams.set("messageType", messageType);
  if (status !== "all") queryParams.set("status", status);

  const { data, isLoading, isFetching } = useQuery<LogsResponse>({
    queryKey: [`/api/whatsapp-message-logs?${queryParams.toString()}`],
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await apiRequest("POST", `/api/whatsapp-message-logs/${logId}/retry`);
      return res.json();
    },
    onSuccess: (result, logId) => {
      setRetryingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-message-logs"] });
      if (result.success) {
        toast({ title: "Message resent successfully" });
      } else {
        toast({ title: "Retry failed", description: result.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      setRetryingId(null);
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });

  function handleRetry(logId: number) {
    setRetryingId(logId);
    retryMutation.mutate(logId);
  }

  function handleFilterChange() {
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / 25) : 1;
  const summary = data?.summary;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Message Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track all WhatsApp messages sent through WATI</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sent Today</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {summary ? parseInt(summary.sent_today) : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-red-50">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed Today</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {summary ? parseInt(summary.failed_today) : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-50">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sent This Month</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {summary ? parseInt(summary.sent_this_month) : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
                  className="w-36 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
                  className="w-36 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Message Type</label>
                <Select value={messageType} onValueChange={(v) => { setMessageType(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="APPOINTMENT_CONFIRMATION">Booking Confirmation</SelectItem>
                    <SelectItem value="APPOINTMENT_REMINDER_24HR">24h Reminder</SelectItem>
                    <SelectItem value="APPOINTMENT_REMINDER_2HR">2h Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Status</label>
                <Select value={status} onValueChange={(v) => { setStatus(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-32 h-8 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(dateFrom || dateTo || messageType !== "all" || status !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setMessageType("all");
                    setStatus("all");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Message History
              {data && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({data.total.toLocaleString()} total)
                </span>
              )}
              {isFetching && !isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data?.logs.length ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No messages found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-medium">Date & Time</TableHead>
                      <TableHead className="text-xs font-medium">Patient</TableHead>
                      <TableHead className="text-xs font-medium">Phone</TableHead>
                      <TableHead className="text-xs font-medium">Type</TableHead>
                      <TableHead className="text-xs font-medium">Template</TableHead>
                      <TableHead className="text-xs font-medium">Status</TableHead>
                      <TableHead className="text-xs font-medium">Error</TableHead>
                      <TableHead className="text-xs font-medium w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {log.patient_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">
                          {log.mobile_number || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                          {MESSAGE_TYPE_LABELS[log.message_type] || log.message_type}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[120px] truncate" title={log.template_name || undefined}>
                          {log.template_name || <span className="italic text-slate-400">session</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[200px]">
                          {log.status === "FAILED" && log.error_message ? (
                            <span className="truncate block" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {log.status === "FAILED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                disabled={retryingId === log.id}
                                onClick={() => handleRetry(log.id)}
                              >
                                {retryingId === log.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            {log.appointment_id && (
                              <Link href={`/appointments?id=${log.appointment_id}`}>
                                <Button size="sm" variant="ghost" className="h-6 px-1.5">
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.total > 25 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-xs">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
