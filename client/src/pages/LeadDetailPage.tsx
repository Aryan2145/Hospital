import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useLead, useLeadActivities, useUpdateLead, useCreateActivity, useTasks, useCreateTask, useUpdateTask, useHandoverAction, useAssignLead, useActiveCrmUsers, useDoctors, useDoctorAvailability, useCreateAppointment, useNextActionTypes, useEpisodes, useLeadStatuses, type IndividualSlot } from "@/hooks/use-leads";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { getStatusColor, getPriorityColor, getLeadTemperature, getTemperatureColor } from "@/lib/lead-status";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { fmtDate, fmtDateTime, fmtDateTimeShort, fmtDateShort } from "@/lib/date-utils";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { JourneySnapshot, TreatmentJourneyTimeline, UnifiedJourneyTimeline } from "@/components/leads/JourneyView";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Clock,
  StickyNote,
  ArrowRightLeft,
  MessageSquare,
  Activity,
  CheckSquare,
  Send,
  AlertTriangle,
  GitMerge,
  CheckCircle2,
  User,
  Building,
  Target,
  TrendingUp,
  ChevronRight,
  UserPlus,
  ArrowRight,
  X,
  Shield,
  Flame,
  Sun,
  Snowflake,
  MessageCircle,
  Thermometer,
  Users,
  CalendarClock,
  Ban,
  RefreshCw,
  Globe,
  Gauge,
  Zap,
  Hash,
  Percent,
  ShieldCheck,
  Bell,
  BellOff,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Star,
  CreditCard,
  Ambulance,
  MessageSquareDot,
  Landmark,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const LEAD_FUNNEL_STAGES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Consultation Done",
] as const;

const UNIFIED_JOURNEY_STAGES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Consultation Done",
  "Treatment Planning",
  "Surgery Scheduled",
  "Surgery Done",
  "In Treatment",
  "Discharge / Billing Clearance",
  "Post Care",
  "Follow Up",
  "Completed",
];

