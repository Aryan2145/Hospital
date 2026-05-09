import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useLeads, useCreateLead, useMasterData } from "@/hooks/use-leads";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, FileUp, LayoutGrid, List, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Calendar, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, X, Clock, Users, GitMerge, ChevronDown as ChevronDownIcon, UserPlus, Trash2, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MergeLeadsModal } from "@/components/leads/MergeLeadsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, InsertLead } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { getStatusColor, getTemperatureColor, LEAD_STATUSES } from "@/lib/lead-status";
import { formatDistanceToNow } from "date-fns";
import { fmtDate, fmtDateTimeShort } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";

const QUICK_FILTER_LABELS: Record<string, string> = {
  "my-leads": "My Leads",
  "hot": "Hot Leads",
  "dormant": "Dormant Leads",
  "overdue": "Overdue",
  "telecalling": "Telecalling",
  "front-office": "Front Office",
  "doctor": "Doctor",
  "insurance": "Insurance",
};

export default function LeadsWorkspace() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { crmUser } = useCurrentUser();

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data: leads, isLoading } = useLeads(undefined, debouncedSearch);
  const [open, setOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeDuplicates, setMergeDuplicates] = useState<any[]>([]);
  const [mergeMobile, setMergeMobile] = useState("");

  const { data: duplicateGroups } = useQuery<{ groups: any[] }>({
    queryKey: ["/api/leads/duplicates"],
  });

  const { data: mergeRoles } = useQuery<{ allowedRoles: string[] }>({
    queryKey: ["/api/leads/merge-roles"],
  });
  const canMerge = crmUser?.roleCode != null && (
    (mergeRoles?.allowedRoles || []).includes(crmUser.roleCode) ||
    ["SYS_ADMIN", "ADMIN", "MANAGER"].includes(crmUser.roleCode)
  );

  const handleOpenMerge = useCallback((group: any) => {
    setMergeDuplicates(group.leads || []);
    setMergeMobile(group.mobileNormalized || "");
    setMergeOpen(true);
  }, []);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [showDuplicatePanel, setShowDuplicatePanel] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterUtmCampaign, setFilterUtmCampaign] = useState<string>("");
  const { data: leadSourcesForFilter = [] } = useMasterData("leadSources");
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qf = params.get("filter");
    const st = params.get("status");
    const view = params.get("view");
    const utm = params.get("utmCampaign");
    if (qf && Object.keys(QUICK_FILTER_LABELS).concat(["all"]).includes(qf)) {
      setQuickFilter(qf);
    }
    if (st) {
      setFilterStatus(st.split(",").filter(Boolean));
      setShowFilters(true);
    }
    if (utm) {
      setFilterUtmCampaign(utm);
      setShowFilters(true);
    }
    if (view === "list") setViewMode("list");
    if (qf || st || view || utm) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const activeFilterCount = filterStatus.length + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) + (filterSource ? 1 : 0) + (filterUtmCampaign ? 1 : 0);

  const filteredLeads = useMemo(() => {
    return (leads || []).filter((lead: any) => {
      if (quickFilter === "my-leads" && crmUser && lead.assignedCrmUserId !== crmUser.id) return false;
      if (quickFilter === "hot" && !["Blazing", "Scorching", "Very Hot", "Hot"].includes(lead.leadTemperature || "")) return false;
      if (quickFilter === "dormant" && !["Cold", "Freezing", "Icy"].includes(lead.leadTemperature || "")) return false;
      if (quickFilter === "overdue" && lead.slaBreached !== true) return false;
      if (quickFilter === "telecalling" && lead.ownerTeam !== "Telecalling") return false;
      if (quickFilter === "front-office" && lead.ownerTeam !== "Front Office") return false;
      if (quickFilter === "doctor" && lead.ownerTeam !== "Doctor") return false;
      if (quickFilter === "insurance" && lead.ownerTeam !== "Insurance") return false;

      if (filterStatus.length > 0 && !filterStatus.includes(lead.status)) return false;
      if (filterDateFrom && lead.createdAt && new Date(lead.createdAt) < new Date(filterDateFrom)) return false;
      if (filterDateTo && lead.createdAt && new Date(lead.createdAt) > new Date(filterDateTo + "T23:59:59")) return false;
      if (filterSource && lead.leadSourceId !== Number(filterSource)) return false;
      if (filterUtmCampaign && lead.utmCampaign !== filterUtmCampaign) return false;
      return true;
    });
  }, [leads, quickFilter, crmUser, filterStatus, filterDateFrom, filterDateTo, filterSource, filterUtmCampaign]);

  const clearAllFilters = () => {
    setFilterStatus([]);
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSource("");
    setFilterUtmCampaign("");
  };

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-muted to-transparent opacity-50 rounded-bl-full pointer-events-none z-0" />

        <div className="p-4 md:p-6 border-b border-border bg-white/80 backdrop-blur-sm z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Leads Workspace</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage patient inquiries and track status.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, phone, email..." 
                  className="pl-9" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative shrink-0">
                <select
                  value={filterStatus.length === 1 ? filterStatus[0] : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setFilterStatus([]);
                    } else {
                      setFilterStatus([val]);
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none pr-8 w-[160px]"
                  data-testid="select-lead-status-filter"
                >
                  <option value="">All Statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="icon"
                className="shrink-0 relative"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <div className="flex items-center border rounded-md overflow-hidden shrink-0">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-none"
                  onClick={() => setViewMode("kanban")}
                  data-testid="button-view-kanban"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-none"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {canMerge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 relative border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    setShowDuplicatePanel(prev => !prev);
                    setTimeout(() => {
                      const el = document.getElementById("duplicate-groups-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  data-testid="button-find-duplicates"
                >
                  <GitMerge className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Find Duplicates</span>
                  {duplicateGroups?.groups && duplicateGroups.groups.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {duplicateGroups.groups.length}
                    </span>
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate("/lead-import")} data-testid="button-bulk-import">
                <FileUp className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Bulk Import</span>
              </Button>
              
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">New Lead</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                  </DialogHeader>
                  <CreateLeadForm onSuccess={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {quickFilter !== "all" && (
          <div className="px-4 md:px-6 py-1.5 border-b border-border bg-primary/5 z-10 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">
              Filtered: {QUICK_FILTER_LABELS[quickFilter] || quickFilter}
            </span>
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setQuickFilter("all")}
              data-testid="button-clear-quick-filter"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {showFilters && (
          <div className="px-4 md:px-6 py-3 border-b border-border bg-muted/30 z-10" data-testid="filter-panel">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <div className="flex flex-wrap gap-1">
                  {LEAD_STATUSES.map((s) => {
                    const active = filterStatus.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium border transition-colors",
                          active ? getStatusColor(s) : "bg-background text-muted-foreground border-border hover:bg-accent"
                        )}
                        onClick={() => setFilterStatus(active ? filterStatus.filter(x => x !== s) : [...filterStatus, s])}
                        data-testid={`filter-status-${s.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Created Date</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 text-xs w-[130px]"
                    data-testid="filter-date-from"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 text-xs w-[130px]"
                    data-testid="filter-date-to"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Lead Source</label>
                <div className="relative">
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none pr-7 w-[180px]"
                    data-testid="filter-lead-source"
                  >
                    <option value="">All Sources</option>
                    {(leadSourcesForFilter as any[]).filter((s: any) => s.status === "Active").map((s: any) => (
                      <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">UTM Campaign</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={filterUtmCampaign}
                    onChange={(e) => setFilterUtmCampaign(e.target.value)}
                    placeholder="utm_campaign value…"
                    className="h-8 text-xs w-[200px]"
                    data-testid="filter-utm-campaign"
                  />
                  {filterUtmCampaign && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFilterUtmCampaign("")}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {filterUtmCampaign && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    Filtering by: <span className="font-mono font-medium">{filterUtmCampaign}</span>
                  </p>
                )}
              </div>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={clearAllFilters} data-testid="button-clear-filters">
                  <X className="w-3 h-3 mr-1" />
                  Clear all ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>
        )}

        {canMerge && showDuplicatePanel && (
          <div id="duplicate-groups-section" className="mx-3 md:mx-6 mt-3 z-10" data-testid="duplicate-groups-banner">
            <Alert className="border-amber-200 bg-amber-50">
              <GitMerge className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 flex items-center justify-between">
                <span>
                  {duplicateGroups?.groups?.length
                    ? `${duplicateGroups.groups.length} duplicate group${duplicateGroups.groups.length > 1 ? "s" : ""} found (by mobile number)`
                    : "No duplicate leads found"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-600 hover:text-amber-800"
                  onClick={() => setShowDuplicatePanel(false)}
                  data-testid="button-close-duplicates"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              {duplicateGroups?.groups?.length > 0 && (
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    {duplicateGroups.groups.map((group: any) => (
                      <div key={group.mobileNormalized} className="flex items-center justify-between bg-white rounded-md p-2 border border-amber-100">
                        <div className="text-sm">
                          <span className="font-medium text-amber-900">{group.mobileNormalized}</span>
                          <span className="text-muted-foreground ml-2">({group.count} leads: {group.leads.map((l: any) => l.name).join(", ")})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                          onClick={() => handleOpenMerge(group)}
                          data-testid={`button-merge-group-${group.mobileNormalized}`}
                        >
                          <GitMerge className="h-3 w-3 mr-1" /> Merge
                        </Button>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              )}
            </Alert>
          </div>
        )}

        <div className="flex-1 p-3 md:p-6 overflow-hidden z-10">
          {isLoading ? (
            <LoadingSpinner text="Loading leads..." />
          ) : leads ? (
            viewMode === "kanban" ? (
              <KanbanBoard leads={filteredLeads} />
            ) : (
              <LeadsListView leads={filteredLeads} />
            )
          ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                Failed to load leads.
             </div>
          )}
        </div>

        <MergeLeadsModal
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          duplicateLeads={mergeDuplicates}
          mobileNumber={mergeMobile}
        />
    </AppLayout>
  );
}

function formatAgeing(lead: any): { text: string; isBreached: boolean } {
  if (!lead.createdAt) return { text: "—", isBreached: false };
  const days = lead.leadAgeingDays ?? Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const breached = lead.slaBreached === true;
  if (days === 0) return { text: "Today", isBreached: breached };
  if (days === 1) return { text: "1d", isBreached: breached };
  if (days < 30) return { text: `${days}d`, isBreached: breached };
  if (days < 365) return { text: `${Math.floor(days / 30)}mo`, isBreached: breached };
  return { text: `${Math.floor(days / 365)}y`, isBreached: breached };
}

const LEAD_FUNNEL_STAGES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Reminder Running",
  "Consultation Done",
];

const EPISODE_FUNNEL_STAGES = [
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

const LEAD_STAGES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Consultation Done",
];

const EPISODE_STAGES = [
  "Treatment Planning",
  "Surgery Scheduled",
  "Surgery Done",
  "In Treatment",
  "Discharge / Billing Clearance",
  "Post Care",
  "Follow Up",
  "Completed",
];

const UNIFIED_STAGES = [...LEAD_STAGES, ...EPISODE_STAGES];

const SHORT_LABELS: Record<string, string> = {
  "Raw Lead Captured": "Raw",
  "Contacted": "Contact",
  "Qualified": "Qual",
  "Appointment Booked": "Appt",
  "Consultation In Progress": "In Consult",
  "Consultation Done": "Consult ✓",
  "Treatment Planning": "Plan",
  "Surgery Scheduled": "Surg Sched",
  "Surgery Done": "Surg Done",
  "In Treatment": "Treating",
  "Discharge / Billing Clearance": "Billing Clear",
  "Post Care": "Post Care",
  "Follow Up": "Follow Up",
  "Completed": "Complete",
};

const TERMINAL_STATUSES = ["Closed Won", "Closed Lost", "Unqualified", "Nurture", "Discontinued"];

const STATUS_TO_STAGE: Record<string, string> = {
  "Reminder Running": "Appointment Booked",
  "Consultation In Progress": "Consultation Done",
};

function LeadFunnelStrip({ leadId, status, episodeStatus, conversionStage }: { leadId: number; status: string; episodeStatus?: string | null; conversionStage?: string | null }) {
  const isTerminal = TERMINAL_STATUSES.includes(status) || TERMINAL_STATUSES.includes(episodeStatus || "");
  const rawStatus = episodeStatus || status;
  const furthestStatus = STATUS_TO_STAGE[rawStatus] || rawStatus;
  const hasEpisode = !!episodeStatus;
  const stages = hasEpisode ? UNIFIED_STAGES : LEAD_STAGES;
  const currentIdx = stages.indexOf(furthestStatus);
  const leadPhaseEnd = LEAD_STAGES.length - 1;

  return (
    <div className="flex flex-col gap-0.5" data-testid={`funnel-lead-${leadId}`}>
      <div className="flex items-center h-5">
        {stages.map((stage, idx) => {
          const isCurrent = stage === furthestStatus;
          const isPast = currentIdx >= 0 && idx < currentIdx;
          const isEpisodePhase = idx > leadPhaseEnd;
          const isFirst = idx === 0;
          const isLast = idx === stages.length - 1;

          return (
            <div
              key={stage}
              className={cn(
                "h-full flex items-center justify-center text-[7px] font-semibold tracking-tight leading-none px-1.5 min-w-0 relative whitespace-nowrap",
                isFirst && "rounded-l",
                isLast && "rounded-r",
                !isFirst && !isLast && "rounded-none",
                isCurrent && !isEpisodePhase && "bg-[#0f4c81] text-white",
                isCurrent && isEpisodePhase && "bg-violet-600 text-white",
                isPast && "bg-emerald-500 text-white",
                !isCurrent && !isPast && "bg-gray-100 dark:bg-muted text-gray-400 dark:text-muted-foreground",
              )}
              style={{ flex: isCurrent ? "1.3" : "1" }}
              title={stage + (conversionStage && isCurrent ? ` (${conversionStage})` : "")}
              data-testid={`funnel-stage-${stage.toLowerCase().replace(/\s+/g, "-")}-${leadId}`}
            >
              <span className="truncate">{SHORT_LABELS[stage] || stage}</span>
            </div>
          );
        })}
      </div>
      {isTerminal && (
        <Badge className={cn("text-[8px] h-4 w-fit px-1.5", getStatusColor(episodeStatus || status))} data-testid={`badge-status-${leadId}`}>
          {episodeStatus || status}
        </Badge>
      )}
    </div>
  );
}

function LeadsListView({ leads }: { leads: any[] }) {
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [, navigate] = useLocation();
  const { data: leadSources = [] } = useMasterData("leadSources");
  const sourceMap = Object.fromEntries(leadSources.map((s: any) => [s.id, s.name]));
  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const userMap = Object.fromEntries(crmUsers.map((u: any) => [u.id, u.name]));

  const { data: lastCallsMap = {} } = useQuery<Record<number, any>>({
    queryKey: ["/api/leads/last-calls"],
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const sorted = [...leads].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="h-full overflow-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <SortHeader field="name">Name</SortHeader>
            <SortHeader field="status">Stage</SortHeader>
            <SortHeader field="leadTemperature">Temperature</SortHeader>
            <TableHead>Owner</TableHead>
            <SortHeader field="leadAgeingDays">Ageing</SortHeader>
            <TableHead>Last Call</TableHead>
            <TableHead>Next Action</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((lead) => {
              const ageing = formatAgeing(lead);
              const temp = lead.leadTemperature || null;
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  data-testid={`row-lead-${lead.id}`}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground" data-testid={`text-lead-name-${lead.id}`}>{lead.name}</span>
                      {lead.phoneE164 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5" data-testid={`text-lead-phone-${lead.id}`}>
                          <Phone className="w-3 h-3" /> {lead.phoneE164}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LeadFunnelStrip leadId={lead.id} status={lead.status} episodeStatus={lead.latestEpisodeStatus} conversionStage={lead.latestConversionStage} />
                  </TableCell>
                  <TableCell>
                    {temp ? (
                      <Badge className={cn("text-[10px] whitespace-nowrap", getTemperatureColor(temp))} data-testid={`badge-temperature-${lead.id}`}>
                        {temp}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs" data-testid={`text-lead-owner-${lead.id}`}>
                      {lead.ownerTeam && (
                        <span className="text-muted-foreground">{lead.ownerTeam}</span>
                      )}
                      <span className="text-foreground">
                        {lead.assignedCrmUserId ? userMap[lead.assignedCrmUserId] || "—" : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        ageing.isBreached ? "text-red-600" : "text-muted-foreground"
                      )}
                      data-testid={`text-lead-ageing-${lead.id}`}
                    >
                      {ageing.isBreached && <Clock className="w-3 h-3 inline mr-0.5 text-red-600" />}
                      {ageing.text}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const lc = lastCallsMap[lead.id];
                      if (!lc) return <span className="text-xs text-muted-foreground/50">—</span>;
                      const meta = lc.metadata || {};
                      const empName = meta.empName || lc.createdBy || "";
                      const empNumber = meta.empNumber || "";
                      const callDir = lc.callDirection || "";
                      const dur = lc.callDurationSeconds || 0;
                      const durStr = dur > 0 ? (dur >= 3600 ? `${Math.floor(dur / 3600)}h ${Math.floor((dur % 3600) / 60)}m ${dur % 60}s` : dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`) : "";
                      const notes = meta.notes || "";
                      const callTime = lc.createdAt;
                      const DirIcon = callDir === "Incoming" ? PhoneIncoming : callDir === "Outgoing" ? PhoneOutgoing : callDir === "Missed" ? PhoneMissed : Phone;
                      const dirColor = callDir === "Incoming" ? "text-blue-600" : callDir === "Outgoing" ? "text-green-600" : callDir === "Missed" ? "text-red-600" : "text-muted-foreground";
                      return (
                        <div className="flex flex-col gap-0.5 max-w-[200px]" data-testid={`last-call-${lead.id}`}>
                          <div className="flex items-center gap-1 text-[11px]">
                            <DirIcon className={cn("w-3 h-3", dirColor)} />
                            <span className={cn("font-medium", dirColor)} data-testid={`text-call-direction-${lead.id}`}>{callDir}</span>
                            {durStr && <span className="text-muted-foreground" data-testid={`text-call-duration-${lead.id}`}>{durStr}</span>}
                          </div>
                          {empName && (
                            <span className="text-[10px] text-muted-foreground truncate" data-testid={`text-call-employee-${lead.id}`}>
                              {empName}{empNumber ? ` (${empNumber})` : ""}
                            </span>
                          )}
                          {callTime && (
                            <span className="text-[10px] text-muted-foreground/70" data-testid={`text-call-time-${lead.id}`}>
                              {fmtDateTimeShort(callTime)}
                            </span>
                          )}
                          {notes && (
                            <span className="text-[10px] text-foreground/70 italic truncate" title={notes} data-testid={`text-call-notes-${lead.id}`}>
                              {notes}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {lead.nextActionDate ? (
                      <div className={cn(
                        "flex items-center gap-1 text-xs",
                        new Date(lead.nextActionDate) < new Date() ? "text-red-600" : "text-muted-foreground"
                      )} data-testid={`text-lead-next-action-${lead.id}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{fmtDateTimeShort(lead.nextActionDate)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground" data-testid={`text-lead-source-${lead.id}`}>
                      {lead.leadSourceId ? sourceMap[lead.leadSourceId] || "—" : (lead.tags?.toLowerCase().includes("callyzer") ? "Telephony" : "—")}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const CONTACT_RELATIONSHIP_OPTIONS = ["Self","Spouse","Parent","Child","Sibling","Guardian","Friend","Colleague","Caregiver","Power of Attorney","Other"];

interface InlineContact {
  name: string;
  phoneE164: string;
  whatsappNumber: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
  isBillingContact: boolean;
  isEmergencyContact: boolean;
  isWhatsAppConsentHolder: boolean;
  isAppointmentCoordinator: boolean;
  // For existing contact reuse
  existingContactPersonId?: number;
}

const defaultContact = (): InlineContact => ({
  name: "", phoneE164: "", whatsappNumber: "", email: "", relationship: "Other",
  isPrimary: false, isBillingContact: false, isEmergencyContact: false,
  isWhatsAppConsentHolder: false, isAppointmentCoordinator: false,
});

function CreateLeadForm({ onSuccess }: { onSuccess: () => void }) {
  const createLead = useCreateLead();
  const [, navigate] = useLocation();
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    existingLead?: { id: number; name: string; status: string; assignedTo: string; createdAt: string };
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const duplicateDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastCheckedPhone = useRef<string>("");

  // Inline contact persons state
  const [inlineContacts, setInlineContacts] = useState<InlineContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<InlineContact>(defaultContact());
  const [cpPhoneSearchResult, setCpPhoneSearchResult] = useState<any>(null);
  const cpPhoneDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: branches = [] } = useMasterData("branches");
  const { data: leadSourceCategories = [] } = useMasterData("leadSourceCategories");
  const { data: leadSources = [] } = useMasterData("leadSources");
  const { data: treatmentDepartments = [] } = useMasterData("treatmentDepartments");
  const { data: consultationTypes = [] } = useMasterData("consultationTypes");
  const { data: doctors = [] } = useMasterData("doctors");
  const { data: referrers = [] } = useMasterData("referrers");
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/masters", "campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/masters/campaigns", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const checkDuplicate = useCallback(async (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setDuplicateInfo(null);
      lastCheckedPhone.current = "";
      return;
    }
    if (phone === lastCheckedPhone.current) return;
    lastCheckedPhone.current = phone;
    setCheckingDuplicate(true);
    try {
      const res = await fetch(`/api/leads/check-duplicate?mobile=${encodeURIComponent(phone)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDuplicateInfo(data.isDuplicate ? data : null);
      } else {
        setDuplicateInfo(null);
      }
    } catch {
      setDuplicateInfo(null);
    } finally {
      setCheckingDuplicate(false);
    }
  }, []);

  const handlePhoneChange = useCallback((value: string, originalOnChange: (v: string) => void) => {
    originalOnChange(value);
    setDuplicateInfo(null);
    lastCheckedPhone.current = "";
    if (duplicateDebounceRef.current) clearTimeout(duplicateDebounceRef.current);
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length >= 10) {
      duplicateDebounceRef.current = setTimeout(() => checkDuplicate(value), 500);
    }
  }, [checkDuplicate]);

  const handlePhoneBlur = useCallback((value: string) => {
    if (duplicateDebounceRef.current) clearTimeout(duplicateDebounceRef.current);
    checkDuplicate(value);
  }, [checkDuplicate]);

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      name: "",
      phoneE164: "",
      email: "",
      status: "Raw Lead Captured",
      tenantId: 1,
      priority: "Normal",
      notes: "",
    },
  });

  const selectedSourceCategoryId = form.watch("leadSourceCategoryId");

  const filteredSources = selectedSourceCategoryId
    ? leadSources.filter((s: any) => s.categoryId === selectedSourceCategoryId)
    : leadSources;

  const isDuplicateDetected = duplicateInfo?.isDuplicate === true;

  // Check if lead has at least one reachable phone (own phone or inline contact with phone)
  const leadPhone = form.watch("phoneE164");
  const hasReachablePhone = !!(leadPhone?.trim()) || inlineContacts.some(c => c.phoneE164?.trim());
  const showReachabilityWarning = !hasReachablePhone && inlineContacts.length === 0 && !leadPhone?.trim();

  const checkCpPhone = useCallback(async (phone: string) => {
    if (!phone || phone.replace(/\D/g, "").length < 10) { setCpPhoneSearchResult(null); return; }
    const res = await fetch(`/api/contact-persons?search=${encodeURIComponent(phone)}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const match = data.find((cp: any) => cp.phoneE164 === phone || cp.phoneE164?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
      setCpPhoneSearchResult(match || null);
    }
  }, []);

  const handleCpPhoneChange = useCallback((phone: string) => {
    setNewContact(p => ({ ...p, phoneE164: phone, existingContactPersonId: undefined }));
    setCpPhoneSearchResult(null);
    if (cpPhoneDebounceRef.current) clearTimeout(cpPhoneDebounceRef.current);
    cpPhoneDebounceRef.current = setTimeout(() => checkCpPhone(phone), 500);
  }, [checkCpPhone]);

  function addInlineContact() {
    if (!newContact.name.trim()) return;
    const toAdd: InlineContact = { ...newContact };
    setInlineContacts(p => [...p, toAdd]);
    setNewContact(defaultContact());
    setCpPhoneSearchResult(null);
    setShowAddContact(false);
  }

  function reuseExistingContact(cp: any) {
    setNewContact(p => ({
      ...p,
      name: cp.name,
      phoneE164: cp.phoneE164 || "",
      whatsappNumber: cp.whatsappNumber || "",
      email: cp.email || "",
      existingContactPersonId: cp.id,
    }));
    setCpPhoneSearchResult(null);
  }

  function onSubmit(data: InsertLead) {
    if (isDuplicateDetected) return;
    // Include inline contacts in the create payload so server handles them atomically
    const payload: any = { ...data };
    if (inlineContacts.length > 0) {
      payload.contactPersons = inlineContacts.map(c => ({
        contactPersonId: c.existingContactPersonId || undefined,
        name: c.name,
        phoneE164: c.phoneE164 || undefined,
        whatsappNumber: c.whatsappNumber || undefined,
        email: c.email || undefined,
        relationship: c.relationship,
        isPrimary: c.isPrimary,
        isBillingContact: c.isBillingContact,
        isEmergencyContact: c.isEmergencyContact,
        isWhatsAppConsentHolder: c.isWhatsAppConsentHolder,
        isAppointmentCoordinator: c.isAppointmentCoordinator,
      }));
    }
    createLead.mutate(payload, {
      onSuccess: () => onSuccess(),
      onError: (error: any) => {
        if (error.status === 409 && error.existingLeadId) {
          setDuplicateInfo({ isDuplicate: true, existingLead: error.existingLead });
        }
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Patient Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Ramesh Modi" {...field} data-testid="input-lead-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneE164"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 9876543210"
                    {...field}
                    onChange={(e) => handlePhoneChange(e.target.value, field.onChange)}
                    onBlur={() => handlePhoneBlur(field.value || "")}
                    data-testid="input-lead-phone"
                  />
                </FormControl>
                <FormMessage />
                {checkingDuplicate && (
                  <p className="text-xs text-muted-foreground" data-testid="text-checking-duplicate">Checking for duplicates...</p>
                )}
                {isDuplicateDetected && duplicateInfo?.existingLead && (
                  <Alert variant="destructive" className="mt-2" data-testid="duplicate-warning-banner">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle data-testid="text-duplicate-heading">Duplicate Lead Found</AlertTitle>
                    <AlertDescription>
                      <div className="mt-1 space-y-1 text-sm">
                        <p data-testid="text-duplicate-name"><span className="font-medium">Name:</span> {duplicateInfo.existingLead.name}</p>
                        <p data-testid="text-duplicate-status"><span className="font-medium">Status:</span> {duplicateInfo.existingLead.status}</p>
                        <p data-testid="text-duplicate-assigned"><span className="font-medium">Assigned To:</span> {duplicateInfo.existingLead.assignedTo || "Unassigned"}</p>
                        <p data-testid="text-duplicate-created"><span className="font-medium">Created:</span> {duplicateInfo.existingLead.createdAt ? fmtDate(duplicateInfo.existingLead.createdAt) : "—"}</p>
                        {(duplicateInfo.existingLead as any).matchedVia && (
                          <p className="text-amber-700" data-testid="text-duplicate-matched-via"><span className="font-medium">Matched via:</span> {(duplicateInfo.existingLead as any).matchedVia}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/leads/${duplicateInfo.existingLead!.id}`)}
                          data-testid="button-open-existing-lead"
                        >
                          Open Existing Lead
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDuplicateInfo(null);
                            lastCheckedPhone.current = "";
                            form.setValue("phoneE164", "");
                          }}
                          data-testid="button-cancel-duplicate"
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneOwnerRelationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Belongs To</FormLabel>
                <Select value={field.value || "Self"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-phone-owner-relationship">
                      <SelectValue placeholder="Self" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Self","Spouse","Parent","Child","Sibling","Guardian","Friend","Caregiver","Other"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. patient@email.com" {...field} value={field.value || ""} data-testid="input-lead-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={branches.map((b: any) => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select branch"
                    data-testid="select-lead-branch"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="leadSourceCategoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source Category</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      form.setValue("leadSourceId", null as any);
                    }}
                    options={leadSourceCategories.map((c: any) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select category"
                    data-testid="select-lead-source-cat"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leadSourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={filteredSources.map((s: any) => ({ value: String(s.id), label: s.name }))}
                    placeholder="Select source"
                    data-testid="select-lead-source"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="treatmentDepartmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Treatment Department</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      form.setValue("consultationTypeId", null);
                    }}
                    options={treatmentDepartments.map((d: any) => ({ value: String(d.id), label: d.name }))}
                    placeholder="Select department"
                    data-testid="select-lead-treatment-dept"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="doctorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Doctor</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={doctors.map((d: any) => ({ value: String(d.id), label: d.name }))}
                    placeholder="Select doctor"
                    data-testid="select-lead-doctor"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="consultationTypeId"
            render={({ field }) => {
              const selectedDeptId = form.watch("treatmentDepartmentId");
              const filteredSubDepts = selectedDeptId
                ? consultationTypes.filter((c: any) => !c.treatmentDepartmentId || c.treatmentDepartmentId === Number(selectedDeptId))
                : consultationTypes;
              return (
                <FormItem>
                  <FormLabel>Treatment Sub-Department</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                      options={filteredSubDepts.map((c: any) => ({ value: String(c.id), label: c.name }))}
                      placeholder="Select sub-department"
                      data-testid="select-lead-consult-type"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="campaignId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={campaigns.map((c: any) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select campaign"
                    data-testid="select-lead-campaign"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value || "Normal"}
                    onValueChange={(v) => field.onChange(v)}
                    options={[
                      { value: "Low", label: "Low" },
                      { value: "Normal", label: "Normal" },
                      { value: "High", label: "High" },
                      { value: "Urgent", label: "Urgent" },
                    ]}
                    placeholder="Select priority"
                    data-testid="select-lead-priority"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignedCrmUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={crmUsers.map((u: any) => ({ value: String(u.id), label: `${u.name} (${u.code})` }))}
                    placeholder="Select counsellor"
                    data-testid="select-lead-assign"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="referrerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referrer</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={referrers.map((r: any) => ({ value: String(r.id), label: r.name }))}
                    placeholder="Select referrer"
                    data-testid="select-lead-referrer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Inline Contact Persons Section */}
        <div className="border border-border rounded-lg p-3 space-y-3" data-testid="section-inline-contacts">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Contact Persons
              {inlineContacts.length > 0 && (
                <Badge variant="outline" className="text-xs ml-1">{inlineContacts.length}</Badge>
              )}
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => { setShowAddContact(true); setNewContact(defaultContact()); setCpPhoneSearchResult(null); }}
              data-testid="button-add-inline-contact"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Contact Person
            </Button>
          </div>

          {inlineContacts.length === 0 && !showAddContact && (
            <p className="text-xs text-muted-foreground">Add a family member, caregiver, or billing contact who will coordinate on behalf of the patient.</p>
          )}

          {/* Listed inline contacts */}
          {inlineContacts.map((c, idx) => (
            <Card key={idx} className="p-2 text-xs flex items-start justify-between gap-2" data-testid={`card-inline-contact-${idx}`}>
              <div className="flex-1">
                <span className="font-medium">{c.name}</span>
                {c.existingContactPersonId && <Badge variant="outline" className="ml-1 text-[9px]">Existing</Badge>}
                <span className="text-muted-foreground ml-1.5">({c.relationship})</span>
                {c.phoneE164 && <span className="text-muted-foreground ml-1.5">· {c.phoneE164}</span>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.isPrimary && <Badge variant="outline" className="text-[9px] py-0 px-1">Primary</Badge>}
                  {c.isBillingContact && <Badge variant="outline" className="text-[9px] py-0 px-1">Billing</Badge>}
                  {c.isEmergencyContact && <Badge variant="outline" className="text-[9px] py-0 px-1">Emergency</Badge>}
                  {c.isWhatsAppConsentHolder && <Badge variant="outline" className="text-[9px] py-0 px-1">WA Consent</Badge>}
                  {c.isAppointmentCoordinator && <Badge variant="outline" className="text-[9px] py-0 px-1">Appt Coord</Badge>}
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                onClick={() => setInlineContacts(p => p.filter((_, i) => i !== idx))}
                data-testid={`button-remove-inline-contact-${idx}`}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </Card>
          ))}

          {/* Add new contact form */}
          {showAddContact && (
            <Card className="p-3 border-primary/20 bg-primary/5 space-y-2">
              <p className="text-xs font-medium text-foreground mb-1">New Contact Person</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Full Name *</Label>
                  <Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Priya Modi" className="h-7 text-xs mt-0.5" data-testid="input-cp-name" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Phone</Label>
                  <Input value={newContact.phoneE164}
                    onChange={e => handleCpPhoneChange(e.target.value)}
                    placeholder="+91..." className="h-7 text-xs mt-0.5" data-testid="input-cp-phone" />
                  {cpPhoneSearchResult && (
                    <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px]">
                      <p className="text-amber-700 font-medium">Existing contact found: {cpPhoneSearchResult.name}</p>
                      <Button type="button" size="sm" variant="outline" className="h-5 text-[9px] mt-1 px-2"
                        onClick={() => reuseExistingContact(cpPhoneSearchResult)}
                        data-testid="button-reuse-existing-cp">
                        Reuse this contact
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">WhatsApp</Label>
                  <Input value={newContact.whatsappNumber}
                    onChange={e => setNewContact(p => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="+91..." className="h-7 text-xs mt-0.5" data-testid="input-cp-whatsapp" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Email</Label>
                  <Input value={newContact.email}
                    onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@..." className="h-7 text-xs mt-0.5" data-testid="input-cp-email" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Relationship</Label>
                  <Select value={newContact.relationship} onValueChange={v => setNewContact(p => ({ ...p, relationship: v }))}>
                    <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-cp-rel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {([
                  { key: "isPrimary", label: "Primary Contact" },
                  { key: "isBillingContact", label: "Billing Contact" },
                  { key: "isEmergencyContact", label: "Emergency Contact" },
                  { key: "isWhatsAppConsentHolder", label: "WhatsApp Consent" },
                  { key: "isAppointmentCoordinator", label: "Appointment Coordinator" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 text-[10px] text-foreground cursor-pointer"
                    data-testid={`toggle-cp-${key}`}>
                    <Switch checked={(newContact as any)[key]}
                      onCheckedChange={v => setNewContact(p => ({ ...p, [key]: v }))}
                      className="scale-75" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" className="h-7 text-xs" onClick={addInlineContact}
                  disabled={!newContact.name.trim()} data-testid="button-confirm-add-cp">
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setShowAddContact(false); setNewContact(defaultContact()); setCpPhoneSearchResult(null); }}
                  data-testid="button-cancel-add-cp">
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional notes about this lead..."
                  rows={3}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-lead-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border border-border rounded-lg p-3 bg-muted/30">
          <label className="flex items-start gap-2 cursor-pointer" data-testid="label-consent-checkbox">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              {...form.register("consentGiven")}
              data-testid="checkbox-consent"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              I confirm that the patient has been informed about data collection and processing, and has given consent for the hospital to store and use their personal information for treatment coordination, communication, and follow-up purposes.
            </span>
          </label>
        </div>

        {!hasReachablePhone && !showAddContact && (
          <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700" data-testid="reachability-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>No reachable phone number. Add a phone number above or add a contact person with a phone.</span>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={createLead.isPending || isDuplicateDetected || !hasReachablePhone} data-testid="button-create-lead">
          {createLead.isPending ? "Creating..." : isDuplicateDetected ? "Duplicate Detected — Cannot Submit" : !hasReachablePhone ? "Add a Phone Number or Contact Person" : "Create Lead"}
        </Button>
      </form>
    </Form>
  );
}
