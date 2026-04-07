import { AppLayout } from "@/components/layout/AppLayout";
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
import { fmtDate, fmtDayMonthYear, fmtMonthYear, formatDateIn } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { Calendar, Clock, User, Hash, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Stethoscope, Plus, Loader2, ChevronLeft, ChevronRight, Building, ListOrdered, CalendarDays, UserPlus, Phone, Search, ChevronDown, ChevronUp, Users, Filter, FileText, LinkIcon, ExternalLink, CalendarCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-700",
  "Rescheduled": "bg-amber-100 text-amber-700",
  "Checked In": "bg-teal-100 text-teal-700",
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

interface LeaveRecord {
  id: number;
  doctorId: number;
  doctorName: string;
  leaveDate: string;
  leaveEndDate: string | null;
  reason: string | null;
  status: string;
}

function useDoctorLeaves(doctorId?: string) {
  const url = doctorId && doctorId !== "all"
    ? `/api/doctor-leaves?doctorId=${doctorId}`
    : "/api/doctor-leaves";
  return useQuery<LeaveRecord[]>({
    queryKey: [url],
  });
}

export default function AppointmentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("schedule");
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [slotCallback, setSlotCallback] = useState<{ fn: ((doctor: string, date: string, time: string) => void) | null }>({ fn: null });

  const openAvailabilityForBooking = (callback: (doctor: string, date: string, time: string) => void) => {
    setSlotCallback({ fn: callback });
    setAvailabilityOpen(true);
  };

  const handleSlotSelected = (doctorId: string, date: string, time: string) => {
    if (slotCallback.fn) {
      slotCallback.fn(doctorId, date, time);
      setSlotCallback({ fn: null });
    }
    setAvailabilityOpen(false);
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-appointments-title">Appointments</h2>
              <p className="text-muted-foreground mt-1">View and manage patient appointments.</p>
            </div>
            <Button variant="outline" onClick={() => { setSlotCallback({ fn: null }); setAvailabilityOpen(true); }} data-testid="button-availability-calendar" className="gap-2">
              <CalendarCheck className="w-4 h-4" />
              Availability Calendar
            </Button>
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
              <DoctorScheduleView onOpenAvailability={openAvailabilityForBooking} />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AvailabilityCalendarModal
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        selectMode={!!slotCallback.fn}
        onSlotSelected={handleSlotSelected}
      />
    </AppLayout>
  );
}

