import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useUpdateEpisode } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getStatusColor, getValidEpisodeTransitions, getPriorityColor } from "@/lib/lead-status";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
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
  Circle,
  XCircle,
  ArrowRightCircle,
  PlusCircle,
  User,
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

export default function EpisodeDetailPage() {
  const [, params] = useRoute("/episodes/:id");
  const [, setLocation] = useLocation();
  const episodeId = Number(params?.id);
  const updateEpisode = useUpdateEpisode();
  const { toast } = useToast();

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
        onSuccess: () => toast({ title: "Status updated" }),
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
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" />
              Clinical Information
            </h3>
            <div className="space-y-3">
              <InfoRow label="Diagnosis" value={episode.diagnosis} />
              <InfoRow label="Treatment Plan" value={episode.treatmentPlan} />
              <InfoRow label="Notes" value={episode.notes} />
            </div>
          </Card>

          <Card className="p-4" data-testid="card-episode-financial">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Financial Details
            </h3>
            <div className="space-y-3">
              <InfoRow label="Estimated Cost" value={episode.estimatedCost ? `₹${episode.estimatedCost.toLocaleString()}` : null} />
              <InfoRow label="Actual Cost" value={episode.actualCost ? `₹${episode.actualCost.toLocaleString()}` : null} />
              <InfoRow label="Insurance Claimed" value={episode.insuranceClaimed ? "Yes" : "No"} />
            </div>
          </Card>

          {episode.lostNotes && (
            <Card className="p-4 border-red-200 bg-red-50/50" data-testid="card-episode-lost">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Discontinued Details</h3>
              <p className="text-xs text-red-700">{episode.lostNotes}</p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
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
