import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAppointments, useDoctors, useAppointmentAction } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { Calendar, Clock, User, Hash, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Stethoscope } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-700",
  "Rescheduled": "bg-amber-100 text-amber-700",
  "Consultation Done": "bg-green-100 text-green-700",
  "Cancelled": "bg-red-100 text-red-700",
  "No Show": "bg-orange-100 text-orange-700",
};

export default function AppointmentsPage() {
  const { toast } = useToast();
  const appointmentAction = useAppointmentAction();
  const { data: doctorsList } = useDoctors();

  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filters: Record<string, string> = {};
  if (filterDoctor && filterDoctor !== "all") filters.doctorId = filterDoctor;
  if (filterStatus && filterStatus !== "all") filters.status = filterStatus;
  if (filterDateFrom) filters.dateFrom = filterDateFrom;
  if (filterDateTo) filters.dateTo = filterDateTo;

  const { data: appointments, isLoading } = useAppointments(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  const [actionDialog, setActionDialog] = useState<{ type: string; appt: any } | null>(null);
  const [consultNotes, setConsultNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");

  const doctorMap = useMemo(() => {
    const map: Record<number, string> = {};
    doctorsList?.forEach((d: any) => { map[d.id] = d.name; });
    return map;
  }, [doctorsList]);

  const handleAction = (actionType: string) => {
    if (!actionDialog) return;
    const appt = actionDialog.appt;
    let data: any = {};

    if (actionType === "consultation-done") {
      data = { consultationNotes: consultNotes };
    } else if (actionType === "cancel") {
      data = { cancelReason };
    } else if (actionType === "reschedule") {
      if (!rescheduleDate) {
        toast({ title: "Date required", variant: "destructive" });
        return;
      }
      data = { appointmentDate: rescheduleDate, startTime: rescheduleSlot || undefined };
    } else if (actionType === "no-show") {
      data = {};
    }

    appointmentAction.mutate(
      { id: appt.id, action: actionType, data },
      {
        onSuccess: () => {
          toast({ title: `Appointment ${actionType.replace("-", " ")} successfully` });
          setActionDialog(null);
          setConsultNotes("");
          setCancelReason("");
          setRescheduleDate("");
          setRescheduleSlot("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-appointments-title">Appointments</h2>
            <p className="text-muted-foreground mt-1">Manage patient appointments and consultations.</p>
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Doctor</label>
                <Select value={filterDoctor} onValueChange={setFilterDoctor}>
                  <SelectTrigger data-testid="filter-doctor">
                    <SelectValue placeholder="All doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All doctors</SelectItem>
                    {doctorsList?.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                    <SelectItem value="Consultation Done">Consultation Done</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="No Show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} data-testid="filter-date-from" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} data-testid="filter-date-to" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilterDoctor(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); }}
                data-testid="button-clear-filters"
              >
                Clear
              </Button>
            </div>
          </Card>

          {isLoading ? (
            <LoadingSpinner text="Loading appointments..." />
          ) : !appointments || appointments.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No appointments found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt: any) => (
                <Card key={appt.id} className="p-4" data-testid={`card-appointment-${appt.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_COLORS[appt.status] || "bg-gray-100 text-gray-700"}>
                          {appt.status}
                        </Badge>
                        {appt.tokenNumber && (
                          <Badge variant="outline" className="gap-1">
                            <Hash className="w-3 h-3" />
                            Token {appt.tokenNumber}
                          </Badge>
                        )}
                        {appt.rescheduleCount > 0 && (
                          <Badge variant="outline" className="gap-1 text-amber-600">
                            <RotateCcw className="w-3 h-3" />
                            Rescheduled {appt.rescheduleCount}x
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Stethoscope className="w-4 h-4" />
                          {doctorMap[appt.doctorId] || `Doctor #${appt.doctorId}`}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(appt.appointmentDate), "MMM dd, yyyy")}
                        </span>
                        {appt.startTime && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {appt.startTime}{appt.endTime ? ` - ${appt.endTime}` : ""}
                          </span>
                        )}
                        {appt.leadId && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <User className="w-4 h-4" />
                            Lead #{appt.leadId}
                          </span>
                        )}
                      </div>
                      {appt.notes && <p className="text-xs text-muted-foreground">{appt.notes}</p>}
                      {appt.consultationNotes && <p className="text-xs text-green-600">Consultation: {appt.consultationNotes}</p>}
                      {appt.cancelReason && <p className="text-xs text-red-600">Cancelled: {appt.cancelReason}</p>}
                    </div>
                    {(appt.status === "Scheduled" || appt.status === "Rescheduled") && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setActionDialog({ type: "consultation-done", appt })}
                          data-testid={`button-consult-done-${appt.id}`}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setActionDialog({ type: "reschedule", appt })}
                          data-testid={`button-reschedule-${appt.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setActionDialog({ type: "no-show", appt })}
                          data-testid={`button-noshow-${appt.id}`}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          No Show
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-destructive"
                          onClick={() => setActionDialog({ type: "cancel", appt })}
                          data-testid={`button-cancel-${appt.id}`}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={actionDialog?.type === "consultation-done"} onOpenChange={(open) => !open && setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Consultation Done</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Consultation Notes</label>
                <Textarea
                  value={consultNotes}
                  onChange={(e) => setConsultNotes(e.target.value)}
                  placeholder="Enter consultation notes..."
                  rows={4}
                  data-testid="input-consult-notes"
                />
              </div>
              <Button
                onClick={() => handleAction("consultation-done")}
                className="w-full"
                disabled={appointmentAction.isPending}
                data-testid="button-confirm-consult-done"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Consultation Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={actionDialog?.type === "cancel"} onOpenChange={(open) => !open && setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason for cancellation</label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                  data-testid="input-cancel-reason"
                />
              </div>
              <Button
                onClick={() => handleAction("cancel")}
                variant="destructive"
                className="w-full"
                disabled={appointmentAction.isPending}
                data-testid="button-confirm-cancel"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Confirm Cancellation
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={actionDialog?.type === "reschedule"} onOpenChange={(open) => !open && setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reschedule Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">New Date</label>
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  data-testid="input-reschedule-date"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">New Time Slot (optional)</label>
                <Input
                  type="time"
                  value={rescheduleSlot}
                  onChange={(e) => setRescheduleSlot(e.target.value)}
                  data-testid="input-reschedule-time"
                />
              </div>
              <Button
                onClick={() => handleAction("reschedule")}
                className="w-full"
                disabled={appointmentAction.isPending || !rescheduleDate}
                data-testid="button-confirm-reschedule"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Reschedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={actionDialog?.type === "no-show"} onOpenChange={(open) => !open && setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as No Show</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to mark this appointment as No Show? This will update the appointment status.
              </p>
              <Button
                onClick={() => handleAction("no-show")}
                className="w-full"
                disabled={appointmentAction.isPending}
                data-testid="button-confirm-noshow"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Confirm No Show
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
