import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/date-utils";
import { useLocation } from "wouter";
import {
  Plus,
  Calendar,
  Users,
  MapPin,
  TrendingUp,
  Search,
  Filter,
  CalendarDays,
  UserPlus,
  IndianRupee,
  Trash2,
  Pencil,
  Eye,
} from "lucide-react";

const EVENT_TYPES = ["Health Camp", "Seminar", "Webinar", "Workshop", "Community Outreach", "Other"];
const EVENT_STATUSES = ["Draft", "Published", "Ongoing", "Completed", "Cancelled"];

type EventRecord = {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
  venue: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  maxCapacity: number | null;
  registeredCount: number;
  attendedCount: number;
  convertedCount: number;
  status: string;
  organizer: string | null;
  budget: number | null;
  campaignId: number | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
};

type EventStats = {
  total: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  totalRegistrations: number;
  totalAttended: number;
  totalConverted: number;
  totalBudget: number;
  typeBreakdown: Record<string, number>;
};

export default function EventsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "Health Camp",
    description: "",
    venue: "",
    location: "",
    startDate: "",
    endDate: "",
    maxCapacity: "",
    organizer: "",
    budget: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
    status: "Draft",
  });

  const { data: eventsList = [], isLoading } = useQuery<EventRecord[]>({
    queryKey: ["/api/events"],
  });

  const { data: stats } = useQuery<EventStats>({
    queryKey: ["/api/events/stats"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/events", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      setDialogOpen(false);
      toast({ title: "Event created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      setDialogOpen(false);
      toast({ title: "Event updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      toast({ title: "Event deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingEvent(null);
    setFormData({ name: "", type: "Health Camp", description: "", venue: "", location: "", startDate: "", endDate: "", maxCapacity: "", organizer: "", budget: "", contactPhone: "", contactEmail: "", notes: "", status: "Draft" });
    setDialogOpen(true);
  }

  function openEdit(evt: EventRecord) {
    setEditingEvent(evt);
    setFormData({
      name: evt.name,
      type: evt.type,
      description: evt.description || "",
      venue: evt.venue || "",
      location: evt.location || "",
      startDate: evt.startDate ? new Date(evt.startDate).toISOString().slice(0, 16) : "",
      endDate: evt.endDate ? new Date(evt.endDate).toISOString().slice(0, 16) : "",
      maxCapacity: evt.maxCapacity ? String(evt.maxCapacity) : "",
      organizer: evt.organizer || "",
      budget: evt.budget ? String(evt.budget) : "",
      contactPhone: evt.contactPhone || "",
      contactEmail: evt.contactEmail || "",
      notes: evt.notes || "",
      status: evt.status,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formData.name.trim()) {
      toast({ title: "Event name is required", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...formData,
      maxCapacity: formData.maxCapacity ? Number(formData.maxCapacity) : null,
      budget: formData.budget ? Number(formData.budget) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredEvents = eventsList.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return e.name.toLowerCase().includes(term) || e.code.toLowerCase().includes(term) || (e.venue || "").toLowerCase().includes(term);
    }
    return true;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "Published": return "default";
      case "Ongoing": return "secondary";
      case "Completed": return "outline";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "Health Camp": return "🏥";
      case "Seminar": return "🎤";
      case "Webinar": return "💻";
      case "Workshop": return "🔧";
      case "Community Outreach": return "🤝";
      default: return "📋";
    }
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-events">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Event Management</h1>
                <p className="text-sm text-muted-foreground">Manage webinars, seminars, health camps & community events</p>
              </div>
            </div>
            <Button onClick={openCreate} data-testid="button-create-event">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card data-testid="card-stat-total">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-events">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Total Events</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-registrations">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-registrations">{stats.totalRegistrations}</p>
                      <p className="text-xs text-muted-foreground">Total Registrations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-attended">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                      <TrendingUp className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-attended">{stats.totalAttended}</p>
                      <p className="text-xs text-muted-foreground">Total Attended</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-converted">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <UserPlus className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-converted">{stats.totalConverted}</p>
                      <p className="text-xs text-muted-foreground">Converted to Leads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search events..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Events Found</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Create your first event to start managing registrations.</p>
                <Button onClick={openCreate} variant="outline" data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Event
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map(evt => (
                <Card key={evt.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-event-${evt.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{typeIcon(evt.type)}</span>
                        <Badge variant={statusColor(evt.status) as any} className="text-xs">{evt.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{evt.code}</span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{evt.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{evt.type}</p>

                    {(evt.venue || evt.location) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{evt.venue || evt.location}</span>
                      </div>
                    )}
                    {evt.startDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <Calendar className="h-3 w-3" />
                        <span>{fmtDate(evt.startDate)}{evt.endDate ? ` — ${fmtDate(evt.endDate)}` : ""}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center mb-3 py-2 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm font-bold text-foreground">{evt.registeredCount || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Registered</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{evt.attendedCount || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Attended</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{evt.convertedCount || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Converted</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default" className="flex-1" onClick={() => navigate(`/events/${evt.id}`)} data-testid={`button-view-${evt.id}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEdit(evt); }} data-testid={`button-edit-${evt.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this event and all its registrations?")) deleteMutation.mutate(evt.id); }} data-testid={`button-delete-${evt.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="event-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingEvent ? "Edit Event" : "Create New Event"}
            </DialogTitle>
            <p id="event-dialog-desc" className="text-sm text-muted-foreground">
              {editingEvent ? "Update event details" : "Set up a new event, seminar, or health camp"}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Event Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Free Eye Check-up Camp" data-testid="input-event-name" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Event description..." rows={2} data-testid="input-description" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Venue</Label>
                <Input value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })} placeholder="e.g. Hospital Auditorium" data-testid="input-venue" />
              </div>
              <div>
                <Label>Location / Address</Label>
                <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Full address" data-testid="input-location" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date & Time</Label>
                <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} data-testid="input-start-date" />
              </div>
              <div>
                <Label>End Date & Time</Label>
                <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} data-testid="input-end-date" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Max Capacity</Label>
                <Input type="number" value={formData.maxCapacity} onChange={e => setFormData({ ...formData, maxCapacity: e.target.value })} placeholder="e.g. 200" data-testid="input-capacity" />
              </div>
              <div>
                <Label>Budget (INR)</Label>
                <Input type="number" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} placeholder="e.g. 50000" data-testid="input-budget" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Organizer</Label>
                <Input value={formData.organizer} onChange={e => setFormData({ ...formData, organizer: e.target.value })} placeholder="Organizer name" data-testid="input-organizer" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} placeholder="+91..." data-testid="input-contact-phone" />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} placeholder="email@example.com" data-testid="input-contact-email" />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." rows={2} data-testid="input-notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-event">
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
