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
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Target,
  ChevronRight,
  Stethoscope,
  IndianRupee,
  FileText,
} from "lucide-react";

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
    "Post Care",
    "Follow Up",
    "Closed Won",
  ];

  const currentStageIndex = FUNNEL_STAGES.indexOf(episode.status);

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
            Treatment Funnel
          </h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {FUNNEL_STAGES.map((stage, idx) => {
              const isCurrent = stage === episode.status;
              const isPast = idx < currentStageIndex;
              const isLost = episode.status === "Closed Lost";
              return (
                <div key={stage} className="flex items-center">
                  <div
                    className={cn(
                      "px-3 py-1.5 rounded text-[11px] font-medium whitespace-nowrap border transition-colors",
                      isCurrent && "bg-primary text-primary-foreground border-primary",
                      isPast && !isCurrent && "bg-green-100 text-green-800 border-green-200",
                      !isCurrent && !isPast && !isLost && "bg-muted text-muted-foreground border-border",
                      isLost && "bg-red-50 text-red-400 border-red-200",
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
              <h3 className="text-sm font-semibold text-red-800 mb-2">Lost Details</h3>
              <p className="text-xs text-red-700">{episode.lostNotes}</p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
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
