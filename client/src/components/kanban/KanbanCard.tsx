import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@shared/schema";
import { fmtDateTimeShort } from "@/lib/date-utils";
import { Clock, Phone, User as UserIcon, Flame, Sun, Snowflake, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getStatusColor, getPriorityColor, getLeadTemperature, getTemperatureColor } from "@/lib/lead-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  lead: Lead;
}

export function KanbanCard({ lead }: KanbanCardProps) {
  const [, setLocation] = useLocation();
  const { data: leadSources = [] } = useQuery<any[]>({
    queryKey: ["/api/masters/leadSources"],
    queryFn: async () => {
      const res = await fetch("/api/masters/leadSources", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const sourceName = lead.leadSourceId ? leadSources.find((s: any) => s.id === lead.leadSourceId)?.name : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-50 bg-background border-2 border-primary border-dashed rounded-md h-32"
      />
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-navigate]")) return;
    setLocation(`/leads/${lead.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="group bg-card p-4 rounded-md border border-border cursor-grab active:cursor-grabbing relative hover-elevate"
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-accent transition-colors duration-300 rounded-l-md" />

      <div className="pl-2">
        <div className="flex justify-between items-start gap-1 mb-2">
          <h4 className="font-semibold text-foreground text-sm line-clamp-1">{lead.name}</h4>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
            #{lead.id}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span>{lead.phoneE164}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 text-accent" />
            <span>{lead.createdAt ? fmtDateTimeShort(lead.createdAt) : "Just now"}</span>
          </div>

          {sourceName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-lead-source-${lead.id}`}>
              <Globe className="w-3 h-3" />
              <span>{sourceName}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
              <UserIcon className="w-3 h-3" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {lead.priority && lead.priority !== "Normal" && (
              <Badge className={cn("text-[10px]", getPriorityColor(lead.priority))}>
                {lead.priority}
              </Badge>
            )}
            <Badge className={cn("text-[10px]", lead.slaBreached ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200")}>
              {lead.slaBreached ? "SLA Breached" : "On Track"}
            </Badge>
            {(() => {
              const temp = getLeadTemperature(lead);
              if (!temp) return null;
              const TempIcon = temp === "Hot" ? Flame : temp === "Warm" ? Sun : Snowflake;
              return (
                <Badge className={cn("text-[10px]", getTemperatureColor(temp))} data-testid={`badge-temp-${lead.id}`}>
                  <TempIcon className="w-3 h-3 mr-0.5" />
                  {temp}
                </Badge>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
