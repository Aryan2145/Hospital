import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDoctors, useAppointmentAction, useCreateAppointment, useDoctorAvailability } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isSameDay, isToday } from "date-fns";
import { useState, useMemo } from "react";
import { Calendar, Clock, User, Hash, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Stethoscope, Plus, Loader2, ChevronLeft, ChevronRight, Building, ListOrdered, CalendarDays, UserPlus, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-700",
  "Rescheduled": "bg-amber-100 text-amber-700",
  "Consultation Done": "bg-green-100 text-green-700",
  "Completed": "bg-green-100 text-green-700",
  "Cancelled": "bg-red-100 text-red-700",
  "No Show": "bg-orange-100 text-orange-700",
};

function useEnrichedAppointments(filters?: Record<string, string>) {
  const params = filters ? "?" + new URLSearchParams(filters).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/appointments-enriched", filters],
    queryFn: async () => {
      const res = await fetch(`/api/appointments-enriched${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });
}

function useBranches() {
  return useQuery<any[]>({
    queryKey: ["/api/masters/branches"],
    queryFn: async () => {
      const res = await fetch("/api/masters/branches", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });
}

export default function AppointmentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("schedule");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-appointments-title">Appointments</h2>
            <p className="text-muted-foreground mt-1">View and manage patient appointments.</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="schedule" className="gap-2" data-testid="tab-schedule">
                <ListOrdered className="w-4 h-4" />
                Doctor Schedule
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2" data-testid="tab-calendar">
                <CalendarDays className="w-4 h-4" />
                Calendar View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <DoctorScheduleView />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function DoctorScheduleView() {
  const { toast } = useToast();
  const { data: doctorsList } = useDoctors();
  const appointmentAction = useAppointmentAction();
  const createAppointment = useCreateAppointment();

  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const filters: Record<string, string> = {};
  if (selectedDoctor && selectedDoctor !== "all") filters.doctorId = selectedDoctor;
  if (selectedDate) {
    filters.dateFrom = selectedDate;
    filters.dateTo = selectedDate;
  }

  const { data: appointments, isLoading } = useEnrichedAppointments(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  const { data: leadsList } = useQuery<any[]>({ queryKey: ["/api/leads"] });
  const { data: patientsList } = useQuery<any[]>({ queryKey: ["/api/patients"] });
  const { data: appointmentTypes } = useQuery<any[]>({ queryKey: ["/api/masters/appointmentTypes"] });
  const { data: consultationTypesList } = useQuery<any[]>({ queryKey: ["/api/masters/consultationTypes"] });

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookDoctorId, setBookDoctorId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookSlot, setBookSlot] = useState("");
  const [bookLeadId, setBookLeadId] = useState("");
  const [bookPatientId, setBookPatientId] = useState("");
  const [bookApptTypeId, setBookApptTypeId] = useState("");
  const [bookNotes, setBookNotes] = useState("");
  const [bookMode, setBookMode] = useState<"existing" | "new">("new");

  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientAge, setNewPatientAge] = useState("");
  const [newPatientGender, setNewPatientGender] = useState("");
  const [newPatientConsultationType, setNewPatientConsultationType] = useState("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);

  const availability = useDoctorAvailability(
    bookDoctorId ? Number(bookDoctorId) : null,
    bookDate || null
  );

  const resetBookingForm = () => {
    setBookDoctorId("");
    setBookDate("");
    setBookSlot("");
    setBookManualTime("");
    setBookLeadId("");
    setBookPatientId("");
    setBookApptTypeId("");
    setBookNotes("");
    setBookMode("new");
    setNewPatientName("");
    setNewPatientPhone("");
    setNewPatientAge("");
    setNewPatientGender("");
    setNewPatientConsultationType("");
  };

  const [bookManualTime, setBookManualTime] = useState("");

  const effectiveStartTime = bookSlot || bookManualTime;

  function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (digits.startsWith("+")) return phone;
    return `+91${digits}`;
  }

  const handleBookAppointment = async () => {
    if (!bookDoctorId || !bookDate) {
      toast({ title: "Doctor and date are required", variant: "destructive" });
      return;
    }
    if (!effectiveStartTime) {
      toast({ title: "Appointment time is required", variant: "destructive" });
      return;
    }

    let leadId: number | null = null;

    if (bookMode === "new") {
      if (!newPatientName || !newPatientPhone) {
        toast({ title: "Patient name and phone are required", variant: "destructive" });
        return;
      }
      const phoneDigits = newPatientPhone.replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        toast({ title: "Please enter a valid 10-digit phone number", variant: "destructive" });
        return;
      }
      setIsCreatingLead(true);
      try {
        const leadRes = await apiRequest("POST", "/api/leads", {
          name: toTitleCase(newPatientName.trim()),
          phoneE164: normalizePhone(newPatientPhone.trim()),
          status: "Raw Lead Captured",
          doctorId: Number(bookDoctorId),
          consultationTypeId: newPatientConsultationType ? Number(newPatientConsultationType) : undefined,
          notes: [
            newPatientAge ? `Age: ${newPatientAge}` : "",
            newPatientGender ? `Gender: ${newPatientGender}` : "",
          ].filter(Boolean).join(", "),
        });
        const newLead = await leadRes.json();
        leadId = newLead.id;
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } catch (err: any) {
        setIsCreatingLead(false);
        toast({ title: "Failed to create lead", description: err.message, variant: "destructive" });
        return;
      }
      setIsCreatingLead(false);
    }

    const selectedSlot = availability.data?.slots?.find((s: any) => s.startTime === bookSlot);
    const data: any = {
      doctorId: Number(bookDoctorId),
      appointmentDate: bookDate,
      startTime: effectiveStartTime,
      status: "Scheduled",
    };
    if (selectedSlot?.endTime) data.endTime = selectedSlot.endTime;
    if (leadId) {
      data.leadId = leadId;
    } else if (bookLeadId && bookLeadId !== "none") {
      data.leadId = Number(bookLeadId);
    }
    if (bookPatientId && bookPatientId !== "none") data.patientId = Number(bookPatientId);
    if (bookApptTypeId && bookApptTypeId !== "none") data.appointmentTypeId = Number(bookApptTypeId);
    if (bookMode === "new" && newPatientConsultationType) data.consultationTypeId = Number(newPatientConsultationType);
    if (bookNotes) data.notes = bookNotes;

    createAppointment.mutate(data, {
      onSuccess: () => {
        toast({ title: "Appointment booked successfully" });
        setBookingOpen(false);
        resetBookingForm();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const [actionDialog, setActionDialog] = useState<{ type: string; appt: any } | null>(null);
  const [consultNotes, setConsultNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");

  const handleAction = (actionType: string) => {
    if (!actionDialog) return;
    const appt = actionDialog.appt;
    let data: any = {};
    if (actionType === "consultation-done") data = { consultationNotes: consultNotes };
    else if (actionType === "cancel") data = { cancelReason };
    else if (actionType === "reschedule") {
      if (!rescheduleDate) { toast({ title: "Date required", variant: "destructive" }); return; }
      data = { appointmentDate: rescheduleDate, startTime: rescheduleSlot || undefined };
    } else if (actionType === "no-show") data = {};

    appointmentAction.mutate(
      { id: appt.id, action: actionType, data },
      {
        onSuccess: () => {
          toast({ title: `Appointment ${actionType.replace("-", " ")} successfully` });
          setActionDialog(null);
          setConsultNotes(""); setCancelReason(""); setRescheduleDate(""); setRescheduleSlot("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const selectedDoctorName = useMemo(() => {
    if (!selectedDoctor || selectedDoctor === "all") return "All Doctors";
    return doctorsList?.find((d: any) => String(d.id) === selectedDoctor)?.name || "Doctor";
  }, [selectedDoctor, doctorsList]);

  const scheduledCount = appointments?.filter((a: any) => a.status === "Scheduled" || a.status === "Rescheduled").length || 0;
  const completedCount = appointments?.filter((a: any) => a.status === "Consultation Done" || a.status === "Completed").length || 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Doctor</label>
            <SearchableSelect
              value={selectedDoctor}
              onValueChange={setSelectedDoctor}
              options={[
                { value: "all", label: "All Doctors" },
                ...(doctorsList?.map((d: any) => ({ value: String(d.id), label: d.name })) || []),
              ]}
              placeholder="Select doctor"
              data-testid="schedule-filter-doctor"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-testid="schedule-filter-date"
            />
          </div>
          <Button onClick={() => setBookingOpen(true)} data-testid="button-book-new-appointment">
            <Plus className="w-4 h-4 mr-2" />
            Book Appointment
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="font-semibold">{selectedDoctorName}</span>
          <span className="text-muted-foreground">|</span>
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-semibold">{selectedDate ? format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d, yyyy") : "All Dates"}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Badge variant="outline" className="gap-1">{appointments?.length || 0} total</Badge>
          <Badge className="bg-blue-100 text-blue-700 gap-1">{scheduledCount} upcoming</Badge>
          <Badge className="bg-green-100 text-green-700 gap-1">{completedCount} done</Badge>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading schedule..." />
      ) : !appointments || appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No appointments found for the selected filters</p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Patient / Lead</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Doctor</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Branch</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Notes</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt: any, idx: number) => {
                const name = appt.patientName || appt.leadName || "—";
                const phone = appt.patientPhone || appt.leadPhone || "—";
                const isActive = appt.status === "Scheduled" || appt.status === "Rescheduled";
                return (
                  <tr key={appt.id} className={cn("border-b hover:bg-muted/30 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-muted/10")} data-testid={`row-appointment-${appt.id}`}>
                    <td className="p-3 text-muted-foreground">
                      {appt.tokenNumber ? <Badge variant="outline" className="text-xs gap-0.5"><Hash className="w-3 h-3" />{appt.tokenNumber}</Badge> : idx + 1}
                    </td>
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {appt.startTime || "—"}
                        {appt.endTime && <span className="text-muted-foreground">- {appt.endTime}</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{name}</div>
                      {appt.patientName && appt.leadName && (
                        <div className="text-xs text-muted-foreground">Lead: {appt.leadName}</div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{phone}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                        {appt.doctorName || `#${appt.doctorId}`}
                      </div>
                    </td>
                    <td className="p-3">
                      {appt.branchName ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building className="w-3 h-3 text-muted-foreground" />
                          {appt.branchName}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-xs", STATUS_COLORS[appt.status] || "bg-gray-100 text-gray-700")}>
                        {appt.status}
                      </Badge>
                      {appt.rescheduleCount > 0 && (
                        <Badge variant="outline" className="text-[10px] ml-1 gap-0.5 text-amber-600">
                          <RotateCcw className="w-2.5 h-2.5" />{appt.rescheduleCount}x
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 max-w-[150px] truncate text-xs text-muted-foreground" title={appt.notes || ""}>
                      {appt.notes || "—"}
                    </td>
                    <td className="p-3 text-right">
                      {isActive && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setActionDialog({ type: "consultation-done", appt })} data-testid={`button-consult-done-${appt.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />Done
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setActionDialog({ type: "reschedule", appt })} data-testid={`button-reschedule-${appt.id}`}>
                            <RotateCcw className="w-3 h-3 mr-1" />Reschedule
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setActionDialog({ type: "no-show", appt })} data-testid={`button-noshow-${appt.id}`}>
                            <AlertTriangle className="w-3 h-3 mr-1" />No Show
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-destructive" onClick={() => setActionDialog({ type: "cancel", appt })} data-testid={`button-cancel-${appt.id}`}>
                            <XCircle className="w-3 h-3 mr-1" />Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={actionDialog?.type === "consultation-done"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Consultation Done</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Consultation Notes</label>
              <Textarea value={consultNotes} onChange={(e) => setConsultNotes(e.target.value)} placeholder="Enter consultation notes..." rows={4} data-testid="input-consult-notes" />
            </div>
            <Button onClick={() => handleAction("consultation-done")} className="w-full" disabled={appointmentAction.isPending} data-testid="button-confirm-consult-done">
              <CheckCircle2 className="w-4 h-4 mr-2" />Confirm Consultation Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog?.type === "cancel"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason for cancellation</label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Enter reason..." rows={3} data-testid="input-cancel-reason" />
            </div>
            <Button onClick={() => handleAction("cancel")} variant="destructive" className="w-full" disabled={appointmentAction.isPending} data-testid="button-confirm-cancel">
              <XCircle className="w-4 h-4 mr-2" />Confirm Cancellation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog?.type === "reschedule"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">New Date</label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} data-testid="input-reschedule-date" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">New Time Slot (optional)</label>
              <Input type="time" value={rescheduleSlot} onChange={(e) => setRescheduleSlot(e.target.value)} data-testid="input-reschedule-time" />
            </div>
            <Button onClick={() => handleAction("reschedule")} className="w-full" disabled={appointmentAction.isPending || !rescheduleDate} data-testid="button-confirm-reschedule">
              <RotateCcw className="w-4 h-4 mr-2" />Confirm Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog?.type === "no-show"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as No Show</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Are you sure you want to mark this appointment as No Show?</p>
            <Button onClick={() => handleAction("no-show")} className="w-full" disabled={appointmentAction.isPending} data-testid="button-confirm-noshow">
              <AlertTriangle className="w-4 h-4 mr-2" />Confirm No Show
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingOpen} onOpenChange={(open) => { if (!open) { setBookingOpen(false); resetBookingForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Book New Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
              <Button
                variant={bookMode === "new" ? "default" : "ghost"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setBookMode("new")}
                data-testid="book-mode-new"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                New Patient
              </Button>
              <Button
                variant={bookMode === "existing" ? "default" : "ghost"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setBookMode("existing")}
                data-testid="book-mode-existing"
              >
                <User className="w-3.5 h-3.5 mr-1.5" />
                Existing Lead / Follow-up
              </Button>
            </div>

            {bookMode === "new" && (
              <div className="space-y-3 p-3 border rounded-lg bg-blue-50/30">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  New Patient Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Patient Name *</Label>
                    <Input
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                      placeholder="Full name"
                      data-testid="book-input-patient-name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Phone Number *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-medium">+91</span>
                      <Input
                        value={newPatientPhone}
                        onChange={(e) => setNewPatientPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        maxLength={10}
                        data-testid="book-input-patient-phone"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Age</Label>
                    <Input
                      type="number"
                      value={newPatientAge}
                      onChange={(e) => setNewPatientAge(e.target.value)}
                      placeholder="Years"
                      min="0"
                      max="120"
                      data-testid="book-input-patient-age"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Gender</Label>
                    <SearchableSelect
                      value={newPatientGender}
                      onValueChange={setNewPatientGender}
                      options={[
                        { value: "", label: "Select" },
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Other", label: "Other" },
                      ]}
                      placeholder="Select"
                      data-testid="book-select-patient-gender"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Consultation Type</Label>
                    <SearchableSelect
                      value={newPatientConsultationType}
                      onValueChange={setNewPatientConsultationType}
                      options={[
                        { value: "", label: "None" },
                        ...(consultationTypesList?.filter((t: any) => t.status === "Active").map((t: any) => ({ value: String(t.id), label: t.name })) || []),
                      ]}
                      placeholder="Select consultation type"
                      data-testid="book-select-consultation-type"
                    />
                  </div>
                </div>
              </div>
            )}

            {bookMode === "existing" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Link to Lead (for follow-up)</Label>
                  <SearchableSelect
                    value={bookLeadId}
                    onValueChange={setBookLeadId}
                    options={[
                      { value: "none", label: "No lead" },
                      ...(leadsList?.map((l: any) => ({ value: String(l.id), label: `${l.name}${l.phone ? ` (${l.phone})` : ""}` })) || []),
                    ]}
                    placeholder="Search lead by name or phone..."
                    data-testid="book-select-lead"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Link to Patient (optional)</Label>
                  <SearchableSelect
                    value={bookPatientId}
                    onValueChange={setBookPatientId}
                    options={[
                      { value: "none", label: "No patient" },
                      ...(patientsList?.map((p: any) => ({ value: String(p.id), label: `${p.firstName} ${p.lastName}${p.phone ? ` (${p.phone})` : ""}` })) || []),
                    ]}
                    placeholder="Search patient..."
                    data-testid="book-select-patient"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Doctor *</Label>
              <SearchableSelect
                value={bookDoctorId}
                onValueChange={(v) => { setBookDoctorId(v); setBookSlot(""); }}
                options={doctorsList?.map((d: any) => ({ value: String(d.id), label: d.name })) || []}
                placeholder="Select doctor"
                data-testid="book-select-doctor"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Date *</Label>
              <Input type="date" value={bookDate} onChange={(e) => { setBookDate(e.target.value); setBookSlot(""); }} min={new Date().toISOString().split("T")[0]} data-testid="book-input-date" />
            </div>
            {bookDoctorId && bookDate && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Appointment Time *</Label>
                {availability.isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Loading available slots...</p>
                ) : availability.data && !availability.data.available ? (
                  <p className="text-xs text-destructive mt-1">{availability.data.reason || "Doctor not available on this date"}</p>
                ) : availability.data && availability.data.slots.length > 0 ? (
                  <div className="space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      {availability.data.slots.map((slot: any) => (
                        <Button key={slot.startTime} variant={bookSlot === slot.startTime ? "default" : "outline"} size="sm" className="text-xs" disabled={slot.availableCount <= 0} onClick={() => { setBookSlot(slot.startTime); setBookManualTime(""); }} data-testid={`book-slot-${slot.startTime}`}>
                          <Clock className="w-3 h-3 mr-1" />{slot.startTime} - {slot.endTime}
                          <Badge variant="outline" className="ml-1 text-[10px]">{slot.availableCount} left</Badge>
                        </Button>
                      ))}
                    </div>
                    {!bookSlot && (
                      <div>
                        <p className="text-xs text-muted-foreground">Or enter time manually:</p>
                        <Input type="time" value={bookManualTime} onChange={(e) => setBookManualTime(e.target.value)} className="mt-1" data-testid="book-input-time-manual" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mt-1">{availability.data?.slots.length === 0 ? "No OPD slots configured for this day." : ""} Enter time:</p>
                    <Input type="time" value={bookManualTime} onChange={(e) => setBookManualTime(e.target.value)} className="mt-1" data-testid="book-input-time-manual" />
                  </div>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Appointment Type (optional)</Label>
              <SearchableSelect
                value={bookApptTypeId}
                onValueChange={setBookApptTypeId}
                options={[
                  { value: "none", label: "None" },
                  ...(appointmentTypes?.filter((t: any) => t.status === "Active").map((t: any) => ({ value: String(t.id), label: t.name })) || []),
                ]}
                placeholder="Select type (optional)"
                data-testid="book-select-type"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
              <Textarea value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} placeholder="Appointment notes..." rows={2} data-testid="book-input-notes" />
            </div>
            <Button
              onClick={handleBookAppointment}
              className="w-full"
              disabled={createAppointment.isPending || isCreatingLead || !bookDoctorId || !bookDate || !effectiveStartTime || (bookMode === "new" && (!newPatientName || !newPatientPhone))}
              data-testid="button-confirm-book"
            >
              {(createAppointment.isPending || isCreatingLead) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              {bookMode === "new" ? "Create Lead & Book Appointment" : "Book Appointment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarView() {
  const { data: branchesList } = useBranches();
  const { data: doctorsList } = useDoctors();
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState("all");

  const dateRange = useMemo(() => {
    if (calendarMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
        dateFrom: format(monthStart, "yyyy-MM-dd"),
        dateTo: format(monthEnd, "yyyy-MM-dd"),
      };
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        start: weekStart,
        end: weekEnd,
        dateFrom: format(weekStart, "yyyy-MM-dd"),
        dateTo: format(weekEnd, "yyyy-MM-dd"),
      };
    }
  }, [calendarMode, currentDate]);

  const filters: Record<string, string> = {
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  };
  if (selectedBranch && selectedBranch !== "all") filters.branchId = selectedBranch;

  const { data: appointments, isLoading } = useEnrichedAppointments(filters);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    appointments?.forEach((appt: any) => {
      const dateKey = format(new Date(appt.appointmentDate), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(appt);
    });
    return map;
  }, [appointments]);

  const branchColors: Record<string, string> = useMemo(() => {
    const palette = [
      "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
      "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-indigo-500",
    ];
    const map: Record<string, string> = {};
    branchesList?.forEach((b: any, i: number) => {
      map[String(b.id)] = palette[i % palette.length];
    });
    return map;
  }, [branchesList]);

  const navigate = (direction: number) => {
    if (calendarMode === "month") {
      setCurrentDate(direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(direction > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    }
  };

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selectedDayAppts = selectedDay ? appointmentsByDate[selectedDay] || [] : [];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} data-testid="calendar-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[200px] text-center" data-testid="calendar-title">
              {calendarMode === "month"
                ? format(currentDate, "MMMM yyyy")
                : `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`}
            </h3>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} data-testid="calendar-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="calendar-today">
              Today
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-muted rounded-md p-0.5">
              <Button variant={calendarMode === "month" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setCalendarMode("month")} data-testid="calendar-mode-month">
                Month
              </Button>
              <Button variant={calendarMode === "week" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setCalendarMode("week")} data-testid="calendar-mode-week">
                Week
              </Button>
            </div>
            <div className="min-w-[180px]">
              <SearchableSelect
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                options={[
                  { value: "all", label: "All Branches" },
                  ...(branchesList?.filter((b: any) => b.status === "Active").map((b: any) => ({ value: String(b.id), label: b.name })) || []),
                ]}
                placeholder="All branches"
                triggerClassName="h-8 text-xs"
                data-testid="calendar-filter-branch"
              />
            </div>
          </div>
        </div>
      </Card>

      {branchesList && branchesList.length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground font-medium">Branches:</span>
          {branchesList.filter((b: any) => b.status === "Active").map((b: any) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm", branchColors[String(b.id)] || "bg-gray-400")} />
              <span>{b.name}</span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner text="Loading calendar..." />
      ) : (
        <Card className="overflow-hidden">
          <div className={cn("grid grid-cols-7", calendarMode === "week" ? "" : "")}>
            {dayNames.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-r last:border-r-0">
                {day}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayAppts = appointmentsByDate[dateKey] || [];
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const isSelected = selectedDay === dateKey;

              const branchCounts: Record<string, number> = {};
              dayAppts.forEach((appt: any) => {
                const bId = String(appt.branchId || "none");
                branchCounts[bId] = (branchCounts[bId] || 0) + 1;
              });

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "border-b border-r last:border-r-0 p-2 cursor-pointer transition-colors",
                    calendarMode === "month" ? "min-h-[100px]" : "min-h-[160px]",
                    !inMonth && calendarMode === "month" && "bg-muted/30 text-muted-foreground",
                    today && "ring-2 ring-primary ring-inset",
                    isSelected && "bg-primary/5",
                    "hover:bg-muted/40"
                  )}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  data-testid={`calendar-day-${dateKey}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      today && "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-xs"
                    )}>
                      {format(day, "d")}
                    </span>
                    {dayAppts.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{dayAppts.length}</Badge>
                    )}
                  </div>

                  {dayAppts.length > 0 && (
                    <div className="space-y-0.5">
                      {Object.entries(branchCounts).map(([branchId, count]) => {
                        const branchName = branchesList?.find((b: any) => String(b.id) === branchId)?.name || "Unassigned";
                        return (
                          <div key={branchId} className="flex items-center gap-1 text-[10px]">
                            <div className={cn("w-2 h-2 rounded-sm flex-shrink-0", branchColors[branchId] || "bg-gray-400")} />
                            <span className="truncate">{branchName}</span>
                            <span className="font-semibold ml-auto">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {selectedDay && (
        <Card className="p-4" data-testid="calendar-day-detail">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMMM d, yyyy")}
              <Badge variant="outline">{selectedDayAppts.length} appointments</Badge>
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          {selectedDayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments on this day.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Time</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Patient / Lead</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Doctor</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Branch</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayAppts.map((appt: any) => (
                    <tr key={appt.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="p-2">
                        <span className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3 text-primary" />
                          {appt.startTime || "—"}{appt.endTime ? ` - ${appt.endTime}` : ""}
                        </span>
                      </td>
                      <td className="p-2 font-medium text-xs">{appt.patientName || appt.leadName || "—"}</td>
                      <td className="p-2 text-xs">{appt.doctorName || "—"}</td>
                      <td className="p-2">
                        {appt.branchName ? (
                          <div className="flex items-center gap-1 text-xs">
                            <div className={cn("w-2 h-2 rounded-sm", branchColors[String(appt.branchId)] || "bg-gray-400")} />
                            {appt.branchName}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">
                        <Badge className={cn("text-[10px]", STATUS_COLORS[appt.status] || "bg-gray-100 text-gray-700")}>{appt.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