function DoctorScheduleView({ onOpenAvailability }: { onOpenAvailability: (cb: (doctor: string, date: string, time: string) => void) => void }) {
  const { toast } = useToast();
  const { data: doctorsList } = useDoctors();
  const appointmentAction = useAppointmentAction();
  const createAppointment = useCreateAppointment();

  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedDoctors, setCollapsedDoctors] = useState<Set<string>>(new Set());

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
  const { data: branchesListSchedule } = useBranches();
  const activeBranches = (branchesListSchedule || []).filter((b: any) => b.status === "Active");
  const defaultBranchId = activeBranches.length > 0 ? String(activeBranches[0].id) : "";
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookDoctorId, setBookDoctorId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookSlot, setBookSlot] = useState("");
  const [bookLeadId, setBookLeadId] = useState("");
  const [bookPatientId, setBookPatientId] = useState("");
  const [bookApptTypeId, setBookApptTypeId] = useState("");
  const [bookServiceLocation, setBookServiceLocation] = useState("At Hospital");
  const [bookServiceAddress, setBookServiceAddress] = useState("");
  const [bookBranchId, setBookBranchId] = useState("");
  const [bookEpisodeId, setBookEpisodeId] = useState("");
  const [bookNotes, setBookNotes] = useState("");
  const [bookMode, setBookMode] = useState<"existing" | "new">("existing");

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
    setBookServiceLocation("At Hospital");
    setBookServiceAddress("");
    setBookBranchId("");
    setBookEpisodeId("");
    setBookNotes("");
    setBookMode("existing");
    setNewPatientName("");
    setNewPatientPhone("");
    setNewPatientAge("");
    setNewPatientGender("");
    setNewPatientConsultationType("");
  };

  const selectedLeadForEpisodes = bookMode === "existing" && bookLeadId && bookLeadId !== "none" ? bookLeadId : null;
  const { data: episodesList } = useQuery<any[]>({
    queryKey: ["/api/episodes", { leadId: selectedLeadForEpisodes }],
    queryFn: async () => {
      const res = await fetch(`/api/episodes?leadId=${selectedLeadForEpisodes}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedLeadForEpisodes,
  });

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
          status: "Qualified",
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
    if (bookServiceLocation) data.serviceLocation = bookServiceLocation;
    if (bookServiceLocation === "Home Visit" && bookServiceAddress) data.serviceAddress = bookServiceAddress;
    const effectiveBranchId = bookBranchId && bookBranchId !== "none" ? bookBranchId : defaultBranchId;
    if (effectiveBranchId) data.branchId = Number(effectiveBranchId);
    if (bookEpisodeId && bookEpisodeId !== "none") data.episodeId = Number(bookEpisodeId);
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
  const [rescheduleReason, setRescheduleReason] = useState("");

  const [checkInPending, setCheckInPending] = useState(false);
  const [episodePrompt, setEpisodePrompt] = useState<{ appt: any } | null>(null);
  const [episodeCreateMode, setEpisodeCreateMode] = useState(false);
  const [newEpisodeNotes, setNewEpisodeNotes] = useState("");
  const [newEpisodeTreatmentDeptId, setNewEpisodeTreatmentDeptId] = useState("");
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);
  const [isLinkingEpisode, setIsLinkingEpisode] = useState(false);

  const episodePromptPatientId = episodePrompt?.appt?.patientId || null;
  const episodePromptLeadId = episodePrompt?.appt?.leadId || null;
  const { data: patientEpisodes, isLoading: episodesLoading } = useQuery<any[]>({
    queryKey: ["/api/episodes", { patientId: episodePromptPatientId, leadId: episodePromptLeadId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (episodePromptLeadId) params.set("leadId", String(episodePromptLeadId));
      const res = await fetch(`/api/episodes?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!episodePrompt,
  });

  const { data: treatmentDeptsList } = useQuery<any[]>({
    queryKey: ["/api/masters/treatmentDepartments"],
    enabled: !!episodePrompt,
  });


  const handleCheckIn = async (apptId: number) => {
    setCheckInPending(true);
    const appt = actionDialog?.appt;
    try {
      await apiRequest("POST", `/api/appointments/${apptId}/check-in`);
      toast({ title: "Patient checked in successfully" });
      setActionDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (appt && !appt.episodeId) {
        setEpisodePrompt({ appt: { ...appt, id: apptId } });
        setEpisodeSearchQuery("");
        setEpisodeCreateMode(false);
        setNewEpisodeNotes("");
        setNewEpisodeTreatmentDeptId("");
      }
    } catch (err: any) {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    } finally {
      setCheckInPending(false);
    }
  };

  const handleLinkEpisode = async (episodeId: number) => {
    if (!episodePrompt) return;
    setIsLinkingEpisode(true);
    try {
      await apiRequest("PATCH", `/api/appointments/${episodePrompt.appt.id}`, {
        episodeId,
      });
      toast({ title: "Appointment linked to episode" });
      setEpisodePrompt(null);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
    } catch (err: any) {
      toast({ title: "Failed to link episode", description: err.message, variant: "destructive" });
    } finally {
      setIsLinkingEpisode(false);
    }
  };

  const handleCreateAndLinkEpisode = async () => {
    if (!episodePrompt) return;
    const appt = episodePrompt.appt;
    setIsCreatingEpisode(true);
    try {
      const body: any = {
        leadId: appt.leadId ? Number(appt.leadId) : undefined,
        patientId: appt.patientId ? Number(appt.patientId) : undefined,
        doctorId: appt.doctorId ? Number(appt.doctorId) : undefined,
        branchId: appt.branchId ? Number(appt.branchId) : undefined,
        status: "Consultation In Progress",
        notes: newEpisodeNotes || undefined,
      };
      if (newEpisodeTreatmentDeptId) body.treatmentDepartmentId = Number(newEpisodeTreatmentDeptId);
      const res = await apiRequest("POST", "/api/episodes", body);
      const newEpisode = await res.json();
      await apiRequest("PATCH", `/api/appointments/${appt.id}`, {
        episodeId: newEpisode.id,
      });
      toast({ title: "Episode created and linked to appointment" });
      setEpisodePrompt(null);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    } catch (err: any) {
      toast({ title: "Failed to create episode", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingEpisode(false);
    }
  };

  const handleAction = (actionType: string) => {
    if (!actionDialog) return;
    const appt = actionDialog.appt;
    let data: any = {};
    if (actionType === "consultation-done") data = { consultationNotes: consultNotes };
    else if (actionType === "cancel") data = { cancelReason };
    else if (actionType === "reschedule") {
      if (!rescheduleDate) { toast({ title: "Date required", variant: "destructive" }); return; }
      data = { appointmentDate: rescheduleDate, startTime: rescheduleSlot || undefined, reason: rescheduleReason || undefined };
    } else if (actionType === "no-show") data = {};

    appointmentAction.mutate(
      { id: appt.id, action: actionType, data },
      {
        onSuccess: () => {
          toast({ title: `Appointment ${actionType.replace("-", " ")} successfully` });
          if (actionType === "reschedule" && rescheduleDate) {
            setSelectedDate(rescheduleDate);
          }
          setActionDialog(null);
          setConsultNotes(""); setCancelReason(""); setRescheduleDate(""); setRescheduleSlot(""); setRescheduleReason("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, scheduled: 0, checkedin: 0, done: 0, noshow: 0, cancelled: 0 };
    appointments?.forEach((a: any) => {
      counts.all++;
      if (a.status === "Scheduled" || a.status === "Rescheduled") counts.scheduled++;
      else if (a.status === "Checked In") counts.checkedin++;
      else if (a.status === "Consultation Done" || a.status === "Completed") counts.done++;
      else if (a.status === "No Show") counts.noshow++;
      else if (a.status === "Cancelled") counts.cancelled++;
    });
    return counts;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments || [];
    if (statusFilter === "scheduled") filtered = filtered.filter((a: any) => a.status === "Scheduled" || a.status === "Rescheduled");
    else if (statusFilter === "checkedin") filtered = filtered.filter((a: any) => a.status === "Checked In");
    else if (statusFilter === "done") filtered = filtered.filter((a: any) => a.status === "Consultation Done" || a.status === "Completed");
    else if (statusFilter === "noshow") filtered = filtered.filter((a: any) => a.status === "No Show");
    else if (statusFilter === "cancelled") filtered = filtered.filter((a: any) => a.status === "Cancelled");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((a: any) => {
        const name = (a.patientName || a.leadName || "").toLowerCase();
        const phone = (a.patientPhone || a.leadPhone || "").toLowerCase();
        const doctor = (a.doctorName || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || doctor.includes(q);
      });
    }
    return filtered;
  }, [appointments, statusFilter, searchQuery]);

  const isAllDoctors = !selectedDoctor || selectedDoctor === "all";

  const doctorGroups = useMemo(() => {
    if (!isAllDoctors) return null;
    const groups: Record<string, { doctorName: string; doctorId: string; appointments: any[]; scheduled: number; checkedin: number; done: number }> = {};
    filteredAppointments.forEach((appt: any) => {
      const dId = String(appt.doctorId);
      if (!groups[dId]) {
        groups[dId] = { doctorName: appt.doctorName || `Doctor #${dId}`, doctorId: dId, appointments: [], scheduled: 0, checkedin: 0, done: 0 };
      }
      groups[dId].appointments.push(appt);
      if (appt.status === "Scheduled" || appt.status === "Rescheduled") groups[dId].scheduled++;
      if (appt.status === "Checked In") groups[dId].checkedin++;
      if (appt.status === "Consultation Done" || appt.status === "Completed") groups[dId].done++;
    });
    return Object.values(groups).sort((a, b) => a.doctorName.localeCompare(b.doctorName));
  }, [filteredAppointments, isAllDoctors]);

  const toggleDoctor = (doctorId: string) => {
    setCollapsedDoctors(prev => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else next.add(doctorId);
      return next;
    });
  };

  const STATUS_FILTERS = [
    { key: "all", label: "All", color: "bg-gray-100 text-gray-700 hover:bg-gray-200", activeColor: "bg-[#0f4c81] text-white" },
    { key: "scheduled", label: "Upcoming", color: "bg-blue-50 text-blue-700 hover:bg-blue-100", activeColor: "bg-blue-600 text-white" },
    { key: "checkedin", label: "Checked In", color: "bg-teal-50 text-teal-700 hover:bg-teal-100", activeColor: "bg-teal-600 text-white" },
    { key: "done", label: "Done", color: "bg-green-50 text-green-700 hover:bg-green-100", activeColor: "bg-green-600 text-white" },
    { key: "noshow", label: "No Show", color: "bg-orange-50 text-orange-700 hover:bg-orange-100", activeColor: "bg-orange-600 text-white" },
    { key: "cancelled", label: "Cancelled", color: "bg-red-50 text-red-700 hover:bg-red-100", activeColor: "bg-red-600 text-white" },
  ];

  const renderAppointmentRow = (appt: any, idx: number, showDoctor: boolean) => {
    const name = appt.patientName || appt.leadName || "—";
    const phone = appt.patientPhone || appt.leadPhone || "—";
    const isScheduled = appt.status === "Scheduled" || appt.status === "Rescheduled";
    const isCheckedIn = appt.status === "Checked In";
    return (
      <tr key={appt.id} className={cn("border-b hover:bg-muted/30 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-muted/10")} data-testid={`row-appointment-${appt.id}`}>
        <td className="py-1.5 px-2 text-muted-foreground text-xs w-10">
          {appt.tokenNumber ? <Badge variant="outline" className="text-[10px] gap-0.5 h-5"><Hash className="w-2.5 h-2.5" />{appt.tokenNumber}</Badge> : idx + 1}
        </td>
        <td className="py-1.5 px-2 font-medium text-xs w-28">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary flex-shrink-0" />
            {appt.startTime || "—"}
            {appt.endTime && <span className="text-muted-foreground">-{appt.endTime}</span>}
          </div>
        </td>
        <td className="py-1.5 px-2">
          <div className="text-xs font-medium">{name}</div>
          {appt.patientName && appt.leadName && (
            <div className="text-[10px] text-muted-foreground">Lead: {appt.leadName}</div>
          )}
        </td>
        <td className="py-1.5 px-2 text-xs text-muted-foreground">{phone}</td>
        {showDoctor && (
          <td className="py-1.5 px-2 text-xs">
            <div className="flex items-center gap-1">
              <Stethoscope className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate max-w-[120px]">{appt.doctorName || `#${appt.doctorId}`}</span>
            </div>
          </td>
        )}
        <td className="py-1.5 px-2 text-xs">
          {appt.branchName ? (
            <div className="flex items-center gap-1">
              <Building className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate max-w-[80px]">{appt.branchName}</span>
            </div>
          ) : "—"}
        </td>
        <td className="py-1.5 px-2">
          <div className="flex flex-wrap gap-0.5">
            <Badge className={cn("text-[10px] h-5", STATUS_COLORS[appt.status] || "bg-gray-100 text-gray-700")}>
              {appt.status}
            </Badge>
            {appt.serviceLocation && appt.serviceLocation !== "At Hospital" && (
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 text-violet-600 border-violet-200">
                {appt.serviceLocation === "Home Visit" ? "Home" : "Tele"}
              </Badge>
            )}
            {appt.rescheduleCount > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 text-amber-600">
                <RotateCcw className="w-2 h-2" />{appt.rescheduleCount}x
              </Badge>
            )}
          </div>
        </td>
        <td className="py-1.5 px-2 text-right">
          {isScheduled && (
            <div className="flex gap-0.5 justify-end">
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setActionDialog({ type: "check-in", appt })} data-testid={`button-checkin-${appt.id}`}>
                <UserPlus className="w-3 h-3 mr-0.5" />Check In
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5" onClick={() => setActionDialog({ type: "consultation-done", appt })} data-testid={`button-consult-done-${appt.id}`}>
                <CheckCircle2 className="w-3 h-3 mr-0.5" />Done
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5" onClick={() => setActionDialog({ type: "reschedule", appt })} data-testid={`button-reschedule-${appt.id}`}>
                <RotateCcw className="w-3 h-3 mr-0.5" />Rsch
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5" onClick={() => setActionDialog({ type: "no-show", appt })} data-testid={`button-noshow-${appt.id}`}>
                <AlertTriangle className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5 text-destructive" onClick={() => setActionDialog({ type: "cancel", appt })} data-testid={`button-cancel-${appt.id}`}>
                <XCircle className="w-3 h-3" />
              </Button>
            </div>
          )}
          {isCheckedIn && (
            <div className="flex gap-0.5 justify-end">
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5" onClick={() => setActionDialog({ type: "consultation-done", appt })} data-testid={`button-consult-done-${appt.id}`}>
                <CheckCircle2 className="w-3 h-3 mr-0.5" />Done
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-1.5" onClick={() => setActionDialog({ type: "no-show", appt })} data-testid={`button-noshow-${appt.id}`}>
                <AlertTriangle className="w-3 h-3 mr-0.5" />No Show
              </Button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
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
              className="h-9"
              data-testid="schedule-filter-date"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, phone, doctor..."
                className="pl-8 h-9"
                data-testid="schedule-search"
              />
            </div>
          </div>
          <Button onClick={() => setBookingOpen(true)} data-testid="button-book-new-appointment" className="h-9">
            <Plus className="w-4 h-4 mr-1.5" />
            Book Appointment
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "all" ? "border-[#0f4c81] bg-[#0f4c81]/5" : "border-transparent hover:border-gray-200")} onClick={() => setStatusFilter("all")} data-testid="stat-card-all">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</div>
          <div className="text-2xl font-bold text-[#0f4c81]">{statusCounts.all}</div>
          <div className="text-[10px] text-muted-foreground">{selectedDate ? fmtDate(new Date(selectedDate + "T12:00:00")) : "All"}</div>
        </Card>
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "scheduled" ? "border-blue-500 bg-blue-50" : "border-transparent hover:border-blue-100")} onClick={() => setStatusFilter("scheduled")} data-testid="stat-card-scheduled">
          <div className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Waiting</div>
          <div className="text-2xl font-bold text-blue-700">{statusCounts.scheduled}</div>
          <div className="text-[10px] text-muted-foreground">Scheduled</div>
        </Card>
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "checkedin" ? "border-teal-500 bg-teal-50" : "border-transparent hover:border-teal-100")} onClick={() => setStatusFilter("checkedin")} data-testid="stat-card-checkedin">
          <div className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">Checked In</div>
          <div className="text-2xl font-bold text-teal-700">{statusCounts.checkedin}</div>
          <div className="text-[10px] text-muted-foreground">Arrived</div>
        </Card>
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "done" ? "border-green-500 bg-green-50" : "border-transparent hover:border-green-100")} onClick={() => setStatusFilter("done")} data-testid="stat-card-done">
          <div className="text-[10px] font-medium text-green-600 uppercase tracking-wider">Done</div>
          <div className="text-2xl font-bold text-green-700">{statusCounts.done}</div>
          <div className="text-[10px] text-muted-foreground">Consultation Done</div>
        </Card>
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "noshow" ? "border-orange-500 bg-orange-50" : "border-transparent hover:border-orange-100")} onClick={() => setStatusFilter("noshow")} data-testid="stat-card-noshow">
          <div className="text-[10px] font-medium text-orange-600 uppercase tracking-wider">No Show</div>
          <div className="text-2xl font-bold text-orange-700">{statusCounts.noshow}</div>
          <div className="text-[10px] text-muted-foreground">Did not arrive</div>
        </Card>
        <Card className={cn("p-2.5 cursor-pointer transition-all border-2", statusFilter === "cancelled" ? "border-red-500 bg-red-50" : "border-transparent hover:border-red-100")} onClick={() => setStatusFilter("cancelled")} data-testid="stat-card-cancelled">
          <div className="text-[10px] font-medium text-red-600 uppercase tracking-wider">Cancelled</div>
          <div className="text-2xl font-bold text-red-700">{statusCounts.cancelled}</div>
          <div className="text-[10px] text-muted-foreground">Cancelled appts</div>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-semibold">{selectedDate ? fmtDayMonthYear(new Date(selectedDate + "T12:00:00")) : "All Dates"}</span>
          {isAllDoctors && doctorGroups && (
            <>
              <span className="text-muted-foreground mx-1">|</span>
              <Users className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">{doctorGroups.length} doctors</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.key}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === sf.key ? sf.activeColor : sf.color
              )}
              onClick={() => setStatusFilter(sf.key)}
              data-testid={`filter-status-${sf.key}`}
            >
              {sf.label} ({statusCounts[sf.key as keyof typeof statusCounts]})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading schedule..." />
      ) : filteredAppointments.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">
            {searchQuery ? `No appointments matching "${searchQuery}"` : "No appointments found for the selected filters"}
          </p>
        </Card>
      ) : isAllDoctors && doctorGroups ? (
        <div className="space-y-2">
          {doctorGroups.map((group) => {
            const isCollapsed = collapsedDoctors.has(group.doctorId);
            return (
              <Card key={group.doctorId} className="overflow-hidden" data-testid={`doctor-group-${group.doctorId}`}>
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleDoctor(group.doctorId)}
                  data-testid={`toggle-doctor-${group.doctorId}`}
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <Stethoscope className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">{group.doctorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{group.appointments.length} appts</Badge>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">{group.scheduled} waiting</Badge>
                    {group.checkedin > 0 && <Badge className="bg-teal-100 text-teal-700 text-xs">{group.checkedin} checked in</Badge>}
                    <Badge className="bg-green-100 text-green-700 text-xs">{group.done} done</Badge>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase w-10">#</th>
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase w-28">Time</th>
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Patient</th>
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Phone</th>
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Branch</th>
                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Status</th>
                          <th className="text-right py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.appointments.map((appt: any, idx: number) => renderAppointmentRow(appt, idx, false))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase w-10">#</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase w-28">Time</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Patient</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Phone</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Doctor</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Branch</th>
                <th className="text-left py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-right py-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appt: any, idx: number) => renderAppointmentRow(appt, idx, true))}
            </tbody>
          </table>
        </Card>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason for Reschedule</label>
              <Textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Enter reason for rescheduling..."
                className="text-xs min-h-[60px]"
                data-testid="input-reschedule-reason"
              />
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

      <Dialog open={actionDialog?.type === "check-in"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Check In Patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {actionDialog?.appt && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-primary" />
                  {actionDialog.appt.patientName || actionDialog.appt.leadName || "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {actionDialog.appt.startTime || "—"} with {actionDialog.appt.doctorName || "Doctor"}
                </div>
                {!actionDialog.appt.patientId && actionDialog.appt.leadId && (
                  <div className="text-xs text-teal-700 bg-teal-50 rounded px-2 py-1 mt-1">
                    <UserPlus className="w-3 h-3 inline mr-1" />
                    A patient record will be automatically created from the lead data on check-in.
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={() => actionDialog?.appt && handleCheckIn(actionDialog.appt.id)}
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={checkInPending}
              data-testid="button-confirm-checkin"
            >
              {checkInPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Confirm Check In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!episodePrompt} onOpenChange={(open) => { if (!open) setEpisodePrompt(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Find or Create Episode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {episodePrompt && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-primary" />
                  {episodePrompt.appt.patientName || episodePrompt.appt.leadName || "Patient"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Checked in successfully. Link this appointment to an existing episode or create a new one.
                </p>
              </div>
            )}

            {!episodeCreateMode && (
              <>
                {episodesLoading ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">Loading episodes...</div>
                ) : patientEpisodes && patientEpisodes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Existing episodes for this patient ({patientEpisodes.length}):
                    </p>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {patientEpisodes.map((ep: any) => (
                        <Card
                          key={ep.id}
                          className="p-3 hover-elevate cursor-pointer"
                          data-testid={`episode-option-${ep.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{ep.episodeName}</div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge className={cn("text-[10px]", 
                                  ep.status === "Completed" ? "bg-green-100 text-green-700" :
                                  ep.status === "Consultation Done" ? "bg-blue-100 text-blue-700" :
                                  "bg-amber-100 text-amber-700"
                                )}>
                                  {ep.status}
                                </Badge>
                                {ep.diagnosis && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{ep.diagnosis}</span>
                                )}
                                {ep.startDate && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {fmtDate(new Date(ep.startDate))}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs shrink-0"
                              disabled={isLinkingEpisode}
                              onClick={() => handleLinkEpisode(ep.id)}
                              data-testid={`button-link-episode-${ep.id}`}
                            >
                              {isLinkingEpisode ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3 mr-1" />}
                              Link
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    No existing episodes for this patient.
                  </div>
                )}

                <div className="border-t pt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setEpisodeCreateMode(true)}
                    data-testid="button-create-new-episode"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Episode
                  </Button>
                </div>
              </>
            )}

            {episodeCreateMode && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Treatment Department</Label>
                  <SearchableSelect
                    value={newEpisodeTreatmentDeptId}
                    onValueChange={setNewEpisodeTreatmentDeptId}
                    options={[
                      { value: "", label: "General" },
                      ...(treatmentDeptsList?.filter((d: any) => d.status === "Active").map((d: any) => ({
                        value: String(d.id),
                        label: d.name,
                      })) || []),
                    ]}
                    placeholder="Select department"
                    data-testid="select-episode-treatment-dept"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
                  <Textarea
                    value={newEpisodeNotes}
                    onChange={(e) => setNewEpisodeNotes(e.target.value)}
                    placeholder="Episode notes..."
                    rows={2}
                    data-testid="input-episode-notes"
                  />
                </div>

                {patientEpisodes && patientEpisodes.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>This patient already has {patientEpisodes.length} episode{patientEpisodes.length > 1 ? "s" : ""}. Make sure this is not a duplicate before creating a new one.</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEpisodeCreateMode(false)}
                    data-testid="button-back-to-search"
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreateAndLinkEpisode}
                    disabled={isCreatingEpisode}
                    data-testid="button-confirm-create-episode"
                  >
                    {isCreatingEpisode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create & Link Episode
                  </Button>
                </div>
              </div>
            )}

            {!episodeCreateMode && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setEpisodePrompt(null)}
                data-testid="button-skip-episode"
              >
                Skip — I'll do this later
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingOpen} onOpenChange={(open) => { if (!open) { setBookingOpen(false); resetBookingForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Book New Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 p-3 border rounded-lg bg-blue-50/30">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                Branch & Doctor
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Branch *</Label>
                  <SearchableSelect
                    value={bookBranchId || defaultBranchId}
                    onValueChange={setBookBranchId}
                    options={activeBranches.map((b: any) => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select branch"
                    data-testid="book-select-branch"
                  />
                </div>
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
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Date *</Label>
                <Input type="date" value={bookDate} onChange={(e) => { setBookDate(e.target.value); setBookSlot(""); }} min={new Date().toISOString().split("T")[0]} data-testid="book-input-date" />
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-xs p-0 h-auto text-primary"
                onClick={() => onOpenAvailability((doctorId, date, time) => {
                  setBookDoctorId(doctorId);
                  setBookDate(date);
                  setBookSlot(time);
                  setBookManualTime("");
                })}
                data-testid="button-check-availability"
              >
                <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                Check Availability & Pick a Slot
              </Button>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Appointment Time *</Label>
                {!bookDoctorId || !bookDate ? (
                  <div className="space-y-2 mt-1">
                    <p className="text-xs text-muted-foreground">Select doctor and date above to see available slots</p>
                    <Input type="time" value={bookManualTime} onChange={(e) => setBookManualTime(e.target.value)} placeholder="HH:MM" data-testid="book-input-time-manual" />
                  </div>
                ) : availability.isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Loading available slots...</p>
                ) : availability.data && !availability.data.available ? (
                  <div className="space-y-2 mt-1">
                    <p className="text-xs text-destructive">{availability.data.reason || "Doctor not available on this date"}</p>
                    <p className="text-xs text-muted-foreground">You can still enter time manually:</p>
                    <Input type="time" value={bookManualTime} onChange={(e) => setBookManualTime(e.target.value)} data-testid="book-input-time-manual" />
                  </div>
                ) : availability.data && availability.data.slots.length > 0 ? (
                  <div className="space-y-2 mt-1">
                    <div className="pointer-events-none select-none">
                      <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        OPD Schedule — {availability.data.dayOfWeek || ""}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {availability.data.slots.map((slot: any) => (
                          <div key={slot.startTime} className={cn("flex items-center gap-1.5 px-2 py-1 rounded border text-xs", slot.availableCount <= 0 ? "bg-muted/50 opacity-50" : "bg-background")} data-testid={`book-schedule-${slot.startTime}`}>
                            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span>{slot.startTime} - {slot.endTime}</span>
                            <Badge variant="outline" className={cn("ml-auto text-[10px]", slot.availableCount <= 0 ? "text-destructive" : "text-green-600")}>
                              {slot.availableCount <= 0 ? "Full" : `${slot.availableCount} left`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Pick a time slot:</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {availability.data.slots.filter((slot: any) => slot.availableCount > 0).map((slot: any) => (
                          <Button
                            key={slot.startTime}
                            variant={bookSlot === slot.startTime ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              if (bookSlot === slot.startTime) {
                                setBookSlot("");
                              } else {
                                setBookSlot(slot.startTime);
                                setBookManualTime("");
                              }
                            }}
                            data-testid={`book-slot-${slot.startTime}`}
                          >
                            <Clock className="w-3 h-3 mr-1" />{slot.startTime}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Or enter time manually:</p>
                      <Input type="time" value={bookManualTime} onChange={(e) => { setBookManualTime(e.target.value); setBookSlot(""); }} className="mt-1" data-testid="book-input-time-manual" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mt-1">{availability.data?.slots.length === 0 ? "No OPD slots configured for this day." : ""} Enter time:</p>
                    <Input type="time" value={bookManualTime} onChange={(e) => setBookManualTime(e.target.value)} className="mt-1" data-testid="book-input-time-manual" />
                  </div>
                )}
              </div>
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
            </div>

            <div className="space-y-3 p-3 border rounded-lg bg-green-50/30">
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Patient
              </p>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Phone Number *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">+91</span>
                  <Input
                    value={newPatientPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setNewPatientPhone(val);
                      if (val.length === 10) {
                        const matchedLead = (leadsList || []).find((l: any) => {
                          const lPhone = (l.phoneE164 || l.phone || "").replace(/\D/g, "").slice(-10);
                          return lPhone === val;
                        });
                        const matchedPatient = (patientsList || []).find((p: any) => {
                          const pPhone = (p.primaryPhone || "").replace(/\D/g, "").slice(-10);
                          return pPhone === val;
                        });
                        if (matchedLead) {
                          setBookLeadId(String(matchedLead.id));
                          setNewPatientName(matchedLead.name || "");
                          setBookMode("existing");
                          if (matchedLead.patientId) {
                            setBookPatientId(String(matchedLead.patientId));
                          } else if (matchedPatient) {
                            setBookPatientId(String(matchedPatient.id));
                          } else {
                            setBookPatientId("");
                          }
                        } else if (matchedPatient) {
                          setBookPatientId(String(matchedPatient.id));
                          setNewPatientName([matchedPatient.firstName, matchedPatient.lastName].filter(Boolean).join(" "));
                          setBookMode("existing");
                          setBookLeadId("");
                        } else {
                          setBookLeadId("");
                          setBookPatientId("");
                          setNewPatientName("");
                          setBookMode("new");
                        }
                      } else {
                        setBookLeadId("");
                        setBookPatientId("");
                      }
                    }}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    data-testid="book-input-patient-phone"
                  />
                </div>
              </div>

              {newPatientPhone.length === 10 && (bookLeadId || bookPatientId) && (
                <div className="p-2.5 bg-green-100/60 border border-green-200 rounded-md">
                  <p className="text-xs font-medium text-green-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Patient found: {newPatientName}
                  </p>
                  {bookPatientId && (
                    <p className="text-[10px] text-green-600 mt-0.5">Registered patient record linked</p>
                  )}
                </div>
              )}

              {newPatientPhone.length === 10 && !bookLeadId && !bookPatientId && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    New patient — fill details below
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Patient Name {bookMode === "new" ? "*" : ""}</Label>
                <Input
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="Full name"
                  disabled={bookMode === "existing" && !!(bookLeadId || bookPatientId)}
                  data-testid="book-input-patient-name"
                />
              </div>

              {bookMode === "new" && (
                <div className="grid grid-cols-2 gap-3">
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
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Service Location</Label>
              <SearchableSelect
                value={bookServiceLocation}
                onValueChange={setBookServiceLocation}
                options={[
                  { value: "At Hospital", label: "At Hospital" },
                  { value: "Home Visit", label: "Home Visit" },
                  { value: "Tele-Consultation", label: "Tele-Consultation" },
                ]}
                placeholder="Where will this happen?"
                data-testid="book-select-service-location"
              />
            </div>
            {bookServiceLocation === "Home Visit" && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Home Address</Label>
                <Textarea value={bookServiceAddress} onChange={(e) => setBookServiceAddress(e.target.value)} placeholder="Patient's home address for the visit..." rows={2} data-testid="book-input-service-address" />
              </div>
            )}
            {bookMode === "existing" && episodesList && episodesList.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Link to Episode (optional)</Label>
                <SearchableSelect
                  value={bookEpisodeId}
                  onValueChange={setBookEpisodeId}
                  options={[
                    { value: "none", label: "No Episode" },
                    ...episodesList.map((ep: any) => ({
                      value: String(ep.id),
                      label: `${ep.episodeName} (${ep.status})`,
                    })),
                  ]}
                  placeholder="Link to treatment episode"
                  data-testid="book-select-episode"
                />
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
              <Textarea value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} placeholder="Appointment notes..." rows={2} data-testid="book-input-notes" />
            </div>
            <Button
              onClick={handleBookAppointment}
              className="w-full"
              disabled={createAppointment.isPending || isCreatingLead || !bookDoctorId || !bookDate || !effectiveStartTime || !newPatientPhone || newPatientPhone.length < 10 || (bookMode === "new" && !newPatientName) || (bookMode === "existing" && !bookLeadId && !bookPatientId)}
              data-testid="button-confirm-book"
            >
              {(createAppointment.isPending || isCreatingLead) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              {bookMode === "new" ? "Create & Book Appointment" : "Book Appointment"}
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
                ? fmtMonthYear(currentDate)
                : `${fmtDate(dateRange.start)} - ${fmtDate(dateRange.end)}`}
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
              {fmtDayMonthYear(new Date(selectedDay + "T12:00:00"))}
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

function AvailabilityCalendarModal({ open, onOpenChange, selectMode, onSlotSelected }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectMode: boolean;
  onSlotSelected: (doctorId: string, date: string, time: string) => void;
}) {
  const { data: doctorsList } = useDoctors();
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day" | "week">("month");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { data: leaves, isLoading: leavesLoading } = useDoctorLeaves(selectedDoctor);

  const activeDoctors = (doctorsList?.filter((d: any) => d.status === "Active") || []);

  const selectedDayDoctorId = selectedDoctor !== "all" ? selectedDoctor : null;
  const dayAvailability = useDoctorAvailability(
    selectedDayDoctorId ? Number(selectedDayDoctorId) : null,
    selectedDay
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const leaveDateMap = useMemo(() => {
    const map = new Map<string, LeaveRecord[]>();
    if (!leaves) return map;
    leaves.forEach((leave) => {
      const start = new Date(leave.leaveDate);
      const end = leave.leaveEndDate ? new Date(leave.leaveEndDate) : start;
      const days = eachDayOfInterval({ start, end });
      days.forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(leave);
      });
    });
    return map;
  }, [leaves]);

  const upcomingLeaves = useMemo(() => {
    if (!leaves) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return leaves
      .filter((l) => {
        const end = l.leaveEndDate ? new Date(l.leaveEndDate) : new Date(l.leaveDate);
        return end >= today;
      })
      .sort((a, b) => new Date(a.leaveDate).getTime() - new Date(b.leaveDate).getTime())
      .slice(0, 10);
  }, [leaves]);

  const handleDayClick = (dateKey: string) => {
    setSelectedDay(dateKey);
    if (selectMode && selectedDoctor !== "all") {
      setViewMode("day");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="availability-calendar-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            Doctor Availability Calendar
            {selectMode && <Badge variant="outline" className="text-xs ml-2">Select a slot to book</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="min-w-[200px]">
            <SearchableSelect
              value={selectedDoctor}
              onValueChange={(v) => { setSelectedDoctor(v); setSelectedDay(null); }}
              options={[
                { value: "all", label: "All Doctors" },
                ...activeDoctors.map((d: any) => ({ value: String(d.id), label: d.name })),
              ]}
              placeholder="Select doctor..."
              data-testid="avail-select-doctor"
            />
          </div>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            <Button size="sm" variant={viewMode === "month" ? "default" : "ghost"} className="text-xs h-7" onClick={() => setViewMode("month")} data-testid="avail-view-month">Month</Button>
            <Button size="sm" variant={viewMode === "day" ? "default" : "ghost"} className="text-xs h-7" onClick={() => setViewMode("day")} data-testid="avail-view-day">Day</Button>
            <Button size="sm" variant={viewMode === "week" ? "default" : "ghost"} className="text-xs h-7" onClick={() => setViewMode("week")} data-testid="avail-view-week">Week</Button>
          </div>
        </div>

        {viewMode === "month" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card className="p-4" data-testid="avail-calendar-card">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="avail-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="text-base font-semibold">{fmtMonthYear(currentMonth)}</h2>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="avail-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {leavesLoading ? (
                  <div className="flex justify-center py-12"><LoadingSpinner /></div>
                ) : (
                  <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <div key={day} className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                    ))}
                    {calendarDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayLeaves = leaveDateMap.get(key) || [];
                      const hasLeave = dayLeaves.length > 0;
                      const inCurrentMonth = isSameMonth(day, currentMonth);
                      const todayFlag = isToday(day);
                      const isSunday = day.getDay() === 0;
                      const isSelected = selectedDay === key;

                      return (
                        <div
                          key={key}
                          className={cn(
                            "min-h-[70px] p-1.5 bg-background transition-colors relative cursor-pointer hover:bg-primary/5",
                            !inCurrentMonth && "opacity-40",
                            todayFlag && "ring-2 ring-primary ring-inset",
                            hasLeave && inCurrentMonth && "bg-destructive/5",
                            isSunday && !hasLeave && inCurrentMonth && "bg-muted/30",
                            isSelected && "ring-2 ring-primary bg-primary/10"
                          )}
                          onClick={() => inCurrentMonth && handleDayClick(key)}
                          data-testid={`avail-day-${key}`}
                        >
                          <div className={cn(
                            "text-xs font-medium mb-1",
                            todayFlag && "text-primary font-bold",
                            isSunday && "text-muted-foreground",
                            hasLeave && "text-destructive"
                          )}>
                            {format(day, "d")}
                          </div>
                          {hasLeave && inCurrentMonth && (
                            <div className="space-y-0.5">
                              {dayLeaves.slice(0, 2).map((leave, i) => (
                                <div key={`${leave.id}-${i}`} className="text-[9px] leading-tight bg-destructive/10 text-destructive rounded px-1 py-0.5 truncate" title={`${leave.doctorName}${leave.reason ? ` - ${leave.reason}` : ""}`}>
                                  <span className="font-medium">{leave.doctorName.replace(/^Dr\.?\s*/i, "").split(" ")[0]}</span>
                                </div>
                              ))}
                              {dayLeaves.length > 2 && (
                                <div className="text-[8px] text-destructive/70 font-medium px-1">+{dayLeaves.length - 2} more</div>
                              )}
                            </div>
                          )}
                          {isSunday && !hasLeave && inCurrentMonth && (
                            <div className="text-[8px] text-muted-foreground font-medium">Holiday</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/20" />
                    <span>Doctor on leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-muted border border-border" />
                    <span>Sunday</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded ring-2 ring-primary" />
                    <span>Today</span>
                  </div>
                  {selectMode && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-primary/10 ring-2 ring-primary" />
                      <span>Click day to view slots</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              {selectedDay && selectedDoctor !== "all" && (
                <AvailabilityDaySlots
                  date={selectedDay}
                  doctorId={selectedDoctor}
                  doctorName={activeDoctors.find((d: any) => String(d.id) === selectedDoctor)?.name || ""}
                  availability={dayAvailability}
                  selectMode={selectMode}
                  onSlotSelected={onSlotSelected}
                  leaveDateMap={leaveDateMap}
                />
              )}
              {selectedDay && selectedDoctor === "all" && (
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground text-center py-4">Select a specific doctor to see available slots for {fmtDate(new Date(selectedDay + "T12:00:00"))}.</p>
                </Card>
              )}
              <Card className="p-4" data-testid="avail-upcoming-leaves">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Upcoming Leaves
                </h3>
                {leavesLoading ? (
                  <LoadingSpinner />
                ) : upcomingLeaves.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No upcoming leaves found</div>
                ) : (
                  <div className="space-y-2">
                    {upcomingLeaves.slice(0, 5).map((leave) => {
                      const startDate = new Date(leave.leaveDate);
                      const endDate = leave.leaveEndDate ? new Date(leave.leaveEndDate) : startDate;
                      const isMultiDay = leave.leaveEndDate && format(startDate, "yyyy-MM-dd") !== format(endDate, "yyyy-MM-dd");
                      return (
                        <div key={leave.id} className="rounded-lg border p-2 text-xs bg-destructive/5 border-destructive/10" data-testid={`avail-leave-${leave.id}`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Stethoscope className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="font-medium truncate">{leave.doctorName}</span>
                          </div>
                          <div className="text-muted-foreground ml-4">
                            {fmtDate(startDate)}
                            {isMultiDay && ` → ${fmtDate(endDate)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
              <Card className="p-4" data-testid="avail-quick-stats">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary" />
                  Quick Stats
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Doctors</span>
                    <Badge variant="outline" className="text-[10px] h-5">{activeDoctors.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leaves This Month</span>
                    <Badge variant="outline" className="text-[10px] h-5 text-destructive border-destructive/20">
                      {leaves?.filter((l) => {
                        const start = new Date(l.leaveDate);
                        const end = l.leaveEndDate ? new Date(l.leaveEndDate) : start;
                        return (start >= monthStart && start <= monthEnd) || (end >= monthStart && end <= monthEnd) ||
                               (start <= monthStart && end >= monthEnd);
                      }).length || 0}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {(viewMode === "day" || viewMode === "week") && (
          <AvailabilityDayWeekView
            viewMode={viewMode}
            selectedDate={selectedDay || format(new Date(), "yyyy-MM-dd")}
            onDateChange={setSelectedDay}
            doctorId={selectedDoctor}
            doctorsList={activeDoctors}
            selectMode={selectMode}
            onSlotSelected={onSlotSelected}
            leaveDateMap={leaveDateMap}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AvailabilityDaySlots({ date, doctorId, doctorName, availability, selectMode, onSlotSelected, leaveDateMap }: {
  date: string;
  doctorId: string;
  doctorName: string;
  availability: any;
  selectMode: boolean;
  onSlotSelected: (doctorId: string, date: string, time: string) => void;
  leaveDateMap: Map<string, LeaveRecord[]>;
}) {
  const dayLeaves = leaveDateMap.get(date) || [];
  const hasLeave = dayLeaves.some(l => String(l.doctorId) === doctorId);

  return (
    <Card className="p-4" data-testid="avail-day-slots">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        {fmtDate(new Date(date + "T12:00:00"))}
      </h3>
      <p className="text-xs text-muted-foreground mb-3">{doctorName}</p>

      {hasLeave && (
        <div className="mb-3 p-2 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Doctor is on leave this day
        </div>
      )}

      {availability.isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : !availability.data?.available ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{availability.data?.reason || "Not available on this date"}</p>
      ) : availability.data.slots.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No OPD slots configured for this day</p>
      ) : (
        <div className="space-y-1.5">
          {availability.data.slots.map((slot: any) => (
            <div key={slot.startTime} className={cn("flex items-center justify-between p-2 rounded border text-xs", slot.availableCount <= 0 ? "bg-muted/50 opacity-50" : "hover:bg-primary/5")}>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-primary" />
                <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                <Badge variant="outline" className={cn("text-[10px] h-4", slot.availableCount <= 0 ? "text-destructive" : "text-green-600")}>
                  {slot.availableCount <= 0 ? "Full" : `${slot.availableCount} left`}
                </Badge>
              </div>
              {selectMode && slot.availableCount > 0 && (
                <Button size="sm" variant="default" className="text-[10px] h-6 px-2" onClick={() => onSlotSelected(doctorId, date, slot.startTime)} data-testid={`avail-pick-slot-${slot.startTime}`}>
                  Select
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AvailabilityDayWeekView({ viewMode, selectedDate, onDateChange, doctorId, doctorsList, selectMode, onSlotSelected, leaveDateMap }: {
  viewMode: "day" | "week";
  selectedDate: string;
  onDateChange: (d: string) => void;
  doctorId: string;
  doctorsList: any[];
  selectMode: boolean;
  onSlotSelected: (doctorId: string, date: string, time: string) => void;
  leaveDateMap: Map<string, LeaveRecord[]>;
}) {
  const dateObj = new Date(selectedDate + "T12:00:00");
  const dates = viewMode === "day" ? [dateObj] : eachDayOfInterval({ start: startOfWeek(dateObj, { weekStartsOn: 1 }), end: endOfWeek(dateObj, { weekStartsOn: 1 }) });

  const doctorsToShow = doctorId !== "all" ? doctorsList.filter((d: any) => String(d.id) === doctorId) : doctorsList.slice(0, 10);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + dir * 7);
    onDateChange(format(d, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} data-testid="avail-nav-prev">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-semibold text-sm">
          {viewMode === "day"
            ? fmtDayMonthYear(dateObj)
            : `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}`}
        </h3>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)} data-testid="avail-nav-next">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {doctorId === "all" && doctorsList.length > 10 && (
        <p className="text-xs text-muted-foreground text-center">Showing first 10 doctors. Select a specific doctor for full detail.</p>
      )}

      <div className={cn("grid gap-3", viewMode === "week" ? "grid-cols-7" : "grid-cols-1")}>
        {dates.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayLeaves = leaveDateMap.get(key) || [];
          const isSunday = day.getDay() === 0;

          return (
            <div key={key} className={cn("space-y-2", viewMode === "week" && "min-w-0")}>
              <div className={cn("text-xs font-semibold text-center py-1 rounded", isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {viewMode === "week" ? formatDateIn(day, "EEE dd/MM") : fmtDayMonthYear(day)}
              </div>
              {isSunday ? (
                <div className="text-[10px] text-muted-foreground text-center py-3">Holiday</div>
              ) : (
                <div className="space-y-1">
                  {doctorsToShow.map((doc: any) => {
                    const docId = String(doc.id);
                    const onLeave = dayLeaves.some(l => String(l.doctorId) === docId);
                    return (
                      <DayDoctorSlotRow
                        key={docId}
                        doctorId={docId}
                        doctorName={doc.name}
                        date={key}
                        onLeave={onLeave}
                        selectMode={selectMode}
                        onSlotSelected={onSlotSelected}
                        compact={viewMode === "week"}
                      />
                    );
                  })}
                  {doctorsToShow.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">Select a doctor</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDoctorSlotRow({ doctorId, doctorName, date, onLeave, selectMode, onSlotSelected, compact }: {
  doctorId: string;
  doctorName: string;
  date: string;
  onLeave: boolean;
  selectMode: boolean;
  onSlotSelected: (doctorId: string, date: string, time: string) => void;
  compact: boolean;
}) {
  const availability = useDoctorAvailability(Number(doctorId), date);

  if (onLeave) {
    return (
      <div className="text-[10px] p-1.5 rounded bg-destructive/5 border border-destructive/10 text-destructive truncate" data-testid={`avail-slot-row-${doctorId}-${date}`}>
        <Stethoscope className="w-2.5 h-2.5 inline mr-1" />
        {compact ? doctorName.split(" ")[0] : doctorName} — Leave
      </div>
    );
  }

  if (availability.isLoading) {
    return (
      <div className="text-[10px] p-1.5 rounded bg-muted/50 text-muted-foreground truncate">
        <Stethoscope className="w-2.5 h-2.5 inline mr-1" />
        {compact ? doctorName.split(" ")[0] : doctorName} <Loader2 className="w-2.5 h-2.5 inline animate-spin ml-1" />
      </div>
    );
  }

  const slots = availability.data?.slots || [];
  const totalAvailable = slots.reduce((sum: number, s: any) => sum + Math.max(0, s.availableCount), 0);

  return (
    <div className="text-[10px] p-1.5 rounded border bg-background" data-testid={`avail-slot-row-${doctorId}-${date}`}>
      <div className="flex items-center gap-1 mb-1">
        <Stethoscope className="w-2.5 h-2.5 text-primary flex-shrink-0" />
        <span className="font-medium truncate">{compact ? doctorName.split(" ")[0] : doctorName}</span>
        {totalAvailable > 0 && (
          <Badge variant="outline" className="text-[8px] h-3.5 ml-auto text-green-600 border-green-200">{totalAvailable} slots</Badge>
        )}
      </div>
      {!availability.data?.available ? (
        <span className="text-muted-foreground">Unavailable</span>
      ) : slots.length === 0 ? (
        <span className="text-muted-foreground">No OPD slots</span>
      ) : (
        <div className={cn("flex gap-1 flex-wrap", compact && "flex-col")}>
          {slots.map((slot: any) => (
            <button
              key={slot.startTime}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] border transition-colors",
                slot.availableCount <= 0
                  ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                  : selectMode
                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer"
                    : "bg-muted/30 text-foreground"
              )}
              disabled={slot.availableCount <= 0}
              onClick={() => selectMode && slot.availableCount > 0 && onSlotSelected(doctorId, date, slot.startTime)}
              data-testid={`avail-slot-${doctorId}-${date}-${slot.startTime}`}
            >
              {slot.startTime}{!compact && `-${slot.endTime}`} ({slot.availableCount})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
