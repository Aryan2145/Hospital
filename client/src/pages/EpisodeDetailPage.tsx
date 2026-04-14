import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useUpdateEpisode } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { getStatusColor, getValidEpisodeTransitions } from "@/lib/lead-status";
import { format, formatDistanceToNow } from "date-fns";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/date-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Target,
  ChevronRight,
  Stethoscope,
  IndianRupee,
  FileText,
  Clock,
  CheckCircle2,
  CircleDot,
  XCircle,
  ArrowRightCircle,
  PlusCircle,
  User,
  Users,
  Shield,
  TrendingUp,
  Plus,
  Pencil,
  Save,
  X,
  UserCog,
  Phone,
  MessageCircle,
  Mail,
  MessageSquare,
  CalendarClock,
  StickyNote,
  AlertTriangle,
  HeartPulse,
  CalendarDays,
  Gift,
  Trash2,
  BedDouble,
  Receipt,
} from "lucide-react";

interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  changedFields: string | null;
  performedBy: string | null;
  createdAt: string;
}

function getRevenueProbabilityColor(probability: number | null | undefined): string {
  if (!probability) return "bg-muted text-muted-foreground";
  if (probability >= 80) return "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300";
  if (probability >= 60) return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300";
  if (probability >= 40) return "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300";
  if (probability >= 20) return "bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300";
  return "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300";
}

