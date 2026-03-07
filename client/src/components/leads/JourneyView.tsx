import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getStatusColor, getTemperatureColor } from "@/lib/lead-status";
import { format, formatDistanceToNow } from "date-fns";
import {
  Target, Clock, TrendingUp, Users, Activity, Calendar, Send,
  ChevronRight, ChevronDown, ChevronUp, ArrowRightCircle,
  Phone, StickyNote, ArrowRightLeft, Mail, MessageCircle,
  MessageSquare, CheckSquare, UserPlus, CheckCircle2, X,
  Shield, Loader2, Stethoscope, Heart, ClipboardList,
  Percent, DollarSign, AlertTriangle,
} from "lucide-react";

type FilterChip = "All" | "Lead" | "Appointment" | "Episode" | "Post Care" | "Task";

const FILTER_CHIPS: FilterChip[] = ["All", "Lead", "Appointment", "Episode", "Post Care", "Task"];

const SOURCE_COLORS: Record<string, string> = {
  Lead: "bg-blue-100 text-blue-700 border-blue-200",
  Appointment: "bg-purple-100 text-purple-700 border-purple-200",
  Episode: "bg-teal-100 text-teal-700 border-teal-200",
  "Post Care": "bg-sky-100 text-sky-700 border-sky-200",
  Task: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const EVENT_ICONS: Record<string, typeof Activity> = {
  call: Phone,
  note: StickyNote,
  status_change: ArrowRightLeft,
  appointment: Calendar,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  task: CheckSquare,
  handover: ArrowRightCircle,
  assignment: UserPlus,
  handover_accepted: CheckCircle2,
  handover_rejected: X,
  clinical_edit: ClipboardList,
  discount_submitted: DollarSign,
  discount_approved: CheckCircle2,
  discount_revoked: AlertTriangle,
};

interface JourneyViewProps {
  leadId: number;
}

export function JourneySnapshot({ leadId }: JourneyViewProps) {
  const { data: journey } = useQuery<any>({
    queryKey: ["/api/leads", leadId, "journey"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/journey?limit=100`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (!journey?.leadSummary) return null;

  const { leadSummary, episodes } = journey;
  const latestEp = episodes?.[0];

  const quickStatusColor = leadSummary.quickStatus === "Completed"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : leadSummary.quickStatus === "Discontinued"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-blue-100 text-blue-700 border-blue-200";

  return (
    <div className="px-4 py-3 border-b border-border" data-testid="journey-snapshot">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-primary" />
          Journey Snapshot
        </h3>
        <Badge className={cn("text-[10px]", quickStatusColor)} data-testid="badge-quick-status">
          {leadSummary.quickStatus}
        </Badge>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <SnapshotMetric
          icon={ArrowRightCircle}
          label="Lead Stage"
          value={leadSummary.status}
          testId="snapshot-lead-stage"
        />
        <SnapshotMetric
          icon={Stethoscope}
          label="Episode Stage"
          value={leadSummary.latestEpisodeStage || "No episode"}
          testId="snapshot-episode-stage"
        />
        <SnapshotMetric
          icon={ClipboardList}
          label="Episodes"
          value={String(leadSummary.episodeCount)}
          testId="snapshot-episode-count"
        />
        <SnapshotMetric
          icon={Percent}
          label="Probability"
          value={leadSummary.latestEpisodeRevenueProbability != null ? `${leadSummary.latestEpisodeRevenueProbability}%` : "—"}
          testId="snapshot-probability"
        />
        <SnapshotMetric
          icon={DollarSign}
          label="Expected Rev."
          value={leadSummary.latestEpisodeExpectedRevenue ? `₹${leadSummary.latestEpisodeExpectedRevenue.toLocaleString()}` : "—"}
          testId="snapshot-revenue"
        />
        <SnapshotMetric
          icon={Users}
          label="Team"
          value={leadSummary.ownerTeam || "Unassigned"}
          testId="snapshot-team"
        />
      </div>
    </div>
  );
}

function SnapshotMetric({ icon: Icon, label, value, testId }: { icon: typeof Activity; label: string; value: string; testId: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" data-testid={testId}>
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        <div className="text-xs font-medium text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

export function TreatmentJourneyTimeline({ leadId }: JourneyViewProps) {
  const [, setLocation] = useLocation();
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);

  const { data: journey, isLoading } = useQuery<any>({
    queryKey: ["/api/leads", leadId, "journey"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/journey?limit=100`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) return <div className="px-4 py-3 text-xs text-muted-foreground">Loading journey...</div>;

  const episodes = journey?.episodes || [];
  if (!episodes.length) return null;

  const episodeAuditEvents = (journey?.unifiedTimeline || []).filter(
    (e: any) => e.source === "Episode"
  );

  return (
    <div className="px-4 py-3 border-b border-border" data-testid="treatment-journey-timeline">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-2">
        <Heart className="w-3.5 h-3.5 text-primary" />
        Treatment Journey ({episodes.length})
      </h3>
      <div className="space-y-2">
        {episodes.map((ep: any, idx: number) => {
          const isExpanded = expandedEpisode === ep.id || (idx === 0 && expandedEpisode === null);
          const epEvents = episodeAuditEvents.filter((e: any) => e.episodeId === ep.id);
          return (
            <Card key={ep.id} className="overflow-hidden" data-testid={`journey-episode-card-${ep.id}`}>
              <div
                className="p-2.5 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedEpisode(isExpanded ? -1 : ep.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate">{ep.episodeName}</span>
                      <Badge className={cn("text-[10px] shrink-0", getStatusColor(ep.status))}>{ep.status}</Badge>
                      {ep.insuranceApplicable && (
                        <Badge className="text-[10px] shrink-0 bg-teal-100 text-teal-700 border-teal-200" data-testid={`badge-insurance-${ep.id}`}>
                          <Shield className="w-2.5 h-2.5 mr-0.5" />Insurance
                        </Badge>
                      )}
                      {ep.revenueProbability != null && (
                        <Badge variant="outline" className="text-[10px]">
                          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{ep.revenueProbability}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {ep.doctorName && <span>Dr. {ep.doctorName}</span>}
                      {ep.departmentName && <span>{ep.departmentName}</span>}
                      {ep.startDate && <span>Started {format(new Date(ep.startDate), "MMM d, yyyy")}</span>}
                      {ep.updatedAt && <span>Updated {formatDistanceToNow(new Date(ep.updatedAt), { addSuffix: true })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/episodes/${ep.id}`); }}
                      data-testid={`button-view-episode-${ep.id}`}
                    >
                      View <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </div>
              </div>

              {isExpanded && epEvents.length > 0 && (
                <div className="border-t border-border px-3 py-2 bg-muted/30" data-testid={`episode-events-${ep.id}`}>
                  <div className="space-y-1.5">
                    {epEvents.slice(0, 10).map((evt: any) => (
                      <div key={evt.id} className="flex items-start gap-2 text-[11px]">
                        <ArrowRightCircle className="w-3 h-3 mt-0.5 text-teal-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground">{evt.description}</span>
                          <span className="text-muted-foreground ml-2">
                            {evt.performedBy && `by ${evt.performedBy}`}
                            {evt.timestamp && ` · ${format(new Date(evt.timestamp), "MMM d, h:mm a")}`}
                          </span>
                        </div>
                      </div>
                    ))}
                    {epEvents.length > 10 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-5 text-[10px] p-0"
                        onClick={() => setLocation(`/episodes/${ep.id}`)}
                      >
                        +{epEvents.length - 10} more events — View full episode
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && epEvents.length === 0 && (
                <div className="border-t border-border px-3 py-2 bg-muted/30 text-[11px] text-muted-foreground">
                  No stage changes recorded yet.
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function UnifiedJourneyTimeline({ leadId }: JourneyViewProps) {
  const [filter, setFilter] = useState<FilterChip>("All");
  const [showAll, setShowAll] = useState(false);
  const [actText, setActText] = useState("");
  const [actType, setActType] = useState("note");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createActivity = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/leads/${leadId}/activities`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "journey"] });
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/activities`] });
      setActText("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleLogActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actText.trim()) return;
    createActivity.mutate({ leadId, type: actType, description: actText });
  };

  const { data: journey, isLoading } = useQuery<any>({
    queryKey: ["/api/leads", leadId, "journey"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/journey?limit=200`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const allEvents: any[] = journey?.unifiedTimeline || [];
  const filteredEvents = filter === "All"
    ? allEvents
    : allEvents.filter((e: any) => e.source === filter);
  const displayEvents = showAll ? filteredEvents : filteredEvents.slice(0, 50);

  const filterCounts: Record<string, number> = {};
  for (const e of allEvents) {
    filterCounts[e.source] = (filterCounts[e.source] || 0) + 1;
  }

  return (
    <>
      <div className="p-4 border-b border-border bg-card" data-testid="unified-timeline-header">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Unified Journey Timeline
          </h3>
          <span className="text-xs text-muted-foreground">{allEvents.length} events</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_CHIPS.map(chip => {
            const count = chip === "All" ? allEvents.length : (filterCounts[chip] || 0);
            if (chip !== "All" && count === 0) return null;
            return (
              <Button
                key={chip}
                variant={filter === chip ? "default" : "outline"}
                size="sm"
                className={cn("h-6 text-[10px] px-2 gap-1", filter === chip && "shadow-sm")}
                onClick={() => { setFilter(chip); setShowAll(false); }}
                data-testid={`filter-chip-${chip.toLowerCase().replace(" ", "-")}`}
              >
                {chip}
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{count}</Badge>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading timeline...
          </div>
        ) : !filteredEvents.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {filter === "All" ? "No events recorded yet." : `No ${filter.toLowerCase()} events found.`}
          </div>
        ) : (
          <div className="space-y-3">
            {displayEvents.map((event: any) => (
              <TimelineEvent key={event.id} event={event} />
            ))}
            {!showAll && filteredEvents.length > 50 && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAll(true)}
                  data-testid="button-load-more-events"
                >
                  Load {filteredEvents.length - 50} more events
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border bg-card">
        <form onSubmit={handleLogActivity} className="flex gap-2">
          <SearchableSelect
            value={actType}
            onValueChange={setActType}
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
            value={actText}
            onChange={(e) => setActText(e.target.value)}
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

function TimelineEvent({ event }: { event: any }) {
  const Icon = EVENT_ICONS[event.type] || Activity;
  const sourceColor = SOURCE_COLORS[event.source] || "bg-muted text-muted-foreground border-border";

  return (
    <div className="flex gap-3" data-testid={`timeline-event-${event.id}`}>
      <div className="flex flex-col items-center">
        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", getEventBgColor(event))}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="flex-1 pb-3 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 shrink-0", sourceColor)}>
            {event.source}
          </Badge>
          <span className="text-[10px] font-semibold uppercase text-foreground/70">
            {event.type.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {event.timestamp && format(new Date(event.timestamp), "MMM d, h:mm a")}
          </span>
        </div>
        <p className="text-xs text-foreground leading-relaxed">{event.description}</p>

        {event.source === "Episode" && event.oldStatus && event.newStatus && (
          <div className="flex items-center gap-1.5 mt-1">
            <Badge className={cn("text-[9px]", getStatusColor(event.oldStatus))}>{event.oldStatus}</Badge>
            <ArrowRightCircle className="w-3 h-3 text-muted-foreground" />
            <Badge className={cn("text-[9px]", getStatusColor(event.newStatus))}>{event.newStatus}</Badge>
          </div>
        )}

        {event.source === "Appointment" && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
            {event.appointmentDate && <span>{format(new Date(event.appointmentDate), "MMM d, yyyy")}</span>}
            {event.appointmentTime && <span>at {event.appointmentTime}</span>}
            {event.doctorName && <span>• Dr. {event.doctorName}</span>}
            {event.appointmentStatus && (
              <Badge variant="outline" className={cn("text-[9px] h-4",
                event.appointmentStatus === "No Show" ? "bg-red-50 text-red-700 border-red-200" :
                event.appointmentStatus === "Checked In" || event.appointmentStatus === "Completed" ? "bg-green-50 text-green-700 border-green-200" :
                ""
              )}>{event.appointmentStatus}</Badge>
            )}
            {event.checkedInAt && <span className="text-green-600">✓ Checked In</span>}
            {event.tokenNumber && <span>Token #{event.tokenNumber}</span>}
            {event.bookedByName && <span>Booked by {event.bookedByName}</span>}
          </div>
        )}

        {(event.source === "Task" || event.source === "Post Care") && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {event.taskStatus && <Badge variant="outline" className="text-[9px] h-4">{event.taskStatus}</Badge>}
            {event.assignedToName && <span>Assigned to {event.assignedToName}</span>}
            {event.dueDate && <span>Due {format(new Date(event.dueDate), "MMM d")}</span>}
            {event.categoryName && <span>{event.categoryName}</span>}
          </div>
        )}

        {event.source === "Lead" && event.oldStatus && event.newStatus && (
          <div className="flex items-center gap-1.5 mt-1">
            <Badge className={cn("text-[9px]", getStatusColor(event.oldStatus))}>{event.oldStatus}</Badge>
            <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
            <Badge className={cn("text-[9px]", getStatusColor(event.newStatus))}>{event.newStatus}</Badge>
          </div>
        )}

        {event.type === "call" && event.metadata && (event.metadata as any).source === "callyzer" && (
          <div className="bg-muted/50 rounded-md p-1.5 mt-1 space-y-0.5 border border-border/50">
            {(event.metadata as any).empName && (
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/80">Employee:</span> {(event.metadata as any).empName}
                {(event.metadata as any).empNumber && ` (${(event.metadata as any).empNumber})`}
              </p>
            )}
            {(event.metadata as any).notes && (
              <p className="text-[10px] text-foreground/80 italic border-l-2 border-primary/30 pl-1.5">
                {(event.metadata as any).notes}
              </p>
            )}
            {(event.metadata as any).callyzerLeadStatus && (
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/80">Status:</span> {(event.metadata as any).callyzerLeadStatus}
              </p>
            )}
          </div>
        )}

        {event.performedBy && (
          <span className="text-[10px] text-muted-foreground mt-0.5 block">by {event.performedBy}</span>
        )}
      </div>
    </div>
  );
}

function getEventBgColor(event: any): string {
  switch (event.source) {
    case "Episode": return "bg-teal-100 text-teal-600";
    case "Appointment": return "bg-purple-100 text-purple-600";
    case "Post Care": return "bg-sky-100 text-sky-600";
    case "Task": return "bg-indigo-100 text-indigo-600";
    default:
      if (event.type === "call") return "bg-blue-100 text-blue-600";
      if (event.type === "whatsapp") return "bg-emerald-100 text-emerald-600";
      if (event.type === "email") return "bg-amber-100 text-amber-600";
      if (event.type === "sms") return "bg-cyan-100 text-cyan-600";
      if (event.type === "status_change") return "bg-purple-100 text-purple-600";
      if (event.type === "handover" || event.type === "assignment") return "bg-orange-100 text-orange-600";
      return "bg-muted text-muted-foreground";
  }
}