const LEAD_TERMINAL_STATUSES = ["Closed Won", "Closed Lost", "Unqualified", "Nurture", "Discontinued"];

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  note: StickyNote,
  status_change: ArrowRightLeft,
  appointment: Calendar,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  task: CheckSquare,
  handover: ArrowRightLeft,
  assignment: UserPlus,
  handover_accepted: CheckCircle2,
  handover_rejected: X,
  temperature_change: Thermometer,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  note: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  status_change: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  appointment: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  email: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  sms: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  whatsapp: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  task: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  handover: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  assignment: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  handover_accepted: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  handover_rejected: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  temperature_change: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function LeadDetailPage() {
  const [, params] = useRoute("/leads/:id");
  const [, setLocation] = useLocation();
  const leadId = Number(params?.id);
  const { data: lead, isLoading } = useLead(leadId);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading lead..." />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Lead not found</p>
            <Button variant="outline" onClick={() => setLocation("/leads")} data-testid="button-back-to-leads">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (lead.mergeStatus === "MERGED") {
    return (
      <AppLayout className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-6">
          <Alert className="border-amber-200 bg-amber-50" data-testid="merged-lead-banner">
            <GitMerge className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 text-lg">This Lead Has Been Merged</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-amber-700 mb-3">
                Lead #{lead.id} ({lead.name}) was merged into another lead on{" "}
                {lead.mergedAt ? fmtDateTime(lead.mergedAt) : "—"}.
                All activities, tasks, episodes, and appointments have been moved to the primary lead.
              </p>
              <div className="flex gap-2">
                {lead.mergedIntoLeadId && (
                  <Button
                    variant="default"
                    onClick={() => setLocation(`/leads/${lead.mergedIntoLeadId}`)}
                    data-testid="button-go-to-primary-lead"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Go to Primary Lead #{lead.mergedIntoLeadId}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLocation("/leads")} data-testid="button-back-to-leads-merged">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Leads
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden">
      <LeadHeader lead={lead} onBack={() => setLocation("/leads")} />
      <IntelligenceStrip lead={lead} />
      {lead.handoverStatus === "Pending" && <HandoverBanner lead={lead} />}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto lg:border-r border-border">
          <LeadJourneyFunnel status={lead.status} leadId={lead.id} />
          <AppointmentInfoCard leadId={lead.id} leadStatus={lead.status} />
          <JourneySnapshot leadId={lead.id} />
          <DemographicsSection lead={lead} />
          <TreatmentJourneyTimeline leadId={lead.id} />
          <UnifiedJourneyTimeline leadId={lead.id} />
        </div>
        <div className="w-full lg:w-80 min-h-0 flex flex-col overflow-y-auto bg-muted/20 border-t lg:border-t-0 shrink-0">
          <NextActionPanel lead={lead} />
          <TasksPanel leadId={lead.id} />
          <OwnershipCard lead={lead} />
          <QuickActions lead={lead} />
          <ContactPersonsPanel leadId={lead.id} lead={lead} />
          <TemperatureHistory leadId={lead.id} />
          <HandoverHistory leadId={lead.id} />
          <CommunicationPreferencesPanel leadId={lead.id} />
          <ConsentBadge lead={lead} />
        </div>
      </div>
    </AppLayout>
  );
}

function LeadJourneyFunnel({ status, leadId }: { status: string; leadId: number }) {
  const { data: episodes } = useEpisodes(leadId);
  const latestEpisode = episodes && episodes.length > 0 ? episodes[episodes.length - 1] : null;
  const episodeStatus = latestEpisode?.status || null;

  const rawFurthest = episodeStatus || status;
  const STATUS_MAP: Record<string, string> = { "Reminder Running": "Appointment Booked", "Consultation In Progress": "Consultation Done" };
  const furthestStatus = STATUS_MAP[rawFurthest] || rawFurthest;
  const hasEpisode = !!episodeStatus;
  const stages = hasEpisode ? UNIFIED_JOURNEY_STAGES : LEAD_FUNNEL_STAGES as unknown as string[];
  const currentStageIndex = stages.indexOf(furthestStatus);
  const isTerminal = LEAD_TERMINAL_STATUSES.includes(status) || LEAD_TERMINAL_STATUSES.includes(episodeStatus || "");
  const leadPhaseEnd = stages.indexOf("Consultation Done");

  return (
    <Card className="mx-4 mt-4 p-4" data-testid={`card-lead-funnel-${leadId}`}>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        Patient Journey
      </h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const isCurrent = stage === furthestStatus;
          const isPast = currentStageIndex >= 0 && idx < currentStageIndex;
          const isEpisodePhase = idx > leadPhaseEnd;
          return (
            <div key={stage} className="flex items-center shrink-0">
              <div
                className={cn(
                  "px-2.5 py-1.5 rounded text-[10px] font-medium whitespace-nowrap border transition-colors",
                  isCurrent && !isEpisodePhase && "bg-primary text-primary-foreground border-primary",
                  isCurrent && isEpisodePhase && "bg-violet-600 text-white border-violet-600",
                  isPast && !isCurrent && "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
                  !isCurrent && !isPast && "bg-muted text-muted-foreground border-border",
                )}
                data-testid={`funnel-stage-${stage.toLowerCase().replace(/\s+/g, "-")}-${leadId}`}
              >
                {stage}
              </div>
              {idx < stages.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mx-0.5 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      {isTerminal && (
        <div className="mt-2">
          <Badge className={cn("text-xs", getStatusColor(episodeStatus || status))} data-testid={`badge-terminal-status-${leadId}`}>
            {episodeStatus || status}
          </Badge>
        </div>
      )}
    </Card>
  );
}

function LeadHeader({ lead, onBack }: { lead: any; onBack: () => void }) {
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const { data: masterLeadStatuses } = useLeadStatuses();
  const { data: leadSources } = useQuery<any[]>({
    queryKey: ["/api/masters/leadSources"],
    queryFn: async () => {
      const res = await fetch("/api/masters/leadSources", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const sourceName = lead.leadSourceId
    ? leadSources?.find((s: any) => s.id === lead.leadSourceId)?.name
    : (lead.tags?.toLowerCase().includes("callyzer") ? "Telephony" : null);
  const allStatuses = (masterLeadStatuses || [])
    .filter((s: any) => s.status === "Active")
    .map((s: any) => s.name);
  const validTransitions = allStatuses.filter((s: string) => s !== lead.status);

  const handleStatusChange = (newStatus: string) => {
    updateLead.mutate({ id: lead.id, status: newStatus });
  };

  const slaBreached = lead.slaBreached;
  const slaDeadline = lead.slaDeadline ? new Date(lead.slaDeadline) : null;
  const slaExpired = slaDeadline ? isPast(slaDeadline) : false;

  return (
    <div className="p-3 md:p-4 border-b border-border bg-card">
      <div className="flex items-center gap-2 md:gap-3 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <h1 className="text-lg md:text-xl font-bold text-foreground truncate" data-testid="text-lead-name">{lead.name}</h1>
            <span className="text-xs font-mono text-muted-foreground" data-testid="text-lead-id">#{lead.id}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={cn("text-xs", getStatusColor(lead.status))} data-testid="badge-status">
          {lead.status}
        </Badge>

        {sourceName && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-source">
            <Globe className="w-3 h-3" />
            {sourceName}
          </Badge>
        )}

        {(() => {
          const dbTemp = lead.leadTemperature as string | null;
          const temp = dbTemp || getLeadTemperature(lead);
          if (!temp) return null;
          const TempIcon = temp === "Hot" || temp === "Very Hot" ? Flame : temp === "Warm" || temp === "Warm+" || temp === "Warm++" ? Sun : temp === "Dormant" ? Ban : Snowflake;
          return (
            <Badge className={cn("text-xs", getTemperatureColor(temp === "Very Hot" || temp === "Warm+" || temp === "Warm++" ? (temp === "Very Hot" ? "Hot" : "Warm") : temp === "Dormant" ? "Cold" : temp as any))} data-testid="badge-temperature">
              <TempIcon className="w-3 h-3 mr-0.5" />
              {temp}
            </Badge>
          );
        })()}

        {lead.ownerTeam && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-owner-team">
            <Users className="w-3 h-3" />
            {lead.ownerTeam}
          </Badge>
        )}

        {lead.leadAgeingDays != null && lead.leadAgeingDays > 0 && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-ageing-days">
            <CalendarClock className="w-3 h-3" />
            {lead.leadAgeingDays}d old
          </Badge>
        )}

        {lead.noShowCount != null && lead.noShowCount > 0 && (
          <Badge variant="outline" className={cn("text-xs gap-1", lead.noShowCount >= 2 ? "bg-red-50 text-red-700 border-red-200" : "")} data-testid="badge-no-show-count">
            <Ban className="w-3 h-3" />
            {lead.noShowCount} No-Show{lead.noShowCount > 1 ? "s" : ""}
          </Badge>
        )}

        {lead.rescheduleCount != null && lead.rescheduleCount > 0 && (
          <Badge variant="outline" className={cn("text-xs gap-1", lead.rescheduleCount >= 2 ? "bg-amber-50 text-amber-700 border-amber-200" : "")} data-testid="badge-reschedule-count">
            <RefreshCw className="w-3 h-3" />
            {lead.rescheduleCount} Reschedule{lead.rescheduleCount > 1 ? "s" : ""}
          </Badge>
        )}

        {lead.leadScore !== null && lead.leadScore !== undefined && lead.leadScore > 0 && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-score">
            <TrendingUp className="w-3 h-3" />
            Score: {lead.leadScore}
          </Badge>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
          <Phone className="w-3 h-3" />
          <span data-testid="text-phone">{lead.phoneE164 || <span className="italic">No direct phone</span>}</span>
          {lead.phoneOwnerRelationship && lead.phoneOwnerRelationship !== "Self" && (
            <Badge variant="outline" className="text-[9px] py-0 px-1" data-testid="badge-phone-owner-rel">
              {lead.phoneOwnerRelationship}
            </Badge>
          )}
        </div>

        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span data-testid="text-email">{lead.email}</span>
          </div>
        )}

        {(slaBreached || slaExpired) && (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 gap-1" data-testid="badge-sla-breached">
            <AlertTriangle className="w-3 h-3" />
            SLA Breached
          </Badge>
        )}

        {slaDeadline && !slaExpired && !slaBreached && (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 gap-1" data-testid="badge-sla-timer">
            <Clock className="w-3 h-3" />
            SLA: {formatDistanceToNow(slaDeadline)}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {validTransitions.length > 0 && (
            <SearchableSelect
              value=""
              onValueChange={handleStatusChange}
              options={validTransitions.map((s) => ({ value: s, label: s }))}
              placeholder="Change Status"
              triggerClassName="w-44 h-8 text-xs"
              data-testid="select-change-status"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HandoverBanner({ lead }: { lead: any }) {
  const handoverAction = useHandoverAction();
  const { data: crmUsers } = useActiveCrmUsers();
  const { crmUser } = useCurrentUser();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Only the intended recipient sees this banner
  if (crmUser && lead.handoverToUserId && crmUser.id !== lead.handoverToUserId) return null;

  const handleAccept = () => {
    handoverAction.mutate(
      { leadId: lead.id, action: "accept" },
      {
        onSuccess: () => toast({ title: "Handover accepted" }),
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    handoverAction.mutate(
      { leadId: lead.id, action: "reject", rejectionReason },
      {
        onSuccess: () => {
          toast({ title: "Handover rejected" });
          setRejectDialogOpen(false);
          setRejectionReason("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const slaDeadline = lead.slaDeadline ? new Date(lead.slaDeadline) : null;
  const slaExpired = slaDeadline ? isPast(slaDeadline) : false;

  return (
    <div className={cn(
      "px-4 py-3 flex items-center gap-3 flex-wrap border-b border-border",
      slaExpired ? "bg-red-50 dark:bg-red-950/30" : "bg-amber-50 dark:bg-amber-950/30"
    )} data-testid="banner-handover">
      <Shield className={cn("w-5 h-5 shrink-0", slaExpired ? "text-red-600" : "text-amber-600")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", slaExpired ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300")}>
          Pending Handover
          {lead.handoverFromUserId && (
            <span className="font-normal">
              {" from "}
              {crmUsers?.find((u: any) => u.id === lead.handoverFromUserId)?.name || `User #${lead.handoverFromUserId}`}
            </span>
          )}
        </p>
        {slaDeadline && (
          <p className={cn("text-xs", slaExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
            {slaExpired ? "SLA breached - " : "Accept within "}
            {formatDistanceToNow(slaDeadline, { addSuffix: true })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={handoverAction.isPending}
          data-testid="button-accept-handover"
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Accept
        </Button>
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={handoverAction.isPending}
              data-testid="button-reject-handover"
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Handover</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason for rejection</label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why are you rejecting this handover?"
                  rows={3}
                  data-testid="input-rejection-reason"
                />
              </div>
              <Button onClick={handleReject} variant="destructive" className="w-full" disabled={handoverAction.isPending} data-testid="button-confirm-reject">
                Confirm Rejection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function AppointmentInfoCard({ leadId, leadStatus }: { leadId: number; leadStatus: string }) {
  const { data: journeyData } = useQuery<any>({
    queryKey: ["/api/leads", leadId, "journey"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/journey`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const appt = journeyData?.upcomingAppointment;
  if (!appt) return null;

  const apptDate = appt.appointmentDate ? new Date(appt.appointmentDate) : null;
  const isApptPast = apptDate ? isPast(apptDate) : false;
  const isCheckedIn = !!appt.checkedInAt;

  return (
    <Card className={cn(
      "mx-4 mt-2 p-3",
      isApptPast && !isCheckedIn ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-primary/30 bg-primary/5"
    )} data-testid="appointment-info-card">
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          {appt.appointmentTypeName || "Appointment"}
        </span>
        {appt.doctorName && (
          <span className="text-xs text-muted-foreground">with Dr. {appt.doctorName}</span>
        )}
        {apptDate && (
          <Badge variant="outline" className={cn(
            "text-[10px]",
            isApptPast && !isCheckedIn ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-primary/10 text-primary border-primary/30"
          )} data-testid="badge-appointment-date">
            <Calendar className="w-2.5 h-2.5 mr-0.5" />
            {fmtDate(apptDate)}
          </Badge>
        )}
        {appt.startTime && (
          <Badge variant="outline" className="text-[10px]" data-testid="badge-appointment-time">
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {appt.startTime}
          </Badge>
        )}
        {appt.tokenNumber && (
          <Badge variant="outline" className="text-[10px]">Token #{appt.tokenNumber}</Badge>
        )}
        <Badge className={cn("text-[10px]",
          appt.status === "Scheduled" ? "bg-blue-100 text-blue-700" :
          appt.status === "Confirmed" ? "bg-green-100 text-green-700" :
          appt.status === "No Show" ? "bg-red-100 text-red-700" :
          "bg-gray-100 text-gray-700"
        )} data-testid="badge-appointment-status">
          {appt.status}
        </Badge>
        {isCheckedIn && (
          <Badge className="text-[10px] bg-green-100 text-green-700" data-testid="badge-checked-in">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
            Checked In
          </Badge>
        )}
        {isApptPast && !isCheckedIn && (
          <Badge className="text-[10px] bg-amber-100 text-amber-700" data-testid="badge-appt-past">
            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
            Date Passed - Possible No Show
          </Badge>
        )}
        {appt.branchName && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            <Building className="w-2.5 h-2.5 inline mr-0.5" />
            {appt.branchName}
          </span>
        )}
      </div>
    </Card>
  );
}

function IntelligenceStrip({ lead }: { lead: any }) {
  const { data: episodes } = useEpisodes(lead.id);

  const leadAgeDays = lead.createdAt
    ? Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const reschedules = lead.rescheduleCount ?? 0;
  const noShows = lead.noShowCount ?? 0;
  const frt = lead.firstResponseTimeMinutes;
  const frtDisplay = frt != null ? `${frt}m` : "-";
  const episodesCount = episodes?.length ?? 0;
  const avgProbability = episodes && episodes.length > 0
    ? Math.round(episodes.reduce((sum: number, ep: any) => sum + (ep.revenueProbability || 0), 0) / episodes.length)
    : null;

  const metrics = [
    { label: "Lead Age", value: `${leadAgeDays}d`, icon: CalendarClock, testId: "metric-lead-age", tooltip: "Days since lead was created" },
    { label: "Reschedules", value: String(reschedules), icon: RefreshCw, testId: "metric-reschedules", tooltip: "Number of appointment reschedules" },
    { label: "No Shows", value: String(noShows), icon: Ban, testId: "metric-no-shows", tooltip: "Number of missed appointments (no check-in)" },
    { label: "FRT", value: frtDisplay, icon: Zap, testId: "metric-frt", tooltip: "First Response Time — minutes between lead creation and first contact" },
    { label: "Episodes", value: String(episodesCount), icon: Hash, testId: "metric-episodes-count", tooltip: "Total treatment episodes linked to this lead" },
    { label: "Avg Prob%", value: avgProbability != null ? `${avgProbability}%` : "-", icon: Percent, testId: "metric-avg-probability", tooltip: "Average revenue probability across all episodes" },
  ];

  return (
    <div className="px-3 md:px-4 py-2 border-b border-border bg-muted/30" data-testid="intelligence-strip">
      <div className="flex items-center gap-2 flex-wrap">
        <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1" title="Key metrics about this lead's journey and engagement">Intelligence</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {metrics.map((m) => (
            <div
              key={m.testId}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border text-xs cursor-default"
              data-testid={m.testId}
              title={m.tooltip}
            >
              <m.icon className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">{m.label}:</span>
              <span className="font-medium text-foreground">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnershipCard({ lead }: { lead: any }) {
  const { data: crmUsers } = useActiveCrmUsers();

  const primaryOwnerName = lead.primaryOwnerUserId && crmUsers
    ? crmUsers.find((u) => u.id === lead.primaryOwnerUserId)?.name || `User #${lead.primaryOwnerUserId}`
    : null;
  const assignedToName = lead.assignedCrmUserId && crmUsers
    ? crmUsers.find((u) => u.id === lead.assignedCrmUserId)?.name || `User #${lead.assignedCrmUserId}`
    : null;

  const infoRow = (label: string, value: string | null, testId: string) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground" data-testid={testId}>{value || "-"}</span>
    </div>
  );

  return (
    <div className="p-4 border-b border-border" data-testid="ownership-card">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        Ownership
      </h3>
      <Card className="p-3">
        <div className="divide-y divide-border">
          {infoRow("Current Team", lead.ownerTeam || null, "text-owner-team")}
          {infoRow("Primary Owner", primaryOwnerName, "text-primary-owner")}
          {infoRow("Assigned To", assignedToName, "text-assigned-to")}
          {infoRow("Last Handover", lead.lastHandoverAt ? fmtDateTime(lead.lastHandoverAt) : null, "text-last-handover")}
        </div>
      </Card>
    </div>
  );
}

function ActivityTimeline({ leadId }: { leadId: number }) {
  const { data: activities, isLoading } = useLeadActivities(leadId);
  const createActivity = useCreateActivity();
  const [text, setText] = useState("");
  const [activityType, setActivityType] = useState("note");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    createActivity.mutate({
      leadId,
      data: {
        leadId,
        type: activityType,
        description: text,
        tenantId: 1,
        createdBy: "placeholder",
      },
    });
    setText("");
  };

  return (
    <>
      <div className="p-4 border-b border-border bg-card">
        <h3 className="font-semibold text-sm text-foreground">Activity Timeline</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
        ) : !activities?.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No activity recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Activity;
              const isStatusChange = activity.type === "status_change" || (activity.oldStatus && activity.newStatus);
              return (
                <div key={activity.id} className="flex gap-3" data-testid={`activity-${activity.id}`}>
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      ACTIVITY_COLORS[activity.type] || "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold uppercase text-foreground/70">{activity.type.replace(/_/g, " ")}</span>
                      {["whatsapp", "sms", "email", "call"].includes(activity.type) && (
                        <Badge variant="outline" className={cn("text-[10px] gap-0.5",
                          activity.type === "whatsapp" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          activity.type === "call" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          activity.type === "email" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-cyan-50 text-cyan-700 border-cyan-200"
                        )}>
                          <Icon className="w-2.5 h-2.5" />
                          {activity.type === "whatsapp" ? "WhatsApp" : activity.type === "sms" ? "SMS" : activity.type === "call" ? "Call" : "Email"}
                        </Badge>
                      )}
                      {activity.outcome && (
                        <Badge variant="outline" className="text-[10px]">{activity.outcome}</Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {activity.createdAt && fmtDateTimeShort(activity.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{activity.description}</p>
                    {isStatusChange && activity.oldStatus && activity.newStatus && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <Badge className={cn("text-[10px]", getStatusColor(activity.oldStatus))}>{activity.oldStatus}</Badge>
                        <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                        <Badge className={cn("text-[10px]", getStatusColor(activity.newStatus))}>{activity.newStatus}</Badge>
                      </div>
                    )}
                    {activity.type === "temperature_change" && activity.metadata && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {(activity.metadata as any).previousTemperature && (
                          <>
                            <Badge variant="outline" className="text-[10px]">{(activity.metadata as any).previousTemperature}</Badge>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge variant="outline" className="text-[10px]">{(activity.metadata as any).newTemperature}</Badge>
                      </div>
                    )}
                    {activity.type === "call" && (activity.callDurationSeconds || activity.callDirection) && (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {activity.callDurationSeconds != null && (
                            <span>Duration: {Math.floor(activity.callDurationSeconds / 60)}m {activity.callDurationSeconds % 60}s</span>
                          )}
                          {activity.callDirection && <span> | {activity.callDirection}</span>}
                        </p>
                        {activity.metadata && (activity.metadata as any).source === "callyzer" && (
                          <div className="bg-muted/50 rounded-md p-2 space-y-1 border border-border/50">
                            {(activity.metadata as any).empName && (
                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground/80">Employee:</span>{" "}
                                {(activity.metadata as any).empName}
                                {(activity.metadata as any).empNumber && ` (${(activity.metadata as any).empNumber})`}
                              </p>
                            )}
                            {(activity.metadata as any).callTimestamp && (
                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground/80">Call Time:</span>{" "}
                                {(() => { try { return fmtDateTime((activity.metadata as any).callTimestamp); } catch { return (activity.metadata as any).callTimestamp; } })()}
                              </p>
                            )}
                            {(activity.metadata as any).notes && (
                              <p className="text-xs text-foreground/80 mt-1 italic border-l-2 border-primary/30 pl-2">
                                {(activity.metadata as any).notes}
                              </p>
                            )}
                            {(activity.metadata as any).noteUpdatedAt && (
                              <p className="text-[10px] text-muted-foreground/70">
                                Note updated: {(() => { try { return fmtDateTime((activity.metadata as any).noteUpdatedAt); } catch { return (activity.metadata as any).noteUpdatedAt; } })()}
                              </p>
                            )}
                            {(activity.metadata as any).callyzerLeadStatus && (
                              <p className="text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground/80">Telephony Status:</span>{" "}
                                {(activity.metadata as any).callyzerLeadStatus}
                                {(activity.metadata as any).callyzerLeadStatusDate && (
                                  <span className="text-[10px]"> ({(() => { try { return fmtDateTime((activity.metadata as any).callyzerLeadStatusDate); } catch { return (activity.metadata as any).callyzerLeadStatusDate; } })()})</span>
                                )}
                              </p>
                            )}
                            {(activity.metadata as any).recordingUrl && (
                              <a
                                href={(activity.metadata as any).recordingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                                data-testid="link-call-recording"
                              >
                                🎙 Listen to recording
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {activity.type !== "call" && activity.callDurationSeconds != null && activity.callDurationSeconds > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Duration: {Math.floor(activity.callDurationSeconds / 60)}m {activity.callDurationSeconds % 60}s
                        {activity.callDirection && ` | ${activity.callDirection}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <SearchableSelect
            value={activityType}
            onValueChange={setActivityType}
            options={[
              { value: "note", label: "Note" },
              { value: "call", label: "Call" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
            ]}
            triggerClassName="w-24 h-8 text-xs"
            data-testid="select-activity-type"
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Log activity..."
            className="flex-1 h-8 text-sm"
            data-testid="input-activity-text"
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={createActivity.isPending} data-testid="button-submit-activity">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

function NextActionPanel({ lead }: { lead: any }) {
  const updateLead = useUpdateLead();
  const { crmUser } = useCurrentUser();
  const { data: activeCrmUsers = [] } = useActiveCrmUsers();
  const [editing, setEditing] = useState(false);
  const [nextActionDate, setNextActionDate] = useState(lead.nextActionDate ? format(new Date(lead.nextActionDate), "yyyy-MM-dd'T'HH:mm") : "");
  const [nextActionNotes, setNextActionNotes] = useState(lead.nextActionNotes || "");
  const defaultAssignee = lead.nextActionAssignedTo ? String(lead.nextActionAssignedTo) : (crmUser?.id ? String(crmUser.id) : "");
  const [nextActionAssignedTo, setNextActionAssignedTo] = useState(defaultAssignee);

  useEffect(() => {
    if (!nextActionAssignedTo && crmUser?.id) {
      setNextActionAssignedTo(String(crmUser.id));
    }
  }, [crmUser?.id]);

  const handleSave = () => {
    const assignedTo = nextActionAssignedTo ? Number(nextActionAssignedTo) : (crmUser?.id || null);
    updateLead.mutate({
      id: lead.id,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : undefined,
      nextActionNotes: nextActionNotes || null,
      nextActionAssignedTo: assignedTo,
    } as any);
    setEditing(false);
  };

  const hasNextAction = lead.nextActionDate || lead.nextActionNotes;
  const assigneeName = lead.nextActionAssignedTo
    ? activeCrmUsers.find((u: any) => u.id === lead.nextActionAssignedTo)?.name
    : null;

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Next Action
        </h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(!editing)} data-testid="button-edit-next-action">
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <SearchableSelect
            value={nextActionAssignedTo}
            onValueChange={setNextActionAssignedTo}
            options={activeCrmUsers.map((u: any) => ({ value: String(u.id), label: u.name }))}
            placeholder="Assign To (default: self)"
            triggerClassName="text-xs"
            data-testid="select-next-action-assigned-to"
          />
          <Input
            type="datetime-local"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
            className="text-xs"
            data-testid="input-next-action-date"
          />
          <Textarea
            value={nextActionNotes}
            onChange={(e) => setNextActionNotes(e.target.value)}
            placeholder="Notes..."
            className="text-xs resize-none"
            rows={2}
            data-testid="input-next-action-notes"
          />
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave} disabled={updateLead.isPending} data-testid="button-save-next-action">
            Save
          </Button>
        </div>
      ) : hasNextAction ? (
        <Card className="p-3">
          {lead.nextActionDate && (
            <div className="flex items-center gap-2 text-xs mb-1">
              <Calendar className="w-3 h-3 text-primary" />
              <span className="font-medium">{fmtDateTime(lead.nextActionDate)}</span>
              {isPast(new Date(lead.nextActionDate)) && (
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Overdue</Badge>
              )}
            </div>
          )}
          {assigneeName && (
            <p className="text-[11px] text-primary font-medium mt-1">Assigned to: {assigneeName}</p>
          )}
          {lead.nextActionNotes && (
            <p className="text-xs text-muted-foreground mt-1">{lead.nextActionNotes}</p>
          )}
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">No next action set.</p>
      )}
    </div>
  );
}

function TasksPanel({ leadId }: { leadId: number }) {
  const { data: leadTasks, isLoading } = useTasks(leadId);
  const updateTask = useUpdateTask();
  const [nurtureOutcomeTaskId, setNurtureOutcomeTaskId] = useState<number | null>(null);

  const pendingTasks = leadTasks?.filter((t) => t.status !== "Completed" && t.status !== "Cancelled") || [];

  const isNurtureTask = (task: any) => {
    return task.title?.startsWith("Nurture Follow-up");
  };

  const handleComplete = (taskId: number, task: any) => {
    if (isNurtureTask(task)) {
      setNurtureOutcomeTaskId(taskId);
      return;
    }
    updateTask.mutate({ id: taskId, status: "Completed" });
  };

  const handleNurtureOutcome = (outcome: string) => {
    if (!nurtureOutcomeTaskId) return;
    updateTask.mutate({
      id: nurtureOutcomeTaskId,
      status: "Completed",
      nurtureOutcome: outcome,
    } as any);
    setNurtureOutcomeTaskId(null);
  };

  return (
    <div className="p-4 border-b border-border">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <CheckSquare className="w-4 h-4 text-primary" />
        Tasks ({pendingTasks.length})
      </h3>

      {nurtureOutcomeTaskId && (
        <Card className="p-3 mb-3 border-primary/30 bg-primary/5" data-testid="nurture-outcome-dialog">
          <p className="text-xs font-medium text-foreground mb-2">What was the nurture outcome?</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="text-[10px] h-7 bg-green-50 border-green-200 text-green-700 hover:bg-green-100" onClick={() => handleNurtureOutcome("interested")} data-testid="button-nurture-interested">
              Interested
            </Button>
            <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handleNurtureOutcome("follow_up")} data-testid="button-nurture-followup">
              Follow Up Later
            </Button>
            <Button size="sm" variant="outline" className="text-[10px] h-7 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => handleNurtureOutcome("not_reached")} data-testid="button-nurture-not-reached">
              Not Reached
            </Button>
            <Button size="sm" variant="outline" className="text-[10px] h-7 bg-red-50 border-red-200 text-red-700 hover:bg-red-100" onClick={() => handleNurtureOutcome("closed")} data-testid="button-nurture-closed">
              Not Needed / Treated Elsewhere
            </Button>
            <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => setNurtureOutcomeTaskId(null)} data-testid="button-nurture-cancel">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : pendingTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending tasks.</p>
      ) : (
        <div className="space-y-2">
          {pendingTasks.slice(0, 8).map((task) => (
            <Card key={task.id} className={cn("p-2", isNurtureTask(task) && "border-l-2 border-l-cyan-400")} data-testid={`task-${task.id}`}>
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleComplete(task.id, task)}
                  className="mt-0.5 w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 hover:bg-primary/10"
                  data-testid={`button-complete-task-${task.id}`}
                >
                  <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                  {task.description && isNurtureTask(task) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.dueDate && (
                      <p className={cn("text-[10px]", isPast(new Date(task.dueDate)) ? "text-red-500 font-medium" : "text-muted-foreground")}>
                        Due: {fmtDateShort(task.dueDate)}
                        {isPast(new Date(task.dueDate)) && " (Overdue)"}
                      </p>
                    )}
                    {(task as any).assignedToName && (
                      <p className="text-[10px] text-muted-foreground" data-testid={`task-owner-${task.id}`}>
                        <User className="w-2.5 h-2.5 inline mr-0.5" />
                        {(task as any).assignedToName}
                      </p>
                    )}
                  </div>
                </div>
                {task.priority === "Urgent" && <Badge className="text-[10px] bg-rose-100 text-rose-700 border-rose-200">Urgent</Badge>}
                {task.priority === "High" && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">High</Badge>}
                {isNurtureTask(task) && <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border-cyan-200">Nurture</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickActions({ lead }: { lead: any }) {
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const updateLead = useUpdateLead();
  const assignLead = useAssignLead();
  const createAppointment = useCreateAppointment();
  const { data: crmUsers } = useActiveCrmUsers();
  const { data: doctorsList } = useDoctors();
  const { data: nextActionTypes } = useNextActionTypes();
  const { data: masterLeadStatuses } = useLeadStatuses();
  const { toast } = useToast();
  const allStatuses = (masterLeadStatuses || [])
    .filter((s: any) => s.status === "Active")
    .map((s: any) => s.name);
  const validTransitions = allStatuses.filter((s: string) => s !== lead.status);

  const { data: branchesList } = useQuery<any[]>({ queryKey: ["/api/masters", "branches"] });
  const activeBranches = (branchesList || []).filter((b: any) => b.status === "Active" && (b.approvalStatus === "Approved" || !b.approvalStatus));

  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [callOutcomeOther, setCallOutcomeOther] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callNextActionTypeId, setCallNextActionTypeId] = useState("");
  const [callNextActionDate, setCallNextActionDate] = useState("");
  const [callNextActionNotes, setCallNextActionNotes] = useState("");
  const [callStatusChange, setCallStatusChange] = useState(lead.status || "");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("Normal");
  const [selectedCrmUserId, setSelectedCrmUserId] = useState("");
  const [handoverReason, setHandoverReason] = useState("");
  const [apptBranchId, setApptBranchId] = useState("");
  const [apptDoctorId, setApptDoctorId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptSlot, setApptSlot] = useState("");
  const [apptManualTime, setApptManualTime] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  const effectiveApptTime = apptSlot || apptManualTime;

  useEffect(() => {
    if (apptDialogOpen && activeBranches.length === 1) {
      setApptBranchId(String(activeBranches[0].id));
    }
  }, [apptDialogOpen, activeBranches.length]);

  const { data: availability, isLoading: availLoading } = useDoctorAvailability(
    apptDoctorId ? Number(apptDoctorId) : null,
    apptDate || null
  );

  const effectiveStatusChange = callStatusChange && callStatusChange !== "__none__" && callStatusChange !== lead.status ? callStatusChange : null;
  const effectiveNextActionTypeId = callNextActionTypeId && callNextActionTypeId !== "__none__" ? Number(callNextActionTypeId) : null;

  const handleLogCall = async () => {
    const finalOutcome = callOutcome === "__other__" ? callOutcomeOther.trim() : callOutcome;
    if (callOutcome === "__other__" && !callOutcomeOther.trim()) {
      toast({ title: "Please enter the outcome", variant: "destructive" });
      return;
    }

    if (callOutcome === "__other__" && callOutcomeOther.trim()) {
      try {
        await fetch("/api/field-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fieldName: "Call Outcome",
            suggestedValue: callOutcomeOther.trim(),
            targetTable: "call_outcomes",
          }),
        });
      } catch (e) {}
    }

    const activityData: any = {
      leadId: lead.id,
      type: "call",
      description: callNotes || "Phone call",
      outcome: finalOutcome || undefined,
      callDurationSeconds: callDuration ? parseInt(callDuration) * 60 : undefined,
      callDirection: "Outbound",
      tenantId: 1,
      createdBy: "placeholder",
    };
    if (effectiveNextActionTypeId) activityData.nextActionTypeId = effectiveNextActionTypeId;
    if (callNextActionDate) activityData.nextActionDate = new Date(callNextActionDate);
    if (callNextActionNotes) activityData.nextActionNotes = callNextActionNotes;
    if (effectiveStatusChange) {
      activityData.oldStatus = lead.status;
      activityData.newStatus = effectiveStatusChange;
    }

    createActivity.mutate({
      leadId: lead.id,
      data: activityData,
    }, {
      onSuccess: () => {
        const leadUpdates: any = {};
        if (effectiveNextActionTypeId) leadUpdates.nextActionTypeId = effectiveNextActionTypeId;
        if (callNextActionDate) leadUpdates.nextActionDate = new Date(callNextActionDate);
        if (callNextActionNotes) leadUpdates.nextActionNotes = callNextActionNotes;
        if (effectiveStatusChange) leadUpdates.status = effectiveStatusChange;

        if (Object.keys(leadUpdates).length > 0) {
          updateLead.mutate({ id: lead.id, ...leadUpdates }, {
            onError: (err) => {
              toast({ title: "Call logged but lead update failed", description: err.message, variant: "destructive" });
            },
          });
        }

        setCallNotes("");
        setCallOutcome("");
        setCallOutcomeOther("");
        setCallDuration("");
        setCallNextActionTypeId("");
        setCallNextActionDate("");
        setCallNextActionNotes("");
        setCallStatusChange("");
        setCallDialogOpen(false);
        toast({ title: "Call logged" });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleCreateTask = () => {
    if (!taskTitle.trim() || !taskDueDate) return;
    createTask.mutate({
      leadId: lead.id,
      title: taskTitle,
      dueDate: new Date(taskDueDate),
      priority: taskPriority,
      status: "Pending",
      tenantId: 1,
    }, {
      onSuccess: () => {
        setTaskTitle("");
        setTaskDueDate("");
        setTaskPriority("Normal");
        setTaskDialogOpen(false);
        toast({ title: "Task created" });
      },
      onError: (err) => {
        toast({ title: "Error creating task", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3">Quick Actions</h3>
      <div className="space-y-2">
        <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-log-call">
              <Phone className="w-4 h-4 mr-2" />
              Log Call
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Call</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Outcome</label>
                <SearchableSelect
                  value={callOutcome}
                  onValueChange={(val) => {
                    setCallOutcome(val);
                    if (val !== "__other__") setCallOutcomeOther("");
                  }}
                  options={[
                    { value: "Connected", label: "Connected" },
                    { value: "No Answer", label: "No Answer" },
                    { value: "Busy", label: "Busy" },
                    { value: "Voicemail", label: "Voicemail" },
                    { value: "Wrong Number", label: "Wrong Number" },
                    { value: "__other__", label: "Other (type below)" },
                  ]}
                  placeholder="Select outcome"
                  data-testid="select-call-outcome"
                />
                {callOutcome === "__other__" && (
                  <Input
                    className="mt-2 text-xs"
                    value={callOutcomeOther}
                    onChange={(e) => setCallOutcomeOther(e.target.value)}
                    placeholder="Type custom outcome..."
                    data-testid="input-call-outcome-other"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <Input
                  type="number"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="0"
                  data-testid="input-call-duration"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes..."
                  rows={2}
                  data-testid="input-call-notes"
                />
              </div>

              {allStatuses.length > 0 && (
                <div className="border-t border-border pt-3">
                  <label className="text-xs font-medium text-muted-foreground">Change Status (optional)</label>
                  <SearchableSelect
                    value={callStatusChange}
                    onValueChange={setCallStatusChange}
                    options={allStatuses.map((s: string) => ({ value: s, label: s }))}
                    placeholder="Select status"
                    data-testid="select-call-status-change"
                  />
                </div>
              )}

              <div className="border-t border-border pt-3">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  Next Action
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <SearchableSelect
                      value={callNextActionTypeId}
                      onValueChange={setCallNextActionTypeId}
                      options={[
                        { value: "__none__", label: "None" },
                        ...(nextActionTypes || []).filter((t: any) => t.status === "Active").map((t: any) => ({ value: String(t.id), label: t.name })),
                      ]}
                      placeholder="Select next action type"
                      data-testid="select-call-next-action-type"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={callNextActionDate}
                      onChange={(e) => setCallNextActionDate(e.target.value)}
                      className="text-xs"
                      data-testid="input-call-next-action-date"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Next Action Notes</label>
                    <Textarea
                      value={callNextActionNotes}
                      onChange={(e) => setCallNextActionNotes(e.target.value)}
                      placeholder="What needs to happen next..."
                      rows={2}
                      className="text-xs"
                      data-testid="input-call-next-action-notes"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleLogCall} className="w-full" disabled={createActivity.isPending} data-testid="button-submit-call">
                Log Call
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-create-task">
              <CheckSquare className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                <Input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  data-testid="input-task-due-date"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <SearchableSelect
                  value={taskPriority}
                  onValueChange={setTaskPriority}
                  options={[
                    { value: "Low", label: "Low" },
                    { value: "Normal", label: "Normal" },
                    { value: "High", label: "High" },
                  ]}
                  data-testid="select-task-priority"
                />
              </div>
              <Button onClick={handleCreateTask} className="w-full" disabled={createTask.isPending || !taskTitle.trim() || !taskDueDate} data-testid="button-submit-task">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-book-appointment">
              <Calendar className="w-4 h-4 mr-2" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {activeBranches.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Branch *</label>
                  <SearchableSelect
                    value={apptBranchId}
                    onValueChange={setApptBranchId}
                    options={activeBranches.map((b: any) => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select branch"
                    data-testid="select-appt-branch"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Doctor</label>
                <SearchableSelect
                  value={apptDoctorId}
                  onValueChange={(v) => { setApptDoctorId(v); setApptSlot(""); }}
                  options={(doctorsList || []).map((d: any) => ({ value: String(d.id), label: `${d.name}${d.specialization ? ` (${d.specialization})` : ""}` }))}
                  placeholder="Select doctor"
                  data-testid="select-appt-doctor"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={apptDate}
                  onChange={(e) => { setApptDate(e.target.value); setApptSlot(""); }}
                  min={new Date().toISOString().split("T")[0]}
                  data-testid="input-appt-date"
                />
              </div>
              {apptDoctorId && apptDate && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Appointment Time *</label>
                  {availLoading ? (
                    <p className="text-xs text-muted-foreground py-2">Loading slots...</p>
                  ) : availability && !availability.available ? (
                    <p className="text-xs text-destructive py-2">{availability.reason}</p>
                  ) : availability && availability.individualSlots && availability.individualSlots.length > 0 ? (
                    <div className="mt-1 space-y-2 max-h-60 overflow-y-auto" data-testid="slot-grid-individual">
                      {availability.windows?.map((win) => {
                        const fmt12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`; };
                        const winSlots = (availability.individualSlots || []).filter((s: IndividualSlot) => s.windowStart === win.startTime);
                        const freeCount = winSlots.filter((s: IndividualSlot) => !s.isBooked).length;
                        return (
                          <div key={win.startTime} className="border rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50/60 border-b">
                              <span className="text-[11px] font-semibold text-primary">{fmt12(win.startTime)} – {fmt12(win.endTime)}</span>
                              <span className={cn("text-[10px] font-medium", freeCount > 0 ? "text-green-600" : "text-muted-foreground")}>
                                {freeCount > 0 ? `${freeCount} free` : "Full"}
                              </span>
                            </div>
                            <div className="p-2 flex flex-wrap gap-1.5 bg-white">
                              {winSlots.map((slot: IndividualSlot) => (
                                <button
                                  key={slot.startTime}
                                  disabled={slot.isBooked}
                                  onClick={() => { if (apptSlot === slot.startTime) { setApptSlot(""); } else { setApptSlot(slot.startTime); setApptManualTime(""); } }}
                                  title={slot.isBooked ? `Booked${slot.patientName ? `: ${slot.patientName}` : ""}` : `Select ${slot.startTime}`}
                                  data-testid={`appt-slot-${slot.startTime}`}
                                  style={{ minWidth: "72px" }}
                                  className={cn(
                                    "rounded px-2 py-1.5 text-[11px] font-medium transition-all border text-center leading-tight",
                                    slot.isBooked
                                      ? "bg-red-50 border-red-200 text-red-500 cursor-not-allowed opacity-70"
                                      : apptSlot === slot.startTime
                                        ? "bg-primary text-white border-primary shadow-sm"
                                        : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 cursor-pointer"
                                  )}
                                >
                                  <div>{slot.startTime.substring(0,5)}</div>
                                  {slot.isBooked && slot.patientName && (
                                    <div className="text-[9px] truncate leading-tight text-red-400 max-w-[68px]">{slot.patientName.split(" ")[0]}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {apptSlot && (
                        <div className="flex items-center gap-2 text-xs text-primary font-medium p-1.5 bg-primary/5 rounded-lg border border-primary/20">
                          Selected: <span className="font-bold">{apptSlot.substring(0,5)}</span>
                          <button onClick={() => setApptSlot("")} className="ml-auto text-muted-foreground hover:text-foreground text-[10px]">Clear</button>
                        </div>
                      )}
                      <div className="border-t pt-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1">Or enter a specific time:</p>
                        <Input type="time" value={apptManualTime} onChange={(e) => { setApptManualTime(e.target.value); setApptSlot(""); }} className="h-7 text-xs" data-testid="input-appt-manual-time" />
                      </div>
                    </div>
                  ) : availability && availability.slots.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      <div className="grid grid-cols-2 gap-2">
                        {availability.slots.map((slot) => (
                          <Button
                            key={slot.startTime}
                            variant={apptSlot === slot.startTime ? "default" : "outline"}
                            size="sm"
                            className={cn("text-xs", slot.availableCount === 0 ? "opacity-50 line-through" : "")}
                            disabled={slot.availableCount === 0}
                            onClick={() => { setApptSlot(slot.startTime); setApptManualTime(""); }}
                            data-testid={`button-slot-${slot.startTime}`}
                          >
                            {slot.startTime?.substring(0, 5)} - {slot.endTime?.substring(0, 5)}
                            <span className={cn("ml-1", slot.availableCount === 0 ? "text-red-400" : "text-muted-foreground")}>({slot.availableCount})</span>
                          </Button>
                        ))}
                      </div>
                      {!apptSlot && (
                        <div>
                          <p className="text-xs text-muted-foreground">Or enter time manually:</p>
                          <Input type="time" value={apptManualTime} onChange={(e) => setApptManualTime(e.target.value)} className="mt-1" data-testid="input-appt-manual-time" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground mt-1">{availability?.slots.length === 0 ? "No OPD slots configured." : ""} Enter time:</p>
                      <Input type="time" value={apptManualTime} onChange={(e) => setApptManualTime(e.target.value)} className="mt-1" data-testid="input-appt-manual-time" />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={apptNotes}
                  onChange={(e) => setApptNotes(e.target.value)}
                  placeholder="Appointment notes..."
                  rows={2}
                  data-testid="input-appt-notes"
                />
              </div>
              <Button
                onClick={() => {
                  if (!effectiveApptTime) {
                    toast({ title: "Appointment time is required", variant: "destructive" });
                    return;
                  }
                  const selectedIndivSlot = availability?.individualSlots?.find(s => s.startTime === apptSlot);
                  const selectedWinSlot = availability?.slots.find(s => s.startTime === apptSlot);
                  const resolvedEndTime = selectedIndivSlot?.endTime || selectedWinSlot?.endTime;
                  createAppointment.mutate(
                    {
                      leadId: lead.id,
                      doctorId: Number(apptDoctorId),
                      appointmentDate: apptDate,
                      startTime: effectiveApptTime,
                      endTime: resolvedEndTime || undefined,
                      notes: apptNotes || undefined,
                      status: "Scheduled",
                      ...(apptBranchId ? { branchId: Number(apptBranchId) } : {}),
                    },
                    {
                      onSuccess: (data) => {
                        toast({ title: "Appointment booked", description: `Token #${data.tokenNumber}` });
                        setApptDialogOpen(false);
                        setApptBranchId("");
                        setApptDoctorId("");
                        setApptDate("");
                        setApptSlot("");
                        setApptManualTime("");
                        setApptNotes("");
                      },
                      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                    }
                  );
                }}
                className="w-full"
                disabled={createAppointment.isPending || !apptDoctorId || !apptDate || !effectiveApptTime || (activeBranches.length > 0 && !apptBranchId)}
                data-testid="button-confirm-appointment"
              >
                Book Appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-assign-lead">
              <UserPlus className="w-4 h-4 mr-2" />
              Assign / Transfer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assign to CRM User</label>
                <SearchableSelect
                  value={selectedCrmUserId}
                  onValueChange={setSelectedCrmUserId}
                  options={(crmUsers || []).map((u) => ({ value: String(u.id), label: `${u.name}${u.email ? ` (${u.email})` : ""}` }))}
                  placeholder="Select user"
                  data-testid="select-assign-user"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason for Transfer</label>
                <SearchableSelect
                  value={handoverReason}
                  onValueChange={setHandoverReason}
                  options={[
                    { value: "Speciality Mismatch", label: "Speciality Mismatch" },
                    { value: "Workload Balancing", label: "Workload Balancing" },
                    { value: "Location Change", label: "Location Change" },
                    { value: "On Leave", label: "On Leave" },
                    { value: "Patient Request", label: "Patient Request" },
                    { value: "Escalation", label: "Escalation" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select reason..."
                  data-testid="select-handover-reason"
                />
              </div>
              {lead.assignedCrmUserId && (
                <p className="text-xs text-muted-foreground">
                  Currently assigned to {crmUsers?.find((u: any) => u.id === lead.assignedCrmUserId)?.name || `User #${lead.assignedCrmUserId}`}
                </p>
              )}
              <Button
                onClick={() => {
                  if (!selectedCrmUserId) return;
                  assignLead.mutate(
                    { leadId: lead.id, assignToCrmUserId: Number(selectedCrmUserId), handoverReason },
                    {
                      onSuccess: () => {
                        toast({ title: "Lead assigned", description: "Handover is now pending acceptance." });
                        setAssignDialogOpen(false);
                        setSelectedCrmUserId("");
                        setHandoverReason("");
                      },
                      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                    }
                  );
                }}
                className="w-full"
                disabled={assignLead.isPending || !selectedCrmUserId}
                data-testid="button-confirm-assign"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Assign & Initiate Handover
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DemographicsSection({ lead }: { lead: any }) {
  const [expanded, setExpanded] = useState(false);

  const hasDemo = lead.dateOfBirth || lead.gender || lead.bloodGroup || lead.address || lead.pinCode || lead.secondaryPhone || lead.insuranceProvider || lead.insurancePolicyNumber;

  if (!hasDemo && !expanded) {
    return (
      <div className="px-4 py-2 border-b border-border">
        <button
          className="text-xs text-primary hover:underline flex items-center gap-1"
          onClick={() => setExpanded(true)}
          data-testid="button-show-demographics"
        >
          <User className="w-3 h-3" />
          Show Patient Demographics
        </button>
      </div>
    );
  }

  const infoItem = (label: string, value: any) => {
    if (!value) return null;
    return (
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-xs text-foreground">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="px-4 py-3 border-b border-border bg-muted/10">
      <button
        className="text-xs font-semibold text-foreground flex items-center gap-2 mb-2 w-full"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-demographics"
      >
        <User className="w-3.5 h-3.5 text-primary" />
        Patient Demographics
        <ChevronRight className={cn("w-3 h-3 ml-auto transition-transform", expanded && "rotate-90")} />
      </button>
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {infoItem("Gender", lead.gender)}
          {infoItem("Date of Birth", lead.dateOfBirth ? fmtDate(lead.dateOfBirth) : null)}
          {infoItem("Blood Group", lead.bloodGroup)}
          {infoItem("Secondary Phone", lead.secondaryPhone)}
          {infoItem("Address", lead.address)}
          {infoItem("Pin Code", lead.pinCode)}
          {infoItem("Insurance Provider", lead.insuranceProvider)}
          {infoItem("Policy Number", lead.insurancePolicyNumber)}
          {infoItem("HMS Patient ID", lead.hmsPatientId)}
        </div>
      )}
    </div>
  );
}

function EpisodesSection({ lead }: { lead: any }) {
  const { data: episodes, isLoading } = useEpisodes(lead.id);
  const [, setLocation] = useLocation();

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2" data-testid="text-episodes-heading">
          <Target className="w-3.5 h-3.5 text-primary" />
          Treatment Episodes ({episodes?.length || 0})
        </h3>
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground py-2">Loading episodes...</div>
      ) : !episodes?.length ? (
        <p className="text-xs text-muted-foreground py-1">No episodes yet. Episodes are created after first consultation.</p>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep: any) => (
            <Card
              key={ep.id}
              className="p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setLocation(`/episodes/${ep.id}`)}
              data-testid={`card-episode-${ep.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground truncate">{ep.episodeName}</span>
                    <Badge className={cn("text-[10px] shrink-0", getStatusColor(ep.status))}>{ep.status}</Badge>
                    {ep.insuranceApplicable && (
                      <Badge className="text-[10px] shrink-0 bg-teal-100 text-teal-700 border-teal-200" data-testid={`badge-insurance-${ep.id}`}>
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        Insurance
                      </Badge>
                    )}
                    {ep.preauthStatusId && (
                      <Badge variant="outline" className="text-[10px] shrink-0" data-testid={`badge-preauth-${ep.id}`}>
                        Preauth #{ep.preauthStatusId}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {ep.episodeType && <span>{ep.episodeType}</span>}
                    {ep.startDate && <span>Started {fmtDate(ep.startDate)}</span>}
                    {ep.estimatedCost && <span>Est: ₹{ep.estimatedCost.toLocaleString()}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TemperatureHistory({ leadId }: { leadId: number }) {
  const { data: tempLogs, isLoading } = useQuery({
    queryKey: ['/api/temperature-logs', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/temperature-logs?leadId=${leadId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading || !tempLogs?.length) return null;

  const getTempIcon = (temp: string) => {
    if (temp === "Hot" || temp === "Very Hot") return Flame;
    if (temp === "Warm" || temp === "Warm+" || temp === "Warm++") return Sun;
    if (temp === "Dormant") return Ban;
    return Snowflake;
  };

  return (
    <div className="p-4 border-b border-border">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <Thermometer className="w-4 h-4 text-primary" />
        Temperature History ({tempLogs.length})
      </h3>
      <div className="space-y-2">
        {tempLogs.slice(0, 10).map((log: any) => {
          const NewIcon = getTempIcon(log.newTemperature || "Cold");
          return (
            <Card key={log.id} className="p-2" data-testid={`temp-log-${log.id}`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1">
                  {log.previousTemperature && (
                    <>
                      <Badge variant="outline" className={cn("text-[10px]", getTemperatureColor(
                        (log.previousTemperature === "Very Hot" || log.previousTemperature === "Warm+" || log.previousTemperature === "Warm++")
                          ? (log.previousTemperature === "Very Hot" ? "Hot" : "Warm")
                          : log.previousTemperature === "Dormant" ? "Cold" : log.previousTemperature
                      ))}>
                        {log.previousTemperature}
                      </Badge>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge className={cn("text-[10px]", getTemperatureColor(
                    (log.newTemperature === "Very Hot" || log.newTemperature === "Warm+" || log.newTemperature === "Warm++")
                      ? (log.newTemperature === "Very Hot" ? "Hot" : "Warm")
                      : log.newTemperature === "Dormant" ? "Cold" : log.newTemperature
                  ))}>
                    <NewIcon className="w-2.5 h-2.5 mr-0.5" />
                    {log.newTemperature}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {log.createdAt && fmtDateTimeShort(log.createdAt)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {log.triggerEvent?.replace(/_/g, " ")}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HandoverHistory({ leadId }: { leadId: number }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['/api/leads', leadId, 'handover-history'],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/handover-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading || !history?.length) return null;

  return (
    <div className="p-4 border-b border-border">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-primary" />
        Handover History ({history.length})
      </h3>
      <div className="space-y-2">
        {history.map((item: any) => (
          <Card key={item.id} className="p-2" data-testid={`handover-history-${item.id}`}>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">{item.type.replace(/_/g, " ")}</Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {item.createdAt && fmtDateTimeShort(item.createdAt)}
              </span>
            </div>
            <p className="text-xs text-foreground">{item.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

const CHANNELS = ["WhatsApp", "SMS", "Email", "Phone Call"];

function CommunicationPreferencesPanel({ leadId }: { leadId: number }) {
  const { data: prefs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/communication-preferences", "lead", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/communication-preferences/lead/${leadId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const getOptedIn = (channel: string) => {
    const pref = prefs.find((p: any) => p.channel === channel);
    return pref ? pref.opted_in : true;
  };

  const toggleChannel = async (channel: string) => {
    setSaving(channel);
    try {
      const res = await fetch("/api/communication-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leadId, channel, optedIn: !getOptedIn(channel) }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/communication-preferences", "lead", leadId] });
      } else {
        toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-4 border-b border-border" data-testid="communication-preferences-panel">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary" />
        Communication Preferences
      </h3>
      <Card className="p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {CHANNELS.map((ch) => {
              const opted = getOptedIn(ch);
              return (
                <div key={ch} className="flex items-center justify-between py-1">
                  <span className="text-xs text-foreground">{ch}</span>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                      opted
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    )}
                    onClick={() => toggleChannel(ch)}
                    disabled={saving === ch}
                    data-testid={`toggle-pref-${ch.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {opted ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                    {saving === ch ? "..." : opted ? "Opted In" : "Opted Out"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ConsentBadge({ lead }: { lead: any }) {
  return (
    <div className="p-4 border-b border-border" data-testid="consent-badge-panel">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary" />
        Data Consent
      </h3>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          {lead.consentGiven ? (
            <>
              <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]" data-testid="badge-consent-given">
                Consent Given
              </Badge>
              {lead.consentTimestamp && (
                <span className="text-[10px] text-muted-foreground" data-testid="text-consent-date">
                  {fmtDateTime(lead.consentTimestamp)}
                </span>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]" data-testid="badge-consent-pending">
              Consent Pending
            </Badge>
          )}
        </div>
        {lead.consentMethod && (
          <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-consent-method">
            Method: {lead.consentMethod}
          </p>
        )}
      </Card>
    </div>
  );
}

const RELATIONSHIP_OPTIONS = [
  "Self", "Spouse", "Parent", "Child", "Sibling", "Guardian",
  "Friend", "Colleague", "Caregiver", "Power of Attorney", "Other"
];

function ContactPersonsPanel({ leadId, lead }: { leadId: number; lead?: any }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [editingPhoneOwner, setEditingPhoneOwner] = useState(false);
  const [phoneOwnerRel, setPhoneOwnerRel] = useState(lead?.phoneOwnerRelationship || "Self");
  const [formData, setFormData] = useState({
    name: "", phoneE164: "", whatsappNumber: "", email: "", relationship: "Other",
    isPrimary: false, isBillingContact: false, isEmergencyContact: false,
    isWhatsAppConsentHolder: false, isAppointmentCoordinator: false, notes: "",
  });
  const [cpPhoneMatch, setCpPhoneMatch] = useState<any>(null);
  const cpPhoneDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: contactLinks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/leads", leadId, "contact-persons"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/contact-persons`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "", phoneE164: "", whatsappNumber: "", email: "", relationship: "Other",
      isPrimary: false, isBillingContact: false, isEmergencyContact: false,
      isWhatsAppConsentHolder: false, isAppointmentCoordinator: false, notes: "",
    });
    setEditingLink(null);
    setShowForm(false);
    setCpPhoneMatch(null);
  };

  const handleCpPhoneChange = (phone: string) => {
    setFormData(p => ({ ...p, phoneE164: phone }));
    setCpPhoneMatch(null);
    if (cpPhoneDebounceRef.current) clearTimeout(cpPhoneDebounceRef.current);
    if (phone.length >= 7) {
      cpPhoneDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/contact-persons/search?phone=${encodeURIComponent(phone)}`, { credentials: "include" });
          if (res.ok) {
            const results = await res.json();
            if (Array.isArray(results) && results.length > 0) setCpPhoneMatch(results[0]);
          }
        } catch {}
      }, 500);
    }
  };

  const reuseExistingCp = (cp: any) => {
    setFormData(p => ({
      ...p, name: cp.name, phoneE164: cp.phoneE164 || p.phoneE164,
      whatsappNumber: cp.whatsappNumber || "", email: cp.email || "",
      contactPersonId: cp.id,
    }));
    setCpPhoneMatch(null);
  };

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      let cpId = data.contactPersonId;
      if (!cpId) {
        const cpRes = await apiRequest("POST", "/api/contact-persons", {
          name: data.name, phoneE164: data.phoneE164 || null,
          whatsappNumber: data.whatsappNumber || null, email: data.email || null,
          relationship: data.relationship,
        });
        const cp = await cpRes.json();
        cpId = cp.id;
      }
      const res = await apiRequest("POST", `/api/leads/${leadId}/contact-persons`, {
        contactPersonId: cpId, relationship: data.relationship,
        isPrimary: data.isPrimary, isBillingContact: data.isBillingContact,
        isEmergencyContact: data.isEmergencyContact,
        isWhatsAppConsentHolder: data.isWhatsAppConsentHolder,
        isAppointmentCoordinator: data.isAppointmentCoordinator,
        notes: data.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "contact-persons"] });
      toast({ title: "Contact person added" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/leads/${leadId}/contact-persons/${editingLink.id}`, {
        relationship: data.relationship,
        isPrimary: data.isPrimary, isBillingContact: data.isBillingContact,
        isEmergencyContact: data.isEmergencyContact,
        isWhatsAppConsentHolder: data.isWhatsAppConsentHolder,
        isAppointmentCoordinator: data.isAppointmentCoordinator,
        notes: data.notes || null,
      });
      if (editingLink.contactPerson) {
        await apiRequest("PATCH", `/api/contact-persons/${editingLink.contactPersonId}`, {
          name: data.name, phoneE164: data.phoneE164 || null,
          whatsappNumber: data.whatsappNumber || null, email: data.email || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "contact-persons"] });
      toast({ title: "Contact person updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const res = await apiRequest("DELETE", `/api/leads/${leadId}/contact-persons/${linkId}`);
      if (res && !res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to remove contact person");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "contact-persons"] });
      toast({ title: "Contact person removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePhoneOwnerMutation = useMutation({
    mutationFn: async (relationship: string) => {
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, { phoneOwnerRelationship: relationship });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "Phone owner relationship updated" });
      setEditingPhoneOwner(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (link: any) => {
    setEditingLink(link);
    setFormData({
      name: link.contactPerson?.name || "",
      phoneE164: link.contactPerson?.phoneE164 || "",
      whatsappNumber: link.contactPerson?.whatsappNumber || "",
      email: link.contactPerson?.email || "",
      relationship: link.relationship || "Other",
      isPrimary: link.isPrimary || false,
      isBillingContact: link.isBillingContact || false,
      isEmergencyContact: link.isEmergencyContact || false,
      isWhatsAppConsentHolder: link.isWhatsAppConsentHolder || false,
      isAppointmentCoordinator: link.isAppointmentCoordinator || false,
      notes: link.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingLink) {
      updateMutation.mutate(formData);
    } else {
      addMutation.mutate(formData);
    }
  };

  const FlagBadge = ({ flag, icon: Icon, label }: { flag: boolean; icon: any; label: string }) =>
    flag ? (
      <Badge variant="outline" className="text-[9px] py-0 px-1 gap-0.5 text-primary border-primary/30">
        <Icon className="w-2.5 h-2.5" /> {label}
      </Badge>
    ) : null;

  return (
    <div className="p-4 border-b border-border" data-testid="contact-persons-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          Contact Persons ({contactLinks.length})
        </h3>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
          onClick={() => { setEditingLink(null); resetForm(); setShowForm(true); }}
          data-testid="button-add-contact-person"
        >
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {/* phoneOwnerRelationship quick-edit — shown when lead has a direct phone */}
      {lead?.phoneE164 && (
        <div className="mb-3 flex items-center gap-2 text-[11px]" data-testid="phone-owner-rel-section">
          <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">Phone owned by:</span>
          {editingPhoneOwner ? (
            <>
              <Select value={phoneOwnerRel} onValueChange={setPhoneOwnerRel}>
                <SelectTrigger className="h-6 text-[10px] flex-1" data-testid="select-phone-owner-rel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-6 text-[10px] px-2"
                onClick={() => updatePhoneOwnerMutation.mutate(phoneOwnerRel)}
                disabled={updatePhoneOwnerMutation.isPending}
                data-testid="button-save-phone-owner-rel">Save</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                onClick={() => { setEditingPhoneOwner(false); setPhoneOwnerRel(lead.phoneOwnerRelationship || "Self"); }}
                data-testid="button-cancel-phone-owner-rel">✕</Button>
            </>
          ) : (
            <>
              <Badge variant="outline" className="text-[9px] py-0 px-1" data-testid="badge-display-phone-owner-rel">
                {lead.phoneOwnerRelationship || "Self"}
              </Badge>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0"
                onClick={() => { setPhoneOwnerRel(lead.phoneOwnerRelationship || "Self"); setEditingPhoneOwner(true); }}
                data-testid="button-edit-phone-owner-rel">
                <Pencil className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      )}

      {showForm && (
        <Card className="p-3 mb-3 border-primary/20 bg-primary/5">
          <h4 className="text-xs font-semibold text-foreground mb-2">
            {editingLink ? "Edit Contact Person" : "Add Contact Person"}
          </h4>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Full Name *</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Contact name" className="h-7 text-xs mt-0.5" data-testid="input-cp-name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Phone</Label>
                <Input value={formData.phoneE164} onChange={e => handleCpPhoneChange(e.target.value)}
                  placeholder="+91..." className="h-7 text-xs mt-0.5" data-testid="input-cp-phone"
                  disabled={!!editingLink} />
                {!editingLink && cpPhoneMatch && (
                  <div className="mt-1 p-1.5 rounded bg-amber-50 border border-amber-200 text-[10px]">
                    <span className="text-amber-700 font-medium">Existing contact found: </span>
                    <span className="text-amber-900">{cpPhoneMatch.name}</span>
                    <button type="button" onClick={() => reuseExistingCp(cpPhoneMatch)}
                      className="ml-2 text-primary underline font-medium" data-testid="btn-reuse-contact">
                      Reuse
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">WhatsApp</Label>
                <Input value={formData.whatsappNumber} onChange={e => setFormData(p => ({ ...p, whatsappNumber: e.target.value }))}
                  placeholder="+91..." className="h-7 text-xs mt-0.5" data-testid="input-cp-whatsapp" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Email</Label>
              <Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com" className="h-7 text-xs mt-0.5" type="email" data-testid="input-cp-email" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Relationship</Label>
              <Select value={formData.relationship} onValueChange={v => setFormData(p => ({ ...p, relationship: v }))}>
                <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-cp-relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes" className="text-xs mt-0.5 min-h-[50px]" data-testid="textarea-cp-notes" />
            </div>
            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Roles</Label>
              {[
                { key: "isPrimary", label: "Primary Contact" },
                { key: "isBillingContact", label: "Billing Contact" },
                { key: "isEmergencyContact", label: "Emergency Contact" },
                { key: "isWhatsAppConsentHolder", label: "WhatsApp Consent" },
                { key: "isAppointmentCoordinator", label: "Appointment Coordinator" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground">{label}</span>
                  <Switch
                    checked={(formData as any)[key]}
                    onCheckedChange={v => setFormData(p => ({ ...p, [key]: v }))}
                    data-testid={`switch-cp-${key}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSubmit}
                disabled={addMutation.isPending || updateMutation.isPending}
                data-testid="button-save-contact-person"
              >
                {editingLink ? "Save Changes" : "Add Contact Person"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}
                data-testid="button-cancel-contact-person"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Reachability warning when lead has no phone and no contact with phone */}
      {!isLoading && !lead?.phoneE164 && contactLinks.length > 0 && !contactLinks.some((l: any) => l.contactPerson?.phoneE164) && (
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2 mb-2 text-[10px] text-amber-700">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>This lead has no direct phone number and no contact person with a phone number. Add a contact phone to enable outreach.</span>
        </div>
      )}
      {!isLoading && !lead?.phoneE164 && contactLinks.length === 0 && !showForm && (
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2 mb-2 text-[10px] text-amber-700">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>This lead has no direct phone number. Add a contact person with a phone to enable outreach.</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : contactLinks.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground">No contact persons linked. Add one to track family members, caregivers, or billing contacts.</p>
      ) : (
        <div className="space-y-2">
          {contactLinks.map((link: any) => (
            <Card key={link.id} className="p-2.5" data-testid={`card-contact-person-${link.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{link.contactPerson?.name}</span>
                    {link.relationship && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1">{link.relationship}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <FlagBadge flag={link.isPrimary} icon={Star} label="Primary" />
                    <FlagBadge flag={link.isBillingContact} icon={CreditCard} label="Billing" />
                    <FlagBadge flag={link.isEmergencyContact} icon={Ambulance} label="Emergency" />
                    <FlagBadge flag={link.isWhatsAppConsentHolder} icon={MessageSquareDot} label="WA Consent" />
                    <FlagBadge flag={link.isAppointmentCoordinator} icon={Landmark} label="Appt Coord" />
                  </div>
                  {link.contactPerson?.phoneE164 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" /> {link.contactPerson.phoneE164}
                    </p>
                  )}
                  {link.contactPerson?.email && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" /> {link.contactPerson.email}
                    </p>
                  )}
                  {link.notes && (
                    <p className="text-[10px] text-muted-foreground italic mt-0.5">{link.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit(link)}
                    data-testid={`button-edit-cp-${link.id}`}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeMutation.mutate(link.id)}
                    disabled={removeMutation.isPending}
                    data-testid={`button-remove-cp-${link.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
