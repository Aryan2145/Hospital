import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useUpdateEpisode } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { getStatusColor, getValidEpisodeTransitions, getPriorityColor } from "@/lib/lead-status";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
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
  Shield,
  Users,
  TrendingUp,
  Plus,
  Pencil,
  Save,
  X,
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

export default function EpisodeDetailPage() {
  const [, params] = useRoute("/episodes/:id");
  const [, setLocation] = useLocation();
  const episodeId = Number(params?.id);
  const updateEpisode = useUpdateEpisode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roleCode } = useCurrentUser();

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

  const { data: insurers = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/insurers"],
    enabled: !!episodeId,
  });

  const { data: tpas = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/tpas"],
    enabled: !!episodeId,
  });

  const { data: policyTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/policyTypes"],
    enabled: !!episodeId,
  });

  const { data: preauthStatuses = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/preauthStatuses"],
    enabled: !!episodeId,
  });

  const { data: rejectionReasons = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/rejectionReasons"],
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
    updateEpisode.mutate(
      { id: episode.id, status: newStatus },
      {
        onSuccess: () => {
          toast({ title: "Status updated" });
          queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
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
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", getStatusColor(episode.status))} data-testid="badge-episode-status">
            {episode.status}
          </Badge>
          {episode.priority && episode.priority !== "Normal" && (
            <Badge className={cn("text-xs", getPriorityColor(episode.priority))} data-testid="badge-episode-priority">
              {episode.priority}
            </Badge>
          )}
          {episode.episodeType && (
            <Badge variant="outline" className="text-xs" data-testid="badge-episode-type">{episode.episodeType}</Badge>
          )}
          {episode.revenueProbability != null && (
            <Badge className={cn("text-xs", getRevenueProbabilityColor(episode.revenueProbability))} data-testid="badge-revenue-probability">
              <TrendingUp className="w-3 h-3 mr-1" />
              {episode.revenueProbability}% Revenue Probability
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

        <Tabs defaultValue="clinical" className="w-full" data-testid="episode-tabs">
          <TabsList className="w-full justify-start gap-1 flex-wrap" data-testid="episode-tabs-list">
            <TabsTrigger value="clinical" data-testid="tab-clinical">
              <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
              Clinical Status
            </TabsTrigger>
            <TabsTrigger value="financial" data-testid="tab-financial">
              <IndianRupee className="w-3.5 h-3.5 mr-1.5" />
              Financial Status
            </TabsTrigger>
            <TabsTrigger value="insurance" data-testid="tab-insurance">
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Insurance Status
            </TabsTrigger>
            <TabsTrigger value="family" data-testid="tab-family">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Family Status
            </TabsTrigger>
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
                  <InfoRow label="Priority" value={episode.priority} />
                  <InfoRow label="Start Date" value={episode.startDate ? format(new Date(episode.startDate), "MMM d, yyyy") : null} />
                  <InfoRow label="End Date" value={episode.endDate ? format(new Date(episode.endDate), "MMM d, yyyy") : null} />
                  <InfoRow label="Lead ID" value={episode.leadId ? `#${episode.leadId}` : null} link={episode.leadId ? `/leads/${episode.leadId}` : undefined} />
                </div>
              </Card>

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
            </div>

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
                            {format(new Date(event.timestamp), "MMM d, yyyy")}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {format(new Date(event.timestamp), "h:mm a")}
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
    </AppLayout>
  );
}

function NegotiationDiscountCard({ episode }: { episode: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();

  const isApproved = episode.discountStatus === "Approved";
  const isDraft = !episode.discountStatus || episode.discountStatus === "Draft";
  const isPending_ = episode.discountStatus === "Pending";

  const [originalQuotedAmount, setOriginalQuotedAmount] = useState<number>(
    episode.originalQuotedAmount ?? episode.estimatedCost ?? 0
  );
  const [discountType, setDiscountType] = useState<string>(
    episode.discountType || "Percentage"
  );
  const [discountPercent, setDiscountPercent] = useState<number>(
    episode.discountPercent ?? 0
  );
  const [discountAmount, setDiscountAmount] = useState<number>(
    episode.discountAmount ?? 0
  );
  const [discountNotes, setDiscountNotes] = useState<string>(
    episode.discountNotes || ""
  );
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");

  const finalAmount = Math.max(0, originalQuotedAmount - discountAmount);

  const handlePercentChange = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct));
    setDiscountPercent(clamped);
    setDiscountAmount(Math.round((originalQuotedAmount * clamped) / 100));
  };

  const handleAmountChange = (amt: number) => {
    const clamped = Math.min(originalQuotedAmount, Math.max(0, amt));
    setDiscountAmount(clamped);
    setDiscountPercent(
      originalQuotedAmount > 0
        ? Math.round((clamped / originalQuotedAmount) * 100)
        : 0
    );
  };

  const handleOriginalAmountChange = (amt: number) => {
    setOriginalQuotedAmount(amt);
    if (discountType === "Percentage") {
      setDiscountAmount(Math.round((amt * discountPercent) / 100));
    } else {
      setDiscountPercent(
        amt > 0 ? Math.round((discountAmount / amt) * 100) : 0
      );
    }
  };

  const submitDiscount = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/episodes/${episode.id}/discount`, {
        originalQuotedAmount,
        discountType,
        discountPercent,
        discountAmount,
        discountNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Discount submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id] });
    },
    onError: (err) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
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
    onError: (err) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
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
    onError: (err) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isRevoked = episode.discountStatus === "Revoked";

  const statusBadgeClass =
    isApproved
      ? "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300"
      : isPending_
        ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
        : isRevoked
          ? "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300"
          : "bg-muted text-muted-foreground";

  const fieldsReadOnly = isApproved;

  return (
    <>
      <Card className="p-4" data-testid="card-financial-negotiation">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" />
            Negotiation & Discount
          </h3>
          <Badge
            className={cn("text-xs", statusBadgeClass)}
            data-testid="badge-discount-status"
          >
            {episode.discountStatus || "Draft"}
          </Badge>
        </div>

        {isApproved && episode.discountApprovedBy && (
          <p
            className="text-xs text-green-700 dark:text-green-400 mb-3"
            data-testid="text-discount-approved-info"
          >
            Approved by {episode.discountApprovedBy}
            {episode.discountApprovedAt &&
              ` on ${format(new Date(episode.discountApprovedAt), "MMM d, yyyy")}`}
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Original Quoted Amount</Label>
            <Input
              type="number"
              value={originalQuotedAmount || ""}
              onChange={(e) => handleOriginalAmountChange(Number(e.target.value) || 0)}
              disabled={fieldsReadOnly}
              className="text-xs"
              data-testid="input-original-quoted-amount"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Discount Type</Label>
            <SearchableSelect
              value={discountType}
              onValueChange={(val) => {
                setDiscountType(val);
                if (val === "Percentage") {
                  setDiscountAmount(
                    Math.round((originalQuotedAmount * discountPercent) / 100)
                  );
                } else {
                  setDiscountPercent(
                    originalQuotedAmount > 0
                      ? Math.round((discountAmount / originalQuotedAmount) * 100)
                      : 0
                  );
                }
              }}
              options={[
                { value: "Percentage", label: "Percentage" },
                { value: "Flat", label: "Flat Amount" },
              ]}
              placeholder="Select type"
              triggerClassName="text-xs"
              disabled={fieldsReadOnly}
              data-testid="select-discount-type"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Discount %</Label>
              <Input
                type="number"
                value={discountPercent || ""}
                onChange={(e) => handlePercentChange(Number(e.target.value) || 0)}
                disabled={fieldsReadOnly || discountType === "Flat"}
                className="text-xs"
                data-testid="input-discount-percent"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Discount Amount</Label>
              <Input
                type="number"
                value={discountAmount || ""}
                onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                disabled={fieldsReadOnly || discountType === "Percentage"}
                className="text-xs"
                data-testid="input-discount-amount"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Final Amount</Label>
            <Input
              type="number"
              value={finalAmount}
              readOnly
              className="text-xs bg-muted"
              data-testid="input-final-amount"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Discount Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={discountNotes}
              onChange={(e) => setDiscountNotes(e.target.value)}
              disabled={fieldsReadOnly}
              placeholder="Reason for discount (mandatory)..."
              className="text-xs min-h-[80px] resize-none"
              data-testid="textarea-discount-notes"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            {!isApproved && (
              <Button
                onClick={() => submitDiscount.mutate()}
                disabled={
                  submitDiscount.isPending ||
                  !discountNotes.trim() ||
                  originalQuotedAmount <= 0
                }
                data-testid="button-submit-discount"
              >
                {submitDiscount.isPending ? "Submitting..." : "Submit Discount"}
              </Button>
            )}

            {isAdmin && (isPending_ || isDraft) && discountAmount > 0 && (
              <Button
                variant="outline"
                onClick={() => approveDiscount.mutate()}
                disabled={approveDiscount.isPending}
                data-testid="button-approve-discount"
              >
                {approveDiscount.isPending ? "Approving..." : "Approve"}
              </Button>
            )}

            {isAdmin && isApproved && (
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
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              data-testid="button-cancel-revoke"
            >
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
    </>
  );
}

function FinancialTab({ episode, onUpdate, isPending }: { episode: any; onUpdate: (fields: Record<string, any>) => void; isPending: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4" data-testid="card-financial-costs">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-primary" />
          Cost & Estimates
        </h3>
        <div className="space-y-3">
          <InfoRow label="Estimated Cost" value={episode.estimatedCost ? `₹${episode.estimatedCost.toLocaleString()}` : null} />
          <InfoRow label="Final Estimated" value={episode.finalEstimatedAmount ? `₹${episode.finalEstimatedAmount.toLocaleString()}` : null} />
          <InfoRow label="Actual Cost" value={episode.actualCost ? `₹${episode.actualCost.toLocaleString()}` : null} />

          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs text-muted-foreground">Estimate Shared</Label>
            <Switch
              checked={!!episode.estimateShared}
              onCheckedChange={(checked) => onUpdate({ estimateShared: checked })}
              disabled={isPending}
              data-testid="switch-estimate-shared"
            />
          </div>
          {episode.estimateSharedAt && (
            <InfoRow label="Shared At" value={format(new Date(episode.estimateSharedAt), "MMM d, yyyy h:mm a")} />
          )}
        </div>
      </Card>

      <NegotiationDiscountCard episode={episode} />

      <Card className="p-4" data-testid="card-financial-payment">
        <h3 className="text-sm font-semibold text-foreground mb-3">Payment Details</h3>
        <div className="space-y-3">
          <InfoRow label="Advance Received" value={episode.advanceReceivedAmount ? `₹${episode.advanceReceivedAmount.toLocaleString()}` : null} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Payment Mode</Label>
            <SearchableSelect
              value={episode.paymentMode || ""}
              onValueChange={(val) => onUpdate({ paymentMode: val })}
              options={[
                { value: "Cash", label: "Cash" },
                { value: "Card", label: "Card" },
                { value: "UPI", label: "UPI" },
                { value: "Net Banking", label: "Net Banking" },
                { value: "Insurance", label: "Insurance" },
                { value: "Mixed", label: "Mixed" },
              ]}
              placeholder="Select payment mode"
              triggerClassName="text-xs"
              data-testid="select-payment-mode"
            />
          </div>
          <InfoRow label="Payment Notes" value={episode.paymentNotes} />
          <InfoRow label="Insurance Claimed" value={episode.insuranceClaimed ? "Yes" : "No"} />
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

  const buildOptionsWithRequestNew = (items: any[], tableName: string, labelPrefix: string) => {
    const options = items.map((item: any) => ({
      value: String(item.id),
      label: item.name,
    }));
    return options;
  };

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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const name = window.prompt("Enter new insurer name:");
                      if (name) requestNewMaster.mutate({ tableName: "insurers", name });
                    }}
                    data-testid="button-request-new-insurer"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.insurerId ? String(episode.insurerId) : ""}
                  onValueChange={(val) => onUpdate({ insurerId: val ? Number(val) : null })}
                  options={buildOptionsWithRequestNew(insurers, "insurers", "Insurer")}
                  placeholder="Select insurer"
                  triggerClassName="text-xs"
                  data-testid="select-insurer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">TPA</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const name = window.prompt("Enter new TPA name:");
                      if (name) requestNewMaster.mutate({ tableName: "tpas", name });
                    }}
                    data-testid="button-request-new-tpa"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.tpaId ? String(episode.tpaId) : ""}
                  onValueChange={(val) => onUpdate({ tpaId: val ? Number(val) : null })}
                  options={buildOptionsWithRequestNew(tpas, "tpas", "TPA")}
                  placeholder="Select TPA"
                  triggerClassName="text-xs"
                  data-testid="select-tpa"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Policy Type</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const name = window.prompt("Enter new policy type name:");
                      if (name) requestNewMaster.mutate({ tableName: "policyTypes", name });
                    }}
                    data-testid="button-request-new-policy-type"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.policyTypeId ? String(episode.policyTypeId) : ""}
                  onValueChange={(val) => onUpdate({ policyTypeId: val ? Number(val) : null })}
                  options={buildOptionsWithRequestNew(policyTypes, "policyTypes", "Policy Type")}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const name = window.prompt("Enter new pre-auth status name:");
                      if (name) requestNewMaster.mutate({ tableName: "preauthStatuses", name });
                    }}
                    data-testid="button-request-new-preauth-status"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.preauthStatusId ? String(episode.preauthStatusId) : ""}
                  onValueChange={(val) => onUpdate({ preauthStatusId: val ? Number(val) : null })}
                  options={buildOptionsWithRequestNew(preauthStatuses, "preauthStatuses", "Pre-Auth Status")}
                  placeholder="Select pre-auth status"
                  triggerClassName="text-xs"
                  data-testid="select-preauth-status"
                />
              </div>

              {episode.preauthSubmittedAt && (
                <InfoRow label="Submitted At" value={format(new Date(episode.preauthSubmittedAt), "MMM d, yyyy h:mm a")} />
              )}

              <InfoRow label="Approved Amount" value={episode.preauthApprovedAmount ? `₹${episode.preauthApprovedAmount.toLocaleString()}` : null} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Rejection Reason</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const name = window.prompt("Enter new rejection reason:");
                      if (name) requestNewMaster.mutate({ tableName: "rejectionReasons", name });
                    }}
                    data-testid="button-request-new-rejection-reason"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Request New
                  </Button>
                </div>
                <SearchableSelect
                  value={episode.rejectionReasonId ? String(episode.rejectionReasonId) : ""}
                  onValueChange={(val) => onUpdate({ rejectionReasonId: val ? Number(val) : null })}
                  options={buildOptionsWithRequestNew(rejectionReasons, "rejectionReasons", "Rejection Reason")}
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

function FamilyTab({ episode, onUpdate, isPending }: { episode: any; onUpdate: (fields: Record<string, any>) => void; isPending: boolean }) {
  return (
    <Card className="p-4" data-testid="card-family-status">
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
            value={episode.decisionNotes || ""}
            onChange={(e) => {}}
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
  );
}

interface JourneyEvent {
  id: string;
  type: "created" | "status_change";
  title: string;
  description?: string;
  timestamp: string;
  performedBy?: string;
  statusTransition?: { from: string; to: string };
  newStatus?: string;
  isTerminal?: boolean;
}

function buildJourneyTimeline(episode: any, auditLogs: AuditLogEntry[]): JourneyEvent[] {
  const events: JourneyEvent[] = [];

  const sortedLogs = [...auditLogs].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

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
        timestamp: log.createdAt,
        performedBy: log.performedBy || undefined,
        statusTransition: { from: fromStatus, to: toStatus },
        newStatus: toStatus,
        isTerminal: terminalStatuses.includes(toStatus),
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
    case "Consultation Done": return "Returned to Consultation Done";
    default: return `Status changed to ${toStatus}`;
  }
}

function getStatusChangeDescription(from: string, to: string): string {
  switch (to) {
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
