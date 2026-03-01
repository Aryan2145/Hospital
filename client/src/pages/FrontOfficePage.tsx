import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useDoctors } from "@/hooks/use-leads";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  UserCheck,
  UserX,
  Search,
  Clock,
  Phone,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Stethoscope,
} from "lucide-react";

function useTodayAppointments(doctorId: string, dateStr: string) {
  return useQuery<any[]>({
    queryKey: ["/api/appointments-enriched", { doctorId, dateFrom: dateStr, dateTo: dateStr }],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: dateStr, dateTo: dateStr });
      if (doctorId) params.set("doctorId", doctorId);
      const res = await fetch(`/api/appointments-enriched?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export default function FrontOfficePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data: doctorsList = [] } = useDoctors();
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: appointments = [], isLoading, refetch } = useTodayAppointments(selectedDoctor, selectedDate);

  const activeDoctors = (doctorsList as any[]).filter((d: any) => d.status === "Active");

  const checkIn = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appointments/${id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Patient checked in", description: data.patientId ? "Patient record created/linked" : "" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
    },
    onError: (err: Error) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  const markNoShow = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appointments/${id}/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as No Show" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = appointments.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = (a.patientName || a.leadName || "").toLowerCase();
    const phone = (a.patientPhone || a.leadPhone || "").toLowerCase();
    return name.includes(s) || phone.includes(s);
  });

  const statusOrder: Record<string, number> = {
    "Scheduled": 0,
    "Checked In": 1,
    "Done": 2,
    "No Show": 3,
    "Cancelled": 4,
  };

  const sorted = [...filtered].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 99;
    const sb = statusOrder[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.tokenNumber || 0) - (b.tokenNumber || 0);
  });

  const counts = {
    total: appointments.length,
    scheduled: appointments.filter((a: any) => a.status === "Scheduled").length,
    checkedIn: appointments.filter((a: any) => a.status === "Checked In").length,
    done: appointments.filter((a: any) => a.status === "Done").length,
    noShow: appointments.filter((a: any) => a.status === "No Show").length,
    cancelled: appointments.filter((a: any) => a.status === "Cancelled").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Scheduled":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Scheduled</Badge>;
      case "Checked In":
        return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Checked In</Badge>;
      case "Done":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">Done</Badge>;
      case "No Show":
        return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">No Show</Badge>;
      case "Cancelled":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-[10px]">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">Front Office</h1>
            <p className="text-sm text-muted-foreground">
              {isToday ? "Today's" : format(new Date(selectedDate + "T00:00:00"), "MMM d, yyyy")} appointments — Check-in patients as they arrive
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3 text-center" data-testid="card-total">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold">{counts.total}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center border-blue-200" data-testid="card-scheduled">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{counts.scheduled}</span>
            </div>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </Card>
          <Card className="p-3 text-center border-green-200" data-testid="card-checked-in">
            <div className="flex items-center justify-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{counts.checkedIn}</span>
            </div>
            <p className="text-xs text-muted-foreground">Checked In</p>
          </Card>
          <Card className="p-3 text-center border-emerald-200" data-testid="card-done">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-700">{counts.done}</span>
            </div>
            <p className="text-xs text-muted-foreground">Done</p>
          </Card>
          <Card className="p-3 text-center border-red-200" data-testid="card-no-show">
            <div className="flex items-center justify-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-600" />
              <span className="text-2xl font-bold text-red-700">{counts.noShow}</span>
            </div>
            <p className="text-xs text-muted-foreground">No Show</p>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search"
            />
          </div>
          <div className="w-full sm:w-52">
            <SearchableSelect
              value={selectedDoctor}
              onValueChange={setSelectedDoctor}
              options={[
                { value: "", label: "All Doctors" },
                ...activeDoctors.map((d: any) => ({ value: String(d.id), label: d.name })),
              ]}
              placeholder="All Doctors"
              data-testid="select-doctor"
            />
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-40 h-9"
            data-testid="input-date"
          />
        </div>

        <div className="rounded-lg border bg-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Token</TableHead>
                <TableHead className="w-20">Time</TableHead>
                <TableHead>Patient / Lead</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14">Checked In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    Loading appointments...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No appointments found for {isToday ? "today" : format(new Date(selectedDate + "T00:00:00"), "MMM d, yyyy")}.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((appt: any) => (
                  <TableRow
                    key={appt.id}
                    className={cn(
                      "transition-colors",
                      appt.status === "Checked In" && "bg-green-50/50",
                      appt.status === "No Show" && "bg-red-50/30",
                      appt.status === "Done" && "bg-emerald-50/30",
                      appt.status === "Cancelled" && "opacity-50"
                    )}
                    data-testid={`row-appt-${appt.id}`}
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-semibold" data-testid={`text-token-${appt.id}`}>
                        {appt.tokenNumber || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" data-testid={`text-time-${appt.id}`}>
                        {appt.startTime || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span
                          className="font-medium text-sm cursor-pointer hover:text-primary hover:underline"
                          onClick={() => appt.leadId && navigate(`/leads/${appt.leadId}`)}
                          data-testid={`text-name-${appt.id}`}
                        >
                          {appt.patientName || appt.leadName || "Unknown"}
                        </span>
                        {appt.patientId && (
                          <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">Patient</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span data-testid={`text-phone-${appt.id}`}>{appt.patientPhone || appt.leadPhone || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Stethoscope className="w-3 h-3 text-primary" />
                        <span data-testid={`text-doctor-${appt.id}`}>{appt.doctorName || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground" data-testid={`text-branch-${appt.id}`}>
                        {appt.branchName || "—"}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`badge-status-${appt.id}`}>
                      {getStatusBadge(appt.status)}
                    </TableCell>
                    <TableCell>
                      {appt.checkedInAt ? (
                        <span className="text-[10px] text-green-700" data-testid={`text-checkin-time-${appt.id}`}>
                          {format(new Date(appt.checkedInAt), "h:mm a")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {appt.status === "Scheduled" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              onClick={() => checkIn.mutate(appt.id)}
                              disabled={checkIn.isPending}
                              data-testid={`button-checkin-${appt.id}`}
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              Check In
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                              onClick={() => markNoShow.mutate(appt.id)}
                              disabled={markNoShow.isPending}
                              data-testid={`button-noshow-${appt.id}`}
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              No Show
                            </Button>
                          </>
                        )}
                        {appt.status === "Checked In" && (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Waiting for Doctor
                          </Badge>
                        )}
                        {appt.status === "Done" && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