function PostCareTimeline({ episodeId, episodeStatus }: { episodeId: number; episodeStatus: string }) {
  const postCareStatuses = ["Post Care", "Follow Up", "Completed"];
  const showTimeline = postCareStatuses.includes(episodeStatus);

  const { data: timeline } = useQuery<{
    protocol: any;
    steps: Array<{
      id: number;
      stepNumber: number;
      daysAfterDischarge: number;
      taskTitle: string;
      taskDescription: string | null;
      assigneeType: string;
      priority: string;
      task: any;
      taskStatus: string;
      taskDueDate: string | null;
      taskCompletedAt: string | null;
    }>;
  }>({
    queryKey: ["/api/episodes", episodeId, "post-care-timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episodeId}/post-care-timeline`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: showTimeline,
  });

  if (!showTimeline || !timeline?.protocol || timeline.steps.length === 0) return null;

  return (
    <Card className="p-4 mb-0" data-testid="card-post-care-timeline">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <HeartPulse className="w-4 h-4 text-primary" />
        Post-Care Follow-Up Schedule
        <Badge variant="outline" className="text-xs ml-auto">{timeline.protocol.name}</Badge>
      </h3>
      <div className="space-y-2">
        {timeline.steps.map((step, idx) => {
          const isCompleted = step.taskStatus === "Completed";
          const isOverdue = step.taskDueDate && !isCompleted && new Date(step.taskDueDate) < new Date();
          const isPending = step.taskStatus === "Pending";
          return (
            <div
              key={step.id || idx}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                isCompleted ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" :
                isOverdue ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" :
                isPending ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900" :
                "bg-muted/30 border-border"
              )}
              data-testid={`post-care-step-${idx}`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : isOverdue ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : isPending ? (
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <CircleDot className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{step.taskTitle}</span>
                  <Badge variant={isCompleted ? "default" : isOverdue ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                    Day {step.daysAfterDischarge}
                  </Badge>
                  <Badge variant={step.priority === "Urgent" || step.priority === "High" ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                    {step.priority}
                  </Badge>
                </div>
                {step.taskDescription && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.taskDescription}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                {step.taskDueDate && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {fmtDate(step.taskDueDate)}
                  </div>
                )}
                {step.taskCompletedAt && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Completed {fmtDate(step.taskCompletedAt)}
                  </div>
                )}
                {isOverdue && !isCompleted && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-medium">Overdue</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function EpisodeDetailPage() {
  const [, params] = useRoute("/episodes/:id");
  const [, setLocation] = useLocation();
  const episodeId = Number(params?.id);
  const updateEpisode = useUpdateEpisode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roleCode, canViewEpisodeTab } = useCurrentUser();

  const { data: clinicalEditRolesData } = useQuery<{ allowedRoles: string[] }>({
    queryKey: ["/api/episodes/clinical-notes-edit-roles"],
  });
  const canEditClinical = roleCode != null && (clinicalEditRolesData?.allowedRoles || []).includes(roleCode);
  const [clinicalEditMode, setClinicalEditMode] = useState(false);
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editTreatmentPlan, setEditTreatmentPlan] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [stageChangeTarget, setStageChangeTarget] = useState<string | null>(null);
  const [stageRemarks, setStageRemarks] = useState("");
  const [stageChangeOpen, setStageChangeOpen] = useState(false);
  const [surgeryDate, setSurgeryDate] = useState("");
  const [surgeryTime, setSurgeryTime] = useState("");
  const [surgeryAlertUserId, setSurgeryAlertUserId] = useState<string>("");

  const clinicalNotesMutation = useMutation({
    mutationFn: async (data: { diagnosis: string; treatmentPlan: string; notes: string; editReason: string }) => {
      const res = await apiRequest("PUT", `/api/episodes/${episodeId}/clinical-notes`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Clinical notes updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
      setClinicalEditMode(false);
      setShowReasonModal(false);
      setEditReason("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleStartClinicalEdit = () => {
    setEditDiagnosis(episode?.diagnosis || "");
    setEditTreatmentPlan(episode?.treatmentPlan || "");
    setEditNotes(episode?.notes || "");
    setClinicalEditMode(true);
  };

  const handleCancelClinicalEdit = () => {
    setClinicalEditMode(false);
    setEditDiagnosis("");
    setEditTreatmentPlan("");
    setEditNotes("");
  };

  const handleSaveClinicalNotes = () => {
    setShowReasonModal(true);
  };

  const handleConfirmSave = () => {
    if (editReason.trim().length < 10) return;
    clinicalNotesMutation.mutate({
      diagnosis: editDiagnosis,
      treatmentPlan: editTreatmentPlan,
      notes: editNotes,
      editReason: editReason.trim(),
    });
  };

  const { data: episode, isLoading } = useQuery({
    queryKey: ["/api/episodes", episodeId],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episodeId}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch episode");
      return res.json();
    },
    enabled: !!episodeId,
  });

  const { data: auditLogs = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-logs", "episode", episodeId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entityType=episode&entityId=${episodeId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!episodeId,
  });

  const { data: insurers = [] } = useQuery<any[]>({ queryKey: ["/api/masters/insurers"], enabled: !!episodeId });
  const { data: tpas = [] } = useQuery<any[]>({ queryKey: ["/api/masters/tpas"], enabled: !!episodeId });
  const { data: policyTypes = [] } = useQuery<any[]>({ queryKey: ["/api/masters/policyTypes"], enabled: !!episodeId });
  const { data: preauthStatuses = [] } = useQuery<any[]>({ queryKey: ["/api/masters/preauthStatuses"], enabled: !!episodeId });
  const { data: rejectionReasons = [] } = useQuery<any[]>({ queryKey: ["/api/masters/rejectionReasons"], enabled: !!episodeId });
  const { data: doctors = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors-list"],
    queryFn: async () => {
      const res = await fetch("/api/doctors-list", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!episodeId,
  });
  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!episodeId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading episode..." />
        </div>
      </AppLayout>
    );
  }

  if (!episode) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Episode not found</p>
            <Button variant="outline" onClick={() => setLocation("/transactions")} data-testid="button-back-to-episodes">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Transactions
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const validTransitions = getValidEpisodeTransitions(episode.status);

  const handleStatusChange = (newStatus: string) => {
    setStageChangeTarget(newStatus);
    setStageRemarks("");
    setSurgeryDate("");
    setSurgeryTime("");
    setSurgeryAlertUserId("");
    setStageChangeOpen(true);
  };

  const confirmStageChange = () => {
    if (!stageChangeTarget || stageRemarks.trim().length < 5) return;
    if (stageChangeTarget === "Surgery Scheduled" && !surgeryDate) return;
    const payload: any = { id: episode.id, status: stageChangeTarget, stageRemarks: stageRemarks.trim() };
    if (stageChangeTarget === "Surgery Scheduled") {
      const dateTimeStr = surgeryTime ? `${surgeryDate}T${surgeryTime}` : `${surgeryDate}T09:00`;
      payload.surgeryDate = new Date(dateTimeStr).toISOString();
      if (surgeryAlertUserId) payload.surgeryAlertUserId = Number(surgeryAlertUserId);
    }
    updateEpisode.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Status updated" });
          queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
          setStageChangeOpen(false);
          setStageChangeTarget(null);
          setStageRemarks("");
          setSurgeryDate("");
          setSurgeryTime("");
          setSurgeryAlertUserId("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleFieldUpdate = (fields: Record<string, any>) => {
    updateEpisode.mutate(
      { id: episode.id, ...fields },
      {
        onSuccess: () => {
          toast({ title: "Episode updated" });
          queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const FUNNEL_STAGES = [
    "Consultation Done",
    "Treatment Planning",
    "Surgery Scheduled",
    "Surgery Done",
    "In Treatment",
    "Post Care",
    "Follow Up",
    "Completed",
  ];

  const currentStageIndex = FUNNEL_STAGES.indexOf(episode.status);
  const journeyEvents = buildJourneyTimeline(episode, auditLogs);

  const activeItems = (items: any[]) =>
    (items || []).filter((i: any) => i.status === "Active" && i.approvalStatus === "Approved");

  const doctorName = episode.doctorId && doctors.length > 0
    ? doctors.find((d: any) => d.id === episode.doctorId)?.name || null
    : null;

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 md:gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(episode.leadId ? `/leads/${episode.leadId}` : "/transactions")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <h1 className="text-lg md:text-xl font-bold text-foreground truncate" data-testid="text-episode-name">{episode.episodeName}</h1>
              <span className="text-xs font-mono text-muted-foreground" data-testid="text-episode-id">EP-{episode.id}</span>
            </div>
            {doctorName && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-case-owner-header">
                Case Owner: {doctorName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", getStatusColor(episode.status))} data-testid="badge-episode-status">
            {episode.status}
          </Badge>
          {episode.episodeType && (
            <Badge variant="outline" className="text-xs" data-testid="badge-episode-type">{episode.episodeType}</Badge>
          )}
          {episode.revenueProbability != null && (
            <Badge className={cn("text-xs", getRevenueProbabilityColor(episode.revenueProbability))} data-testid="badge-revenue-probability">
              <TrendingUp className="w-3 h-3 mr-1" />
              {episode.revenueProbability}% Probability
            </Badge>
          )}
          {episode.expectedRevenueAmount != null && episode.expectedRevenueAmount > 0 && (
            <Badge variant="outline" className="text-xs" data-testid="badge-expected-revenue">
              Expected: ₹{episode.expectedRevenueAmount.toLocaleString()}
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
                data-testid="select-change-episode-status"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card className="p-4" data-testid="card-episode-funnel">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Treatment Journey
          </h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {FUNNEL_STAGES.map((stage, idx) => {
              const isCurrent = stage === episode.status;
              const isPast = idx < currentStageIndex;
              const isDiscontinued = episode.status === "Discontinued";
              return (
                <div key={stage} className="flex items-center">
                  <div
                    className={cn(
                      "px-3 py-1.5 rounded text-[11px] font-medium whitespace-nowrap border transition-colors",
                      isCurrent && "bg-primary text-primary-foreground border-primary",
                      isPast && !isCurrent && "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
                      !isCurrent && !isPast && !isDiscontinued && "bg-muted text-muted-foreground border-border",
                      isDiscontinued && "bg-red-50 dark:bg-red-950/30 text-red-400 dark:text-red-500 border-red-200 dark:border-red-800",
                    )}
                    data-testid={`funnel-stage-${stage.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {stage}
                  </div>
                  {idx < FUNNEL_STAGES.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <LogAndNextActionCard episode={episode} />

        <Tabs
          defaultValue={canViewEpisodeTab("clinical") ? "clinical" : canViewEpisodeTab("financial") ? "financial" : "insurance"}
          className="w-full"
          data-testid="episode-tabs"
        >
          <TabsList className="w-full justify-start gap-1 flex-wrap" data-testid="episode-tabs-list">
            {canViewEpisodeTab("clinical") && (
              <TabsTrigger value="clinical" data-testid="tab-clinical">
                <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
                Clinical
              </TabsTrigger>
            )}
            {canViewEpisodeTab("financial") && (
              <TabsTrigger value="financial" data-testid="tab-financial">
                <IndianRupee className="w-3.5 h-3.5 mr-1.5" />
                Financial
              </TabsTrigger>
            )}
            {canViewEpisodeTab("insurance") && (
              <TabsTrigger value="insurance" data-testid="tab-insurance">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Insurance
              </TabsTrigger>
            )}
            {canViewEpisodeTab("family") && (
              <TabsTrigger value="family" data-testid="tab-family">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Family Status
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="clinical" className="mt-4 space-y-4" data-testid="tab-content-clinical">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4" data-testid="card-episode-details">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Episode Details
                </h3>
                <div className="space-y-3">
                  <InfoRow label="Episode Name" value={episode.episodeName} />
                  <InfoRow label="Type" value={episode.episodeType} />
                  <InfoRow label="Status" value={episode.status} />
                  <InfoRow label="Start Date" value={episode.startDate ? fmtDate(episode.startDate) : null} />
                  <InfoRow label="End Date" value={episode.endDate ? fmtDate(episode.endDate) : null} />
                  <InfoRow label="Lead ID" value={episode.leadId ? `#${episode.leadId}` : null} link={episode.leadId ? `/leads/${episode.leadId}` : undefined} />
                </div>
              </Card>

              <Card className="p-4" data-testid="card-case-ownership">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-primary" />
                  Case Ownership
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Primary Doctor (Case Owner) *</Label>
                    <SearchableSelect
                      value={episode.doctorId ? String(episode.doctorId) : ""}
                      onValueChange={(val) => handleFieldUpdate({ doctorId: val ? Number(val) : null })}
                      options={activeItems(doctors).map((d: any) => ({ value: String(d.id), label: d.name }))}
                      placeholder="Select primary doctor"
                      triggerClassName="text-xs"
                      data-testid="select-primary-doctor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Surgery Doctor</Label>
                    <SearchableSelect
                      value={episode.surgeryDoctorId ? String(episode.surgeryDoctorId) : ""}
                      onValueChange={(val) => handleFieldUpdate({ surgeryDoctorId: val ? Number(val) : null })}
                      options={[{ value: "", label: "None" }, ...activeItems(doctors).map((d: any) => ({ value: String(d.id), label: d.name }))]}
                      placeholder="Select surgery doctor"
                      triggerClassName="text-xs"
                      data-testid="select-surgery-doctor"
                    />
                  </div>
                  {episode.surgeryDate && (
                    <div className="col-span-2 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800" data-testid="card-surgery-schedule-info">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarClock className="w-4 h-4 text-violet-600" />
                        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Surgery Scheduled</span>
                      </div>
                      <p className="text-sm font-medium text-foreground" data-testid="text-surgery-date">
                        {fmtDateTime(episode.surgeryDate)}
                      </p>
                      {episode.surgeryAlertUserId && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-surgery-alert-user">
                          Alert: {crmUsers.find((u: any) => u.id === episode.surgeryAlertUserId)?.name || `User #${episode.surgeryAlertUserId}`}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Post-Care Doctor</Label>
                    <SearchableSelect
                      value={episode.postCareOwnerId ? String(episode.postCareOwnerId) : ""}
                      onValueChange={(val) => handleFieldUpdate({ postCareOwnerId: val ? Number(val) : null })}
                      options={[{ value: "", label: "None" }, ...activeItems(doctors).map((d: any) => ({ value: String(d.id), label: d.name }))]}
                      placeholder="Select post-care doctor"
                      triggerClassName="text-xs"
                      data-testid="select-post-care-owner"
                    />
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-4" data-testid="card-episode-clinical">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  Clinical Information
                </h3>
                {canEditClinical && !clinicalEditMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartClinicalEdit}
                    data-testid="button-edit-clinical-notes"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {clinicalEditMode && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveClinicalNotes}
                      disabled={clinicalNotesMutation.isPending}
                      data-testid="button-save-clinical-notes"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelClinicalEdit}
                      disabled={clinicalNotesMutation.isPending}
                      data-testid="button-cancel-clinical-notes"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {clinicalEditMode ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Diagnosis</Label>
                    <Textarea
                      value={editDiagnosis}
                      onChange={(e) => setEditDiagnosis(e.target.value)}
                      placeholder="Enter diagnosis..."
                      className="text-xs min-h-[60px] resize-none"
                      data-testid="textarea-edit-diagnosis"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Treatment Plan</Label>
                    <Textarea
                      value={editTreatmentPlan}
                      onChange={(e) => setEditTreatmentPlan(e.target.value)}
                      placeholder="Enter treatment plan..."
                      className="text-xs min-h-[60px] resize-none"
                      data-testid="textarea-edit-treatment-plan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Enter notes..."
                      className="text-xs min-h-[60px] resize-none"
                      data-testid="textarea-edit-notes"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoRow label="Diagnosis" value={episode.diagnosis} />
                  <InfoRow label="Treatment Plan" value={episode.treatmentPlan} />
                  <InfoRow label="Notes" value={episode.notes} />
                </div>
              )}
            </Card>

            {episode.lostNotes && (
              <Card className="p-4 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30" data-testid="card-episode-lost">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Discontinued Details</h3>
                <p className="text-xs text-red-700 dark:text-red-400">{episode.lostNotes}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financial" className="mt-4" data-testid="tab-content-financial">
            <FinancialTab episode={episode} onUpdate={handleFieldUpdate} isPending={updateEpisode.isPending} />
          </TabsContent>

          <TabsContent value="insurance" className="mt-4" data-testid="tab-content-insurance">
            <InsuranceTab
              episode={episode}
              onUpdate={handleFieldUpdate}
              isPending={updateEpisode.isPending}
              insurers={activeItems(insurers)}
              tpas={activeItems(tpas)}
              policyTypes={activeItems(policyTypes)}
              preauthStatuses={activeItems(preauthStatuses)}
              rejectionReasons={activeItems(rejectionReasons)}
            />
          </TabsContent>

          <TabsContent value="family" className="mt-4" data-testid="tab-content-family">
            <FamilyTab episode={episode} onUpdate={handleFieldUpdate} isPending={updateEpisode.isPending} />
          </TabsContent>
        </Tabs>

        <PostCareTimeline episodeId={episode.id} episodeStatus={episode.status} />

        <ReferralReadyCard episode={episode} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] })} />

        <Card className="p-4" data-testid="card-episode-journey-timeline">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Journey Timeline
          </h3>
          {journeyEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No journey events recorded yet</p>
              <p className="text-xs mt-1">Status changes will appear here as the episode progresses</p>
            </div>
          ) : (
            <div className="relative" data-testid="journey-timeline">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />
              <div className="space-y-0">
                {journeyEvents.map((event, idx) => (
                  <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0" data-testid={`timeline-event-${idx}`}>
                    <div className="relative z-10 flex-shrink-0 mt-0.5">
                      {event.type === "created" && (
                        <div className="w-[30px] h-[30px] rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                          <PlusCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      {event.type === "status_change" && !event.isTerminal && (
                        <div className="w-[30px] h-[30px] rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                          <ArrowRightCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                      )}
                      {event.type === "status_change" && event.isTerminal && event.newStatus === "Completed" && (
                        <div className="w-[30px] h-[30px] rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                      {event.type === "status_change" && event.isTerminal && event.newStatus === "Discontinued" && (
                        <div className="w-[30px] h-[30px] rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground" data-testid={`timeline-event-title-${idx}`}>
                            {event.title}
                          </p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          )}
                          {event.stageRemarks && (
                            <p className="text-xs text-foreground/80 mt-1 italic border-l-2 border-primary/30 pl-2" data-testid={`timeline-remarks-${idx}`}>
                              "{event.stageRemarks}"
                            </p>
                          )}
                          {event.surgeryDate && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs bg-violet-50 dark:bg-violet-950/30 rounded px-2 py-1 w-fit" data-testid={`timeline-surgery-date-${idx}`}>
                              <CalendarDays className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                              <span className="font-medium text-violet-700 dark:text-violet-300">Surgery Date: {fmtDateTime(event.surgeryDate)}</span>
                            </div>
                          )}
                          {event.statusTransition && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Badge variant="outline" className={cn("text-[10px] py-0 h-5", getStatusColor(event.statusTransition.from))}>
                                {event.statusTransition.from}
                              </Badge>
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="outline" className={cn("text-[10px] py-0 h-5", getStatusColor(event.statusTransition.to))}>
                                {event.statusTransition.to}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {fmtDate(event.timestamp)}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {fmtTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                      {event.performedBy && (
                        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{event.performedBy}</span>
                          <span className="mx-1">·</span>
                          <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={showReasonModal} onOpenChange={(open) => { if (!open) { setShowReasonModal(false); setEditReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Edit</DialogTitle>
            <DialogDescription>
              Please provide a reason for editing the clinical notes. This will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Reason (required)</Label>
            <Textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Enter reason for editing clinical notes (min 10 characters)..."
              className="text-xs min-h-[60px] resize-none"
              data-testid="input-edit-reason"
            />
            {editReason.trim().length > 0 && editReason.trim().length < 10 && (
              <p className="text-xs text-destructive" data-testid="text-reason-error">Reason must be at least 10 characters</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setShowReasonModal(false); setEditReason(""); }}
              disabled={clinicalNotesMutation.isPending}
              data-testid="button-cancel-reason"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={editReason.trim().length < 10 || clinicalNotesMutation.isPending}
              data-testid="button-confirm-save"
            >
              {clinicalNotesMutation.isPending ? "Saving..." : "Confirm Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageChangeOpen} onOpenChange={(open) => { if (!open) { setStageChangeOpen(false); setStageChangeTarget(null); setStageRemarks(""); setSurgeryDate(""); setSurgeryTime(""); setSurgeryAlertUserId(""); } }}>
        <DialogContent className={stageChangeTarget === "Surgery Scheduled" ? "max-w-lg" : ""}>
          <DialogHeader>
            <DialogTitle>{stageChangeTarget === "Surgery Scheduled" ? "Schedule Surgery" : "Stage Transition Remarks"}</DialogTitle>
            <DialogDescription>
              Moving from <span className="font-semibold">{episode.status}</span> to <span className="font-semibold">{stageChangeTarget}</span>.
              {stageChangeTarget === "Surgery Scheduled" ? " Please provide surgery details." : " Please provide remarks for this stage change."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {stageChangeTarget === "Surgery Scheduled" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Surgery Date <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={surgeryDate}
                      onChange={(e) => setSurgeryDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="text-sm"
                      data-testid="input-surgery-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Surgery Time</Label>
                    <Input
                      type="time"
                      value={surgeryTime}
                      onChange={(e) => setSurgeryTime(e.target.value)}
                      className="text-sm"
                      data-testid="input-surgery-time"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Alert / Notify User</Label>
                  <SearchableSelect
                    value={surgeryAlertUserId}
                    onValueChange={setSurgeryAlertUserId}
                    options={(crmUsers || []).map((u: any) => ({ value: String(u.id), label: u.name || u.email }))}
                    placeholder="Select user to receive surgery alert..."
                    data-testid="select-surgery-alert-user"
                  />
                  <p className="text-xs text-muted-foreground">A task will be auto-created for this user with the surgery date.</p>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Remarks (required)</Label>
              <Textarea
                value={stageRemarks}
                onChange={(e) => setStageRemarks(e.target.value)}
                placeholder="Enter remarks for this stage transition (min 5 characters)..."
                className="text-sm min-h-[80px] resize-none"
                data-testid="textarea-stage-remarks"
              />
              {stageRemarks.trim().length > 0 && stageRemarks.trim().length < 5 && (
                <p className="text-xs text-destructive" data-testid="text-stage-remarks-error">Remarks must be at least 5 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setStageChangeOpen(false); setStageChangeTarget(null); setStageRemarks(""); setSurgeryDate(""); setSurgeryTime(""); setSurgeryAlertUserId(""); }}
              disabled={updateEpisode.isPending}
              data-testid="button-cancel-stage-change"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStageChange}
              disabled={stageRemarks.trim().length < 5 || (stageChangeTarget === "Surgery Scheduled" && !surgeryDate) || updateEpisode.isPending}
              data-testid="button-confirm-stage-change"
            >
              {updateEpisode.isPending ? "Updating..." : stageChangeTarget === "Surgery Scheduled" ? "Schedule Surgery" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function ReferralReadyCard({ episode, onUpdate }: { episode: any; onUpdate: () => void }) {
  const { toast } = useToast();
  const referralReadyStatuses = ["Post Care", "Follow Up", "Completed", "Surgery Done", "In Treatment"];
  const showCard = referralReadyStatuses.includes(episode.status);

  const markReadyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/episodes/${episode.id}/referral-ready`),
    onSuccess: () => {
      onUpdate();
      toast({ title: "Episode marked as referral-ready" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!showCard) return null;

  return (
    <Card className="p-4" data-testid="card-referral-ready">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <Gift className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Referral Program</h3>
            <p className="text-xs text-muted-foreground">
              {episode.referralReady
                ? `Marked referral-ready on ${episode.referralReadyAt ? fmtDate(episode.referralReadyAt) : "—"}`
                : "Patient may be ready to refer others"}
            </p>
          </div>
        </div>
        {episode.referralReady ? (
          <Badge variant="default" className="bg-green-600" data-testid="badge-referral-ready">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Referral Ready
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markReadyMutation.mutate()}
            disabled={markReadyMutation.isPending}
            data-testid="button-mark-referral-ready"
          >
            <Gift className="h-4 w-4 mr-2" />
            {markReadyMutation.isPending ? "Marking..." : "Mark as Referral Ready"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function LogAndNextActionCard({ episode }: { episode: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateEpisode = useUpdateEpisode();
  const { crmUser } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);

  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [selectedRemarkCode, setSelectedRemarkCode] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [nextActionTypeId, setNextActionTypeId] = useState(
    episode.nextActionTypeId ? String(episode.nextActionTypeId) : ""
  );
  const [nextActionDate, setNextActionDate] = useState(
    episode.nextActionDate ? format(new Date(episode.nextActionDate), "yyyy-MM-dd'T'HH:mm") : ""
  );
  const [nextActionNotes, setNextActionNotes] = useState(episode.nextActionNotes || "");
  const [nextActionAssignedTo, setNextActionAssignedTo] = useState(
    episode.nextActionAssignedTo ? String(episode.nextActionAssignedTo) : (crmUser?.id ? String(crmUser.id) : "")
  );

  useEffect(() => {
    if (!nextActionAssignedTo && crmUser?.id) {
      setNextActionAssignedTo(String(crmUser.id));
    }
  }, [crmUser?.id]);

  const { data: outcomesData = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/consultationOutcomes"],
    enabled: expanded,
  });
  const activeOutcomes = (outcomesData || []).filter((o: any) => o.status === "Active");

  const { data: remarksData = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/consultationOutcomeRemarks"],
    enabled: expanded,
  });
  const activeRemarks = (remarksData || []).filter((r: any) => r.status === "Active");

  const filteredRemarks = useMemo(() => {
    if (!selectedOutcome) return [];
    const outcome = activeOutcomes.find((o: any) => String(o.id) === selectedOutcome);
    if (!outcome) return [];
    return activeRemarks.filter((r: any) => r.outcomeCode === outcome.code);
  }, [selectedOutcome, activeOutcomes, activeRemarks]);

  const selectedOutcomeObj = activeOutcomes.find((o: any) => String(o.id) === selectedOutcome);
  const closesEpisode = selectedOutcomeObj?.closesEpisode === true;
  const showNextAction = selectedOutcome && !closesEpisode;

  const { data: nextActionTypesData = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/nextActionTypes"],
    enabled: expanded,
  });
  const activeNextActionTypes = (nextActionTypesData || []).filter(
    (t: any) => t.status === "Active"
  );

  const { data: activeCrmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: expanded,
  });

  const logActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/leads/${episode.leadId}/activities`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", episode.leadId, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Error logging activity", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = async () => {
    if (!selectedOutcome) return;

    const outcomeName = selectedOutcomeObj?.name || "";
    const remarkLabel = selectedRemarkCode
      ? filteredRemarks.find((r: any) => r.code === selectedRemarkCode)?.name || ""
      : "";
    const fullDescription = [
      `Outcome: ${outcomeName}`,
      remarkLabel ? remarkLabel : null,
      remarkText.trim() && remarkText.trim() !== remarkLabel ? remarkText.trim() : null,
      additionalNotes.trim() ? additionalNotes.trim() : null,
    ].filter(Boolean).join(" — ");

    logActivityMutation.mutate({
      leadId: episode.leadId,
      tenantId: episode.tenantId,
      type: "consultation_outcome",
      description: fullDescription,
      outcome: outcomeName,
    });

    const episodeFields: Record<string, any> = {};

    if (episode.status === "Consultation In Progress") {
      episodeFields.status = "Consultation Done";
      episodeFields.stageRemarks = `Consultation completed — ${outcomeName}`;
    }

    if (closesEpisode) {
      const closesAs = selectedOutcomeObj?.closesAs || "Closed Won";
      episodeFields.status = closesAs;
      episodeFields.stageRemarks = remarkText
        ? `${outcomeName} — ${remarkText}`
        : `Episode closed — ${outcomeName}`;
      episodeFields.endDate = new Date().toISOString();
      episodeFields.decisionStatus = closesAs === "Closed Lost" ? "Declined" : "Completed";
      if (additionalNotes.trim()) episodeFields.decisionNotes = additionalNotes.trim();
    } else {
      if (nextActionTypeId) episodeFields.nextActionTypeId = Number(nextActionTypeId);
      if (nextActionDate) episodeFields.nextActionDate = new Date(nextActionDate).toISOString();
      if (nextActionNotes.trim()) episodeFields.nextActionNotes = nextActionNotes.trim();
      episodeFields.nextActionAssignedTo = nextActionAssignedTo ? Number(nextActionAssignedTo) : (crmUser?.id || null);
    }

    if (Object.keys(episodeFields).length > 0) {
      updateEpisode.mutate(
        { id: episode.id, ...episodeFields },
        {
          onSuccess: () => {
            const msg = closesEpisode ? "Consultation logged & episode closed" : "Consultation logged & next action set";
            toast({ title: msg });
            queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
            setSelectedOutcome("");
            setSelectedRemarkCode("");
            setRemarkText("");
            setAdditionalNotes("");
            setNextActionTypeId("");
            setNextActionDate("");
            setNextActionNotes("");
          },
          onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          },
        }
      );
    } else {
      toast({ title: "Activity logged" });
      setSelectedOutcome("");
      setSelectedRemarkCode("");
      setRemarkText("");
      setAdditionalNotes("");
    }
  };

  const currentNextActionType = episode.nextActionTypeId
    ? nextActionTypesData.find((t: any) => t.id === episode.nextActionTypeId)?.name
    : null;

  const assigneeName = episode.nextActionAssignedTo
    ? activeCrmUsers.find((u: any) => u.id === episode.nextActionAssignedTo)?.name
    : null;

  const isClosed = episode.status === "Closed Won" || episode.status === "Closed Lost";

  return (
    <Card className="p-4" data-testid="card-log-next-action">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-log-next-action"
      >
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Consultation Log
        </h3>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      {episode.nextActionDate && !expanded && (
        <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="outline" className="text-[10px]" data-testid="badge-current-next-action">
            <CalendarClock className="w-3 h-3 mr-1" />
            Next: {currentNextActionType || "Action"} on {fmtDateTime(episode.nextActionDate)}
          </Badge>
          {assigneeName && (
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-next-action-assignee">
              → {assigneeName}
            </Badge>
          )}
          {episode.nextActionNotes && (
            <span className="text-muted-foreground truncate max-w-[200px]">{episode.nextActionNotes}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-4">
          {isClosed && (
            <div className="p-3 rounded-md bg-muted/50 border text-center">
              <p className="text-xs text-muted-foreground">This episode is <span className="font-semibold">{episode.status}</span>. No further actions required.</p>
            </div>
          )}

          {!isClosed && (
            <>
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Step 1: Consultation Outcome
                </h4>
                <SearchableSelect
                  value={selectedOutcome}
                  onValueChange={(val) => {
                    setSelectedOutcome(val);
                    setSelectedRemarkCode("");
                    setRemarkText("");
                  }}
                  options={activeOutcomes.map((o: any) => ({ value: String(o.id), label: o.name }))}
                  placeholder="What was the outcome of this consultation?"
                  triggerClassName="text-xs"
                  data-testid="select-consultation-outcome"
                />

                {selectedOutcome && closesEpisode && (
                  <div className="flex items-center gap-1.5 p-2 rounded-md bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      This will close the episode as <span className="font-semibold">{selectedOutcomeObj?.closesAs}</span>
                    </p>
                  </div>
                )}
              </div>

              {selectedOutcome && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Step 2: Remarks
                  </h4>

                  {filteredRemarks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" data-testid="remark-chips">
                      {filteredRemarks.map((r: any) => (
                        <button
                          key={r.code}
                          onClick={() => {
                            if (selectedRemarkCode === r.code) {
                              setSelectedRemarkCode("");
                              setRemarkText("");
                            } else {
                              setSelectedRemarkCode(r.code);
                              setRemarkText(r.name);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
                            selectedRemarkCode === r.code
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border text-foreground"
                          )}
                          data-testid={`remark-chip-${r.code}`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <Textarea
                    value={remarkText}
                    onChange={(e) => {
                      setRemarkText(e.target.value);
                      if (selectedRemarkCode && e.target.value !== filteredRemarks.find((r: any) => r.code === selectedRemarkCode)?.name) {
                        setSelectedRemarkCode("");
                      }
                    }}
                    placeholder="Type or edit remark..."
                    rows={2}
                    className="text-xs resize-none"
                    data-testid="input-remark-text"
                  />

                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Additional notes (optional)..."
                    rows={2}
                    className="text-xs resize-none"
                    data-testid="input-additional-notes"
                  />
                </div>
              )}

              {showNextAction && (
                <div className="space-y-3 pt-2 border-t">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Step 3: Next Action
                  </h4>

                  {episode.nextActionDate && (
                    <div className="p-2 rounded-md bg-primary/5 border border-primary/10" data-testid="current-next-action-display">
                      <p className="text-xs font-medium text-foreground">
                        Current: {currentNextActionType || "Action"} on {fmtDateTime(episode.nextActionDate)}
                      </p>
                      {assigneeName && (
                        <p className="text-[11px] text-primary font-medium mt-0.5">Assigned to: {assigneeName}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <SearchableSelect
                      value={nextActionTypeId}
                      onValueChange={setNextActionTypeId}
                      options={activeNextActionTypes.map((t: any) => ({ value: String(t.id), label: t.name }))}
                      placeholder="Action Type"
                      triggerClassName="text-xs"
                      data-testid="select-next-action-type"
                    />
                    <SearchableSelect
                      value={nextActionAssignedTo}
                      onValueChange={setNextActionAssignedTo}
                      options={activeCrmUsers.map((u: any) => ({ value: String(u.id), label: u.name }))}
                      placeholder="Assign To"
                      triggerClassName="text-xs"
                      data-testid="select-next-action-assigned-to"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="datetime-local"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                      className="text-xs"
                      data-testid="input-next-action-date"
                    />
                    <Input
                      value={nextActionNotes}
                      onChange={(e) => setNextActionNotes(e.target.value)}
                      placeholder="Action notes..."
                      className="text-xs"
                      data-testid="input-next-action-notes"
                    />
                  </div>
                </div>
              )}

              {selectedOutcome && (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!selectedOutcome || logActivityMutation.isPending || updateEpisode.isPending}
                  className="w-full"
                  data-testid="button-submit-consultation-log"
                >
                  {logActivityMutation.isPending || updateEpisode.isPending
                    ? "Saving..."
                    : closesEpisode
                      ? `Log & Close Episode (${selectedOutcomeObj?.closesAs})`
                      : showNextAction && nextActionTypeId
                        ? "Log & Set Next Action"
                        : "Log Consultation"
                  }
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function FinancialTab({ episode, onUpdate, isPending }: { episode: any; onUpdate: (fields: Record<string, any>) => void; isPending: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: discountApproverData } = useQuery<{ canApprove: boolean }>({
    queryKey: ["/api/discount-approvers/me"],
    queryFn: async () => {
      const res = await fetch("/api/discount-approvers/me", { credentials: "include" });
      if (!res.ok) return { canApprove: false };
      return res.json();
    },
    staleTime: 1000 * 30,
  });
  const canApproveDiscount = discountApproverData?.canApprove ?? false;

  const initialQuote = episode.initialQuote || 0;
  const isDiscountApproved = episode.discountStatus === "Approved";
  const approvedDiscount = isDiscountApproved ? (episode.approvedDiscount || 0) : 0;
  const finalQuote = isDiscountApproved ? Math.max(0, initialQuote - approvedDiscount) : initialQuote;
  const actualBill = episode.actualBill || 0;

  const isApproved = episode.discountStatus === "Approved";
  const isDraft = !episode.discountStatus || episode.discountStatus === "Draft";
  const isPendingDiscount = episode.discountStatus === "Pending";
  const isRevoked = episode.discountStatus === "Revoked";

  const [localInitialQuote, setLocalInitialQuote] = useState<number>(initialQuote);
  const [localDiscountPercent, setLocalDiscountPercent] = useState<number>(episode.discountPercent ?? 0);
  const [localDiscountAmount, setLocalDiscountAmount] = useState<number>(episode.discountAmount ?? 0);
  const [localDiscountNotes, setLocalDiscountNotes] = useState<string>(episode.discountNotes || "");
  const [localActualBill, setLocalActualBill] = useState<number>(actualBill);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  useEffect(() => {
    setLocalInitialQuote(episode.initialQuote || 0);
    setLocalDiscountPercent(episode.discountPercent ?? 0);
    setLocalDiscountAmount(episode.discountAmount ?? 0);
    setLocalDiscountNotes(episode.discountNotes || "");
    setLocalActualBill(episode.actualBill || 0);
  }, [episode.initialQuote, episode.discountPercent, episode.discountAmount, episode.discountNotes, episode.actualBill]);

  const localFinalQuote = isDiscountApproved ? Math.max(0, localInitialQuote - approvedDiscount) : localInitialQuote;
  const localVariance = localFinalQuote - localActualBill;

  const handlePercentChange = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    setLocalDiscountPercent(clamped);
  };

  const handleAmountChange = (amt: number) => {
    const clamped = Math.min(localInitialQuote, Math.max(0, amt));
    setLocalDiscountAmount(clamped);
  };

  const handleInitialQuoteChange = (val: number) => {
    setLocalInitialQuote(val);
  };

  const submitDiscount = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/episodes/${episode.id}/discount`, {
        originalQuotedAmount: localInitialQuote,
        discountPercent: localDiscountPercent,
        discountAmount: localDiscountAmount,
        discountNotes: localDiscountNotes,
        discountType: localDiscountPercent > 0 ? "Percentage" : "Flat",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Discount submitted for approval" });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveDiscount = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/episodes/${episode.id}/discount/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Discount approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeDiscount = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/episodes/${episode.id}/discount/revoke`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Discount revoked" });
      setRevokeDialogOpen(false);
      setRevokeReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSaveActualBill = () => {
    onUpdate({ actualBill: localActualBill });
  };

  const handleSaveInitialQuote = () => {
    onUpdate({ initialQuote: localInitialQuote, originalQuotedAmount: localInitialQuote });
  };

  const discountStatusBadge = isApproved
    ? "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300"
    : isPendingDiscount
      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
      : isRevoked
        ? "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300"
        : "bg-muted text-muted-foreground";

  const fieldsReadOnly = isApproved;

  const { data: quoteItems = [] } = useQuery<any[]>({
    queryKey: ["/api/episodes", episode.id, "quote-items"],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episode.id}/quote-items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: costHeadsList = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/costHeads"],
  });

  const { data: roomTypesList = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/roomTypes"],
  });

  const [localRoomTypeId, setLocalRoomTypeId] = useState<string>(episode.roomTypeId ? String(episode.roomTypeId) : "");
  const [localRoomNumber, setLocalRoomNumber] = useState<string>(episode.roomNumber || "");

  useEffect(() => {
    setLocalRoomTypeId(episode.roomTypeId ? String(episode.roomTypeId) : "");
    setLocalRoomNumber(episode.roomNumber || "");
  }, [episode.roomTypeId, episode.roomNumber]);

  const handleSaveRoom = () => {
    onUpdate({
      roomTypeId: localRoomTypeId ? Number(localRoomTypeId) : null,
      roomNumber: localRoomNumber || null,
    });
  };

  const roomChanged = (localRoomTypeId !== (episode.roomTypeId ? String(episode.roomTypeId) : "")) ||
    (localRoomNumber !== (episode.roomNumber || ""));

  return (
    <div className="space-y-4">
      <QuotationSection
        episode={episode}
        quoteItems={quoteItems}
        costHeadsList={costHeadsList}
        quoteDialogOpen={quoteDialogOpen}
        setQuoteDialogOpen={setQuoteDialogOpen}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4" data-testid="card-quote-billing">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" />
            Quote & Billing
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Initial Quote (₹)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={localInitialQuote || ""}
                  onChange={(e) => handleInitialQuoteChange(Number(e.target.value) || 0)}
                  disabled={fieldsReadOnly || quoteItems.length > 0}
                  className="text-xs"
                  data-testid="input-initial-quote"
                />
                {localInitialQuote !== initialQuote && !fieldsReadOnly && quoteItems.length === 0 && (
                  <Button size="sm" variant="outline" onClick={handleSaveInitialQuote} disabled={isPending} data-testid="button-save-initial-quote">
                    <Save className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {quoteItems.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Auto-calculated from quotation items</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isDiscountApproved ? "Approved Discount (₹)" : "Discount (₹)"}
              </Label>
              <Input
                type="number"
                value={isDiscountApproved ? approvedDiscount : (episode.discountAmount ?? 0)}
                readOnly
                className="text-xs bg-muted"
                data-testid="input-approved-discount"
              />
              {isPendingDiscount && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Pending approval — not applied to final quote</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Final Quote (₹)</Label>
              <Input
                type="number"
                value={localFinalQuote}
                readOnly
                className="text-xs bg-muted font-medium"
                data-testid="input-final-quote"
              />
            </div>

            <div className="border-t border-border pt-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Actual Bill (₹)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={localActualBill || ""}
                    onChange={(e) => setLocalActualBill(Number(e.target.value) || 0)}
                    className="text-xs"
                    data-testid="input-actual-bill"
                  />
                  {localActualBill !== actualBill && (
                    <Button size="sm" variant="outline" onClick={handleSaveActualBill} disabled={isPending} data-testid="button-save-actual-bill">
                      <Save className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mt-3">
                <Label className="text-xs text-muted-foreground">Variance (₹)</Label>
                <div className={cn(
                  "px-3 py-2 rounded-md text-sm font-semibold",
                  localVariance > 0 ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" :
                  localVariance < 0 ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" :
                  "bg-muted text-muted-foreground"
                )} data-testid="text-variance">
                  {localVariance > 0 ? "+" : ""}{localVariance.toLocaleString()}
                  {localVariance !== 0 && (
                    <span className="text-xs font-normal ml-2">
                      ({localVariance > 0 ? "Under budget" : "Over budget"})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4" data-testid="card-financial-negotiation">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Discount Request
            </h3>
            <Badge className={cn("text-xs", discountStatusBadge)} data-testid="badge-discount-status">
              {episode.discountStatus || "Draft"}
            </Badge>
          </div>

          {isApproved && episode.discountApprovedBy && (
            <p className="text-xs text-green-700 dark:text-green-400 mb-3" data-testid="text-discount-approved-info">
              Approved by {episode.discountApprovedBy}
              {episode.discountApprovedAt && ` on ${fmtDate(episode.discountApprovedAt)}`}
            </p>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Discount %</Label>
                <Input
                  type="number"
                  value={localDiscountPercent || ""}
                  onChange={(e) => handlePercentChange(Number(e.target.value) || 0)}
                  disabled={fieldsReadOnly}
                  className="text-xs"
                  data-testid="input-discount-percent"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Discount Amount (₹)</Label>
                <Input
                  type="number"
                  value={localDiscountAmount || ""}
                  onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                  disabled={fieldsReadOnly}
                  className="text-xs"
                  data-testid="input-discount-amount"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Discount Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={localDiscountNotes}
                onChange={(e) => setLocalDiscountNotes(e.target.value)}
                disabled={fieldsReadOnly}
                placeholder="Reason for discount (mandatory)..."
                className="text-xs min-h-[60px] resize-none"
                data-testid="textarea-discount-notes"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 flex-wrap">
              {!isApproved && (
                <Button
                  onClick={() => submitDiscount.mutate()}
                  disabled={submitDiscount.isPending || !localDiscountNotes.trim() || localInitialQuote <= 0}
                  data-testid="button-submit-discount"
                >
                  {submitDiscount.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              )}

              {canApproveDiscount && (isPendingDiscount || isDraft) && localDiscountAmount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => approveDiscount.mutate()}
                  disabled={approveDiscount.isPending}
                  data-testid="button-approve-discount"
                >
                  {approveDiscount.isPending ? "Approving..." : "Approve"}
                </Button>
              )}

              {canApproveDiscount && isApproved && (
                <Button
                  variant="outline"
                  onClick={() => setRevokeDialogOpen(true)}
                  data-testid="button-revoke-discount"
                >
                  Revoke Approval
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4" data-testid="card-room-allocation">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary" />
            Room Allocation
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Room Type</Label>
              <SearchableSelect
                value={localRoomTypeId}
                onValueChange={(val) => setLocalRoomTypeId(val || "")}
                options={(roomTypesList as any[]).filter((r: any) => r.status === "Active" && r.approvalStatus === "Approved").map((r: any) => ({ value: String(r.id), label: r.name }))}
                placeholder="Select room type"
                triggerClassName="text-xs"
                data-testid="select-room-type"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Room Number (optional)</Label>
              <Input
                value={localRoomNumber}
                onChange={(e) => setLocalRoomNumber(e.target.value)}
                placeholder="e.g., 301-A"
                className="text-xs"
                data-testid="input-room-number"
              />
            </div>
            {roomChanged && (
              <Button size="sm" onClick={handleSaveRoom} disabled={isPending} data-testid="button-save-room">
                <Save className="w-3 h-3 mr-1" /> Save Room Details
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4" data-testid="card-financial-revenue">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Revenue Projection
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-32 shrink-0">Probability</span>
              <div className="flex items-center gap-2 flex-1">
                {episode.revenueProbability != null ? (
                  <>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", episode.revenueProbability >= 70 ? "bg-green-500" : episode.revenueProbability >= 40 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${episode.revenueProbability}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">{episode.revenueProbability}%</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Not calculated</span>
                )}
              </div>
            </div>
            <InfoRow label="Expected Revenue" value={episode.expectedRevenueAmount ? `₹${episode.expectedRevenueAmount.toLocaleString()}` : null} />
          </div>
        </Card>
      </div>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Discount Approval</DialogTitle>
            <DialogDescription>
              Please provide a reason for revoking this discount approval.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Reason for revoking..."
            className="text-xs min-h-[80px] resize-none"
            data-testid="textarea-revoke-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)} data-testid="button-cancel-revoke">
              Cancel
            </Button>
            <Button
              onClick={() => revokeDiscount.mutate(revokeReason)}
              disabled={!revokeReason.trim() || revokeDiscount.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeDiscount.isPending ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuotationSection({ episode, quoteItems, costHeadsList, quoteDialogOpen, setQuoteDialogOpen }: {
  episode: any;
  quoteItems: any[];
  costHeadsList: any[];
  quoteDialogOpen: boolean;
  setQuoteDialogOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeCostHeads = (costHeadsList as any[]).filter((ch: any) => ch.status === "Active" && ch.approvalStatus === "Approved");
  const deptCostHeads = episode.treatmentDepartmentId
    ? activeCostHeads.filter((ch: any) => !ch.treatmentDepartmentId || ch.treatmentDepartmentId === episode.treatmentDepartmentId)
    : activeCostHeads;

  const [rows, setRows] = useState<Array<{ costHeadId: string; amount: string; remarks: string }>>([]);

  useEffect(() => {
    if (quoteDialogOpen) {
      if (quoteItems.length > 0) {
        setRows(quoteItems.map((qi: any) => ({
          costHeadId: String(qi.costHeadId),
          amount: String(qi.amount),
          remarks: qi.remarks || "",
        })));
      } else {
        setRows([{ costHeadId: "", amount: "", remarks: "" }]);
      }
    }
  }, [quoteDialogOpen, quoteItems]);

  const addRow = () => setRows([...rows, { costHeadId: "", amount: "", remarks: "" }]);
  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };
  const updateRow = (idx: number, field: string, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    setRows(updated);
  };

  const runningTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const saveQuote = useMutation({
    mutationFn: async () => {
      const validItems = rows.filter(r => r.costHeadId && Number(r.amount) > 0);
      const res = await apiRequest("POST", `/api/episodes/${episode.id}/quote-items`, {
        items: validItems.map(r => ({
          costHeadId: Number(r.costHeadId),
          amount: Number(r.amount),
          remarks: r.remarks || null,
        })),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quotation saved" });
      setQuoteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id, "quote-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const quoteTotal = quoteItems.reduce((sum: number, qi: any) => sum + (qi.amount || 0), 0);

  return (
    <Card className="p-4" data-testid="card-quotation">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Quotation
        </h3>
        <Button size="sm" onClick={() => setQuoteDialogOpen(true)} data-testid="button-create-quote">
          <Plus className="w-3 h-3 mr-1" />
          {quoteItems.length > 0 ? "Edit Quote" : "Create Quote"}
        </Button>
      </div>

      {quoteItems.length > 0 ? (
        <div className="space-y-2">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cost Head</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount (₹)</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {quoteItems.map((qi: any, idx: number) => (
                  <tr key={qi.id} className="border-t border-border" data-testid={`row-quote-item-${qi.id}`}>
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{qi.costHeadName}</td>
                    <td className="px-3 py-2 text-right">₹{(qi.amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted-foreground">{qi.remarks || "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-right">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-primary">₹{quoteTotal.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No quotation items yet. Click "Create Quote" to add itemized costs.</p>
      )}

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{quoteItems.length > 0 ? "Edit Quotation" : "Create Quotation"}</DialogTitle>
            <DialogDescription>Add cost heads and amounts for this episode.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-start gap-2" data-testid={`quote-row-${idx}`}>
                <div className="flex-1 min-w-[140px]">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Cost Head</Label>}
                  <SearchableSelect
                    value={row.costHeadId}
                    onValueChange={(val) => updateRow(idx, "costHeadId", val || "")}
                    options={deptCostHeads.map((ch: any) => ({ value: String(ch.id), label: ch.name }))}
                    placeholder="Select cost head"
                    triggerClassName="text-xs"
                    data-testid={`select-cost-head-${idx}`}
                  />
                </div>
                <div className="w-32">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Amount (₹)</Label>}
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateRow(idx, "amount", e.target.value)}
                    placeholder="0"
                    className="text-xs"
                    data-testid={`input-quote-amount-${idx}`}
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Remarks</Label>}
                  <Input
                    value={row.remarks}
                    onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                    placeholder="Optional"
                    className="text-xs"
                    data-testid={`input-quote-remarks-${idx}`}
                  />
                </div>
                <div className={idx === 0 ? "mt-5" : ""}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length <= 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-row-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRow} className="w-full" data-testid="button-add-quote-row">
              <Plus className="w-3 h-3 mr-1" /> Add Row
            </Button>

            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold text-primary" data-testid="text-quote-total">
                ₹{runningTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)} data-testid="button-cancel-quote">
              Cancel
            </Button>
            <Button
              onClick={() => saveQuote.mutate()}
              disabled={saveQuote.isPending || rows.every(r => !r.costHeadId || !Number(r.amount))}
              data-testid="button-save-quote"
            >
              {saveQuote.isPending ? "Saving..." : "Save Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InsuranceTab({
  episode,
  onUpdate,
  isPending,
  insurers,
  tpas,
  policyTypes,
  preauthStatuses,
  rejectionReasons,
}: {
  episode: any;
  onUpdate: (fields: Record<string, any>) => void;
  isPending: boolean;
  insurers: any[];
  tpas: any[];
  policyTypes: any[];
  preauthStatuses: any[];
  rejectionReasons: any[];
}) {
  const { toast } = useToast();

  const requestNewMaster = useMutation({
    mutationFn: async ({ tableName, name }: { tableName: string; name: string }) => {
      const res = await apiRequest("POST", `/api/masters/${tableName}`, {
        code: name.toUpperCase().replace(/\s+/g, "_").substring(0, 20),
        name,
        status: "Active",
        approvalStatus: "Pending",
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Request submitted", description: `"${variables.name}" has been submitted for approval.` });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const buildOptions = (items: any[]) =>
    items.map((item: any) => ({ value: String(item.id), label: item.name }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4 md:col-span-2" data-testid="card-insurance-applicable">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Insurance Applicable
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Toggle to enable insurance details for this episode</p>
          </div>
          <Switch
            checked={!!episode.insuranceApplicable}
            onCheckedChange={(checked) => onUpdate({ insuranceApplicable: checked })}
            disabled={isPending}
            data-testid="switch-insurance-applicable"
          />
        </div>
      </Card>

      {episode.insuranceApplicable && (
        <>
          <Card className="p-4" data-testid="card-insurance-details">
            <h3 className="text-sm font-semibold text-foreground mb-3">Insurance Provider</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Insurer</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { const name = window.prompt("Enter new insurer name:"); if (name) requestNewMaster.mutate({ tableName: "insurers", name }); }}
                    data-testid="button-request-new-insurer">
                    <Plus className="w-3 h-3 mr-1" />Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.insurerId ? String(episode.insurerId) : ""}
                  onValueChange={(val) => onUpdate({ insurerId: val ? Number(val) : null })}
                  options={buildOptions(insurers)}
                  placeholder="Select insurer"
                  triggerClassName="text-xs"
                  data-testid="select-insurer"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">TPA</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { const name = window.prompt("Enter new TPA name:"); if (name) requestNewMaster.mutate({ tableName: "tpas", name }); }}
                    data-testid="button-request-new-tpa">
                    <Plus className="w-3 h-3 mr-1" />Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.tpaId ? String(episode.tpaId) : ""}
                  onValueChange={(val) => onUpdate({ tpaId: val ? Number(val) : null })}
                  options={buildOptions(tpas)}
                  placeholder="Select TPA"
                  triggerClassName="text-xs"
                  data-testid="select-tpa"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Policy Type</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { const name = window.prompt("Enter new policy type name:"); if (name) requestNewMaster.mutate({ tableName: "policyTypes", name }); }}
                    data-testid="button-request-new-policy-type">
                    <Plus className="w-3 h-3 mr-1" />Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.policyTypeId ? String(episode.policyTypeId) : ""}
                  onValueChange={(val) => onUpdate({ policyTypeId: val ? Number(val) : null })}
                  options={buildOptions(policyTypes)}
                  placeholder="Select policy type"
                  triggerClassName="text-xs"
                  data-testid="select-policy-type"
                />
              </div>
            </div>
          </Card>

          <Card className="p-4" data-testid="card-insurance-preauth">
            <h3 className="text-sm font-semibold text-foreground mb-3">Pre-Authorization</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Pre-Auth Status</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { const name = window.prompt("Enter new pre-auth status name:"); if (name) requestNewMaster.mutate({ tableName: "preauthStatuses", name }); }}
                    data-testid="button-request-new-preauth-status">
                    <Plus className="w-3 h-3 mr-1" />Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.preauthStatusId ? String(episode.preauthStatusId) : ""}
                  onValueChange={(val) => onUpdate({ preauthStatusId: val ? Number(val) : null })}
                  options={buildOptions(preauthStatuses)}
                  placeholder="Select pre-auth status"
                  triggerClassName="text-xs"
                  data-testid="select-preauth-status"
                />
              </div>
              {episode.preauthSubmittedAt && (
                <InfoRow label="Submitted At" value={fmtDateTime(episode.preauthSubmittedAt)} />
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Initial Approval Amount (₹)</Label>
                <Input
                  type="number"
                  value={episode.initialApprovalAmount || ""}
                  onChange={(e) => onUpdate({ initialApprovalAmount: Number(e.target.value) || null })}
                  placeholder="Amount initially approved"
                  className="text-xs"
                  data-testid="input-initial-approval-amount"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Final Approved Amount (₹)</Label>
                <Input
                  type="number"
                  value={episode.preauthApprovedAmount || ""}
                  onChange={(e) => onUpdate({ preauthApprovedAmount: Number(e.target.value) || null })}
                  placeholder="Final approved amount"
                  className="text-xs"
                  data-testid="input-preauth-approved-amount"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Rejection Reason</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { const name = window.prompt("Enter new rejection reason:"); if (name) requestNewMaster.mutate({ tableName: "rejectionReasons", name }); }}
                    data-testid="button-request-new-rejection-reason">
                    <Plus className="w-3 h-3 mr-1" />Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.rejectionReasonId ? String(episode.rejectionReasonId) : ""}
                  onValueChange={(val) => onUpdate({ rejectionReasonId: val ? Number(val) : null })}
                  options={buildOptions(rejectionReasons)}
                  placeholder="Select rejection reason"
                  triggerClassName="text-xs"
                  data-testid="select-rejection-reason"
                />
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const EP_RELATIONSHIP_OPTIONS = ["Self","Spouse","Parent","Child","Sibling","Guardian","Friend","Colleague","Caregiver","Power of Attorney","Other"];

function PatientContactPersonsPanel({ leadId, patientId }: { leadId?: number; patientId?: number }) {
  const { toast } = useToast();
  // For READING: use patient endpoint (includes both patient-direct + lead-derived)
  const patientQk = patientId ? ["/api/patients", patientId, "contact-persons"] : null;
  // For patient-direct mutations: track patient links only (linkSource === "patient")
  const leadQk = leadId ? ["/api/leads", leadId, "contact-persons"] : null;

  const { data: contactLinks = [], isLoading } = useQuery<any[]>({
    queryKey: patientQk || leadQk || [],
    queryFn: async () => {
      if (patientId) {
        const res = await fetch(`/api/patients/${patientId}/contact-persons`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      }
      if (leadId) {
        const res = await fetch(`/api/leads/${leadId}/contact-persons`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      }
      return [];
    },
    enabled: !!(patientId || leadId),
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", phoneE164: "", whatsappNumber: "", email: "", relationship: "Other",
    isPrimary: false, isBillingContact: false, isEmergencyContact: false,
    isWhatsAppConsentHolder: false, isAppointmentCoordinator: false,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      if (patientId) {
        // Direct patient-contact-person link (patient-specific)
        await apiRequest("POST", `/api/patients/${patientId}/contact-persons`, {
          name: data.name, phoneE164: data.phoneE164 || null,
          whatsappNumber: data.whatsappNumber || null, email: data.email || null,
          relationship: data.relationship,
          isPrimary: data.isPrimary, isBillingContact: data.isBillingContact,
          isEmergencyContact: data.isEmergencyContact,
          isWhatsAppConsentHolder: data.isWhatsAppConsentHolder,
          isAppointmentCoordinator: data.isAppointmentCoordinator,
        });
      } else if (leadId) {
        const cpRes = await apiRequest("POST", "/api/contact-persons", {
          name: data.name, phoneE164: data.phoneE164 || null,
          whatsappNumber: data.whatsappNumber || null, email: data.email || null,
          relationship: data.relationship,
        });
        const cp = await cpRes.json();
        await apiRequest("POST", `/api/leads/${leadId}/contact-persons`, {
          contactPersonId: cp.id, relationship: data.relationship,
          isPrimary: data.isPrimary, isBillingContact: data.isBillingContact,
          isEmergencyContact: data.isEmergencyContact,
          isWhatsAppConsentHolder: data.isWhatsAppConsentHolder,
          isAppointmentCoordinator: data.isAppointmentCoordinator,
        });
      }
    },
    onSuccess: () => {
      if (patientQk) queryClient.invalidateQueries({ queryKey: patientQk });
      if (leadQk) queryClient.invalidateQueries({ queryKey: leadQk });
      toast({ title: "Contact person added" });
      setShowForm(false);
      setFormData({ name: "", phoneE164: "", whatsappNumber: "", email: "", relationship: "Other",
        isPrimary: false, isBillingContact: false, isEmergencyContact: false,
        isWhatsAppConsentHolder: false, isAppointmentCoordinator: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (link: { id: number; linkSource?: string }) => {
      if (link.linkSource === "patient" && patientId) {
        // Remove from patientContactLinks
        await apiRequest("DELETE", `/api/patients/${patientId}/contact-persons/${link.id}`, null);
      } else if (leadId) {
        // Remove lead contact-person link (with reachability guard)
        const res = await apiRequest("DELETE", `/api/leads/${leadId}/contact-persons/${link.id}`, null);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Cannot remove contact");
        }
      }
    },
    onSuccess: () => {
      if (patientQk) queryClient.invalidateQueries({ queryKey: patientQk });
      if (leadQk) queryClient.invalidateQueries({ queryKey: leadQk });
      toast({ title: "Contact person removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!patientId && !leadId) return <p className="text-xs text-muted-foreground italic">No lead linked to this episode.</p>;

  return (
    <div className="space-y-3" data-testid="patient-contact-persons-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{contactLinks.length} contact person{contactLinks.length !== 1 ? "s" : ""}</span>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
          onClick={() => setShowForm(s => !s)} data-testid="button-add-patient-cp">
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {showForm && (
        <Card className="p-3 border-primary/20 bg-primary/5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Full Name *</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Name" className="h-7 text-xs mt-0.5" data-testid="input-ep-cp-name" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Phone</Label>
              <Input value={formData.phoneE164} onChange={e => setFormData(p => ({ ...p, phoneE164: e.target.value }))}
                placeholder="+91..." className="h-7 text-xs mt-0.5" data-testid="input-ep-cp-phone" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Relationship</Label>
              <Select value={formData.relationship} onValueChange={v => setFormData(p => ({ ...p, relationship: v }))}>
                <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-ep-cp-rel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EP_RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {([
              { key: "isPrimary", label: "Primary" },
              { key: "isBillingContact", label: "Billing" },
              { key: "isEmergencyContact", label: "Emergency" },
              { key: "isWhatsAppConsentHolder", label: "WA Consent" },
              { key: "isAppointmentCoordinator", label: "Appt Coord" },
            ] as const).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1 text-[10px] cursor-pointer"
                data-testid={`ep-cp-toggle-${key}`}>
                <Switch checked={(formData as any)[key]}
                  onCheckedChange={v => setFormData(p => ({ ...p, [key]: v }))}
                  className="scale-75" />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => addMutation.mutate(formData)}
              disabled={!formData.name.trim() || addMutation.isPending}
              data-testid="button-ep-cp-save">Add</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => setShowForm(false)} data-testid="button-ep-cp-cancel">Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> :
        contactLinks.length === 0 ? <p className="text-xs text-muted-foreground italic">No contact persons linked to this lead.</p> :
        <div className="space-y-2">
          {contactLinks.map((link: any) => (
            <div key={link.id} className="bg-muted/40 rounded p-2 text-[11px] flex items-start justify-between gap-2"
              data-testid={`ep-contact-person-${link.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-foreground">{link.contactPerson?.name}</span>
                  {link.relationship && <Badge variant="outline" className="text-[9px] py-0 px-1">{link.relationship}</Badge>}
                  {link.isPrimary && <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">Primary</Badge>}
                  {link.isBillingContact && <Badge variant="outline" className="text-[9px] py-0 px-1">Billing</Badge>}
                  {link.isEmergencyContact && <Badge variant="outline" className="text-[9px] py-0 px-1">Emergency</Badge>}
                  {link.isWhatsAppConsentHolder && <Badge variant="outline" className="text-[9px] py-0 px-1">WA Consent</Badge>}
                  {link.isAppointmentCoordinator && <Badge variant="outline" className="text-[9px] py-0 px-1">Appt Coord</Badge>}
                </div>
                {link.contactPerson?.phoneE164 && (
                  <p className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                    <Phone className="w-2.5 h-2.5" />{link.contactPerson.phoneE164}
                  </p>
                )}
                {link.contactPerson?.email && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="w-2.5 h-2.5" />{link.contactPerson.email}
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-destructive"
                onClick={() => removeMutation.mutate({ id: link.id, linkSource: link.linkSource })}
                disabled={removeMutation.isPending}
                data-testid={`button-ep-remove-cp-${link.id}`}>
                ×
              </Button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function FamilyTab({ episode, onUpdate, isPending }: { episode: any; onUpdate: (fields: Record<string, any>) => void; isPending: boolean }) {
  const [localDecisionNotes, setLocalDecisionNotes] = useState(episode.decisionNotes || "");

  return (
    <div className="space-y-4" data-testid="card-family-status">
      <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        Family & Decision Status
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium text-foreground">Family Discussion Done</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Has the family been consulted about the treatment plan?</p>
          </div>
          <Switch
            checked={!!episode.familyDiscussionDone}
            onCheckedChange={(checked) => onUpdate({ familyDiscussionDone: checked })}
            disabled={isPending}
            data-testid="switch-family-discussion"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium text-foreground">Second Opinion Taken</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Has the patient sought a second medical opinion?</p>
          </div>
          <Switch
            checked={!!episode.secondOpinionTaken}
            onCheckedChange={(checked) => onUpdate({ secondOpinionTaken: checked })}
            disabled={isPending}
            data-testid="switch-second-opinion"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Decision Status</Label>
          <SearchableSelect
            value={episode.decisionStatus || "Pending"}
            onValueChange={(val) => onUpdate({ decisionStatus: val })}
            options={[
              { value: "Pending", label: "Pending" },
              { value: "Approved by Family", label: "Approved by Family" },
              { value: "Rejected by Family", label: "Rejected by Family" },
              { value: "Seeking Second Opinion", label: "Seeking Second Opinion" },
              { value: "Decided to Proceed", label: "Decided to Proceed" },
              { value: "Decided Not to Proceed", label: "Decided Not to Proceed" },
            ]}
            placeholder="Select decision status"
            triggerClassName="text-xs"
            data-testid="select-decision-status"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Decision Notes</Label>
          <Textarea
            value={localDecisionNotes}
            onChange={(e) => setLocalDecisionNotes(e.target.value)}
            onBlur={(e) => {
              if (e.target.value !== (episode.decisionNotes || "")) {
                onUpdate({ decisionNotes: e.target.value });
              }
            }}
            placeholder="Notes about family decision..."
            className="text-xs min-h-[80px] resize-none"
            data-testid="textarea-decision-notes"
          />
        </div>
      </div>
    </Card>

      {episode.leadId && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Contact Persons
          </h3>
          <PatientContactPersonsPanel leadId={episode.leadId} patientId={episode.patientId} />
        </Card>
      )}
    </div>
  );
}

interface JourneyEvent {
  id: string;
  type: "created" | "status_change";
  title: string;
  description?: string;
  stageRemarks?: string;
  timestamp: string;
  performedBy?: string;
  statusTransition?: { from: string; to: string };
  newStatus?: string;
  isTerminal?: boolean;
  surgeryDate?: string;
}

function buildJourneyTimeline(episode: any, auditLogs: AuditLogEntry[]): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  const sortedLogs = [...auditLogs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const hasCreatedLog = sortedLogs.some(log => log.action === "created");

  if (!hasCreatedLog && (episode.startDate || episode.createdAt)) {
    events.push({
      id: "ep-created",
      type: "created",
      title: "Episode Created",
      description: `${episode.episodeName} — treatment journey started`,
      timestamp: episode.startDate || episode.createdAt,
    });
  }

  for (const log of sortedLogs) {
    if (log.action === "created") {
      const newVals = log.newValues as Record<string, any> | null;
      events.push({
        id: `audit-${log.id}`,
        type: "created",
        title: "Episode Created",
        description: newVals?.episodeName ? `${newVals.episodeName} — treatment journey started` : "Treatment journey started",
        timestamp: log.createdAt,
        performedBy: log.performedBy || undefined,
      });
    } else if (log.action === "status_change") {
      const oldVals = log.oldValues as Record<string, any> | null;
      const newVals = log.newValues as Record<string, any> | null;
      const fromStatus = oldVals?.status || "Unknown";
      const toStatus = newVals?.status || "Unknown";
      const terminalStatuses = ["Completed", "Discontinued"];
      events.push({
        id: `audit-${log.id}`,
        type: "status_change",
        title: getStatusChangeTitle(toStatus),
        description: getStatusChangeDescription(fromStatus, toStatus),
        stageRemarks: newVals?.stageRemarks || undefined,
        timestamp: log.createdAt,
        performedBy: log.performedBy || undefined,
        statusTransition: { from: fromStatus, to: toStatus },
        newStatus: toStatus,
        isTerminal: terminalStatuses.includes(toStatus),
        surgeryDate: toStatus === "Surgery Scheduled" ? episode.surgeryDate : undefined,
      });
    }
  }

  return events;
}

function getStatusChangeTitle(toStatus: string): string {
  switch (toStatus) {
    case "Treatment Planning": return "Moved to Treatment Planning";
    case "Surgery Scheduled": return "Surgery Scheduled";
    case "Surgery Done": return "Surgery Completed";
    case "In Treatment": return "Treatment Started";
    case "Post Care": return "Moved to Post Care";
    case "Follow Up": return "Follow Up Initiated";
    case "Completed": return "Episode Completed";
    case "Discontinued": return "Episode Discontinued";
    case "Consultation In Progress": return "Consultation In Progress";
    case "Consultation Done": return "Consultation Completed";
    default: return `Status changed to ${toStatus}`;
  }
}

function getStatusChangeDescription(from: string, to: string): string {
  switch (to) {
    case "Consultation In Progress": return "Patient is currently in consultation with the doctor";
    case "Treatment Planning": return "Patient's treatment plan is being prepared by the clinical team";
    case "Surgery Scheduled": return "Surgery date and logistics have been confirmed";
    case "Surgery Done": return "Surgical procedure has been completed successfully";
    case "In Treatment": return "Patient is actively undergoing treatment";
    case "Post Care": return "Patient is in post-treatment care and recovery phase";
    case "Follow Up": return "Follow-up appointments and monitoring initiated";
    case "Completed": return "Treatment journey completed successfully";
    case "Discontinued": return "Patient chose not to proceed with treatment";
    case "Consultation Done": return "Episode has been restarted from consultation stage";
    default: return `Status changed from ${from} to ${to}`;
  }
}

function InfoRow({ label, value, link }: { label: string; value: any; link?: string }) {
  const [, setLocation] = useLocation();
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      {link ? (
        <button className="text-xs text-primary hover:underline" onClick={() => setLocation(link)} data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {String(value)}
        </button>
      ) : (
        <span className="text-xs text-foreground">{String(value)}</span>
      )}
    </div>
  );
}
