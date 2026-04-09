import { useState } from "react";
import { useRoute, useLocation } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, fmtDateTime } from "@/lib/date-utils";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Users,
  MapPin,
  UserPlus,
  CheckCircle2,
  XCircle,
  Search,
  Phone,
  Mail,
  User,
  TrendingUp,
} from "lucide-react";
import { ResourceLinksSection } from "@/components/ResourceLinksSection";

const ATTENDANCE_STATUSES = ["Registered", "Confirmed", "Attended", "No-Show", "Cancelled"];
const REG_SOURCES = ["Walk-in", "Phone", "Website", "Social Media", "Referral", "Other"];

type RegistrationRecord = {
  id: number;
  eventId: number;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  registrationDate: string | null;
  attendanceStatus: string;
  checkedInAt: string | null;
  resultingLeadId: number | null;
  resultingLeadName: string | null;
  resultingLeadStatus: string | null;
  notes: string | null;
};

export default function EventDetailPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/events/:id");
  const eventId = Number(params?.id);

  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<RegistrationRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    email: "",
    source: "Walk-in",
    notes: "",
    attendanceStatus: "Registered",
  });

  const { data: event, isLoading: loadingEvent } = useQuery<any>({
    queryKey: ["/api/events", eventId],
  });

  const { data: registrations = [], isLoading: loadingRegs } = useQuery<RegistrationRecord[]>({
    queryKey: ["/api/events", eventId, "registrations"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/registrations`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const addRegMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/events/${eventId}/registrations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      setRegDialogOpen(false);
      toast({ title: "Registration added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRegMutation = useMutation({
    mutationFn: ({ regId, data }: { regId: number; data: any }) => apiRequest("PATCH", `/api/events/${eventId}/registrations/${regId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      setRegDialogOpen(false);
      toast({ title: "Registration updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: (regId: number) => apiRequest("POST", `/api/events/${eventId}/registrations/${regId}/convert-to-lead`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      toast({ title: "Registrant converted to lead" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkAttendanceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/events/${eventId}/bulk-attendance`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/stats"] });
      setSelectedIds(new Set());
      toast({ title: "Attendance updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openAddReg() {
    setEditingReg(null);
    setRegForm({ name: "", phone: "", email: "", source: "Walk-in", notes: "", attendanceStatus: "Registered" });
    setRegDialogOpen(true);
  }

  function openEditReg(reg: RegistrationRecord) {
    setEditingReg(reg);
    setRegForm({
      name: reg.name,
      phone: reg.phone,
      email: reg.email || "",
      source: reg.source || "Walk-in",
      notes: reg.notes || "",
      attendanceStatus: reg.attendanceStatus,
    });
    setRegDialogOpen(true);
  }

  function handleSaveReg() {
    if (!regForm.name.trim() || !regForm.phone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    if (editingReg) {
      updateRegMutation.mutate({ regId: editingReg.id, data: regForm });
    } else {
      addRegMutation.mutate(regForm);
    }
  }

  function handleBulkAttendance(status: string) {
    if (selectedIds.size === 0) {
      toast({ title: "Select registrations first", variant: "destructive" });
      return;
    }
    bulkAttendanceMutation.mutate({ registrationIds: Array.from(selectedIds), status });
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === filteredRegs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegs.map(r => r.id)));
    }
  }

  const filteredRegs = registrations.filter(r => {
    if (filterStatus !== "all" && r.attendanceStatus !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return r.name.toLowerCase().includes(term) || r.phone.includes(term) || (r.email || "").toLowerCase().includes(term);
    }
    return true;
  });

  const attendanceColor = (status: string) => {
    switch (status) {
      case "Attended": return "default";
      case "Confirmed": return "secondary";
      case "No-Show": return "destructive";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };

  if (loadingEvent) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading event...</p></main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Event not found</p></main>
      </div>
    );
  }

  const capacityPct = event.maxCapacity ? Math.round(((event.registeredCount || 0) / event.maxCapacity) * 100) : null;

  return (
    <div className="flex h-screen bg-background" data-testid="page-event-detail">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/events")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-event-name">{event.name}</h1>
                <Badge variant="outline" className="text-xs font-mono">{event.code}</Badge>
                <Badge variant={event.status === "Published" ? "default" : event.status === "Ongoing" ? "secondary" : event.status === "Completed" ? "outline" : "destructive"} data-testid="badge-status">{event.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{event.type}{event.organizer ? ` — Organized by ${event.organizer}` : ""}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xl font-bold" data-testid="text-registered">{event.registeredCount || 0}{event.maxCapacity ? `/${event.maxCapacity}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Registered{capacityPct !== null ? ` (${capacityPct}%)` : ""}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xl font-bold" data-testid="text-attended">{event.attendedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Attended</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="text-xl font-bold" data-testid="text-converted">{event.convertedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Converted to Leads</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xl font-bold" data-testid="text-conversion-rate">
                    {(event.registeredCount || 0) > 0 ? Math.round(((event.convertedCount || 0) / (event.registeredCount || 1)) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {event.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Venue</p>
                      <p className="font-medium">{event.venue}</p>
                    </div>
                  </div>
                )}
                {event.startDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{fmtDate(event.startDate)}{event.endDate ? ` — ${fmtDate(event.endDate)}` : ""}</p>
                    </div>
                  </div>
                )}
                {event.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="font-medium">{event.contactPhone}</p>
                    </div>
                  </div>
                )}
                {event.budget && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-medium">INR {event.budget.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
              {event.description && <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{event.description}</p>}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="p-4">
              <ResourceLinksSection entityType="event" entityId={eventId} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Registrations</h2>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <Button size="sm" variant="default" onClick={() => handleBulkAttendance("Attended")} disabled={bulkAttendanceMutation.isPending} data-testid="button-bulk-attended">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark Attended
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkAttendance("No-Show")} disabled={bulkAttendanceMutation.isPending} data-testid="button-bulk-noshow">
                    <XCircle className="h-3 w-3 mr-1" />
                    No-Show
                  </Button>
                </>
              )}
              <Button size="sm" onClick={openAddReg} data-testid="button-add-registration">
                <Plus className="h-4 w-4 mr-1" />
                Add Registration
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, phone, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-reg" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-attendance">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ATTENDANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loadingRegs ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Loading registrations...</div>
          ) : filteredRegs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground mb-3">No registrations yet</p>
                <Button onClick={openAddReg} variant="outline" data-testid="button-add-first-reg">
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Registration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm" data-testid="table-registrations">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 w-10">
                      <Checkbox checked={selectedIds.size === filteredRegs.length && filteredRegs.length > 0} onCheckedChange={toggleAll} data-testid="checkbox-select-all" />
                    </th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Checked In</th>
                    <th className="text-left p-3 font-medium">Lead</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegs.map(reg => (
                    <tr key={reg.id} className="border-t hover:bg-muted/20" data-testid={`row-reg-${reg.id}`}>
                      <td className="p-3">
                        <Checkbox checked={selectedIds.has(reg.id)} onCheckedChange={() => toggleSelect(reg.id)} data-testid={`checkbox-reg-${reg.id}`} />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{reg.name}</div>
                        {reg.email && <div className="text-xs text-muted-foreground">{reg.email}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{reg.phone}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{reg.source || "—"}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={attendanceColor(reg.attendanceStatus) as any} className="text-xs">{reg.attendanceStatus}</Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {reg.checkedInAt ? fmtDateTime(reg.checkedInAt) : "—"}
                      </td>
                      <td className="p-3">
                        {reg.resultingLeadId ? (
                          <Badge variant="default" className="text-xs bg-green-600 cursor-pointer" onClick={() => navigate(`/leads/${reg.resultingLeadId}`)} data-testid={`badge-lead-${reg.id}`}>
                            {reg.resultingLeadName || `Lead #${reg.resultingLeadId}`}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditReg(reg)} data-testid={`button-edit-reg-${reg.id}`}>
                            Edit
                          </Button>
                          {!reg.resultingLeadId && (
                            <Button variant="outline" size="sm" onClick={() => convertMutation.mutate(reg.id)} disabled={convertMutation.isPending} data-testid={`button-convert-${reg.id}`}>
                              <UserPlus className="h-3 w-3 mr-1" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Dialog open={regDialogOpen} onOpenChange={setRegDialogOpen}>
        <DialogContent className="max-w-lg" aria-describedby="reg-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-reg-dialog-title">
              {editingReg ? "Edit Registration" : "Add Registration"}
            </DialogTitle>
            <p id="reg-dialog-desc" className="text-sm text-muted-foreground">
              {editingReg ? "Update registrant details" : "Register a new attendee for this event"}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} placeholder="Full name" data-testid="input-reg-name" />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} placeholder="+91..." data-testid="input-reg-phone" />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} placeholder="email@example.com" data-testid="input-reg-email" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source</Label>
                <Select value={regForm.source} onValueChange={v => setRegForm({ ...regForm, source: v })}>
                  <SelectTrigger data-testid="select-reg-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REG_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editingReg && (
                <div>
                  <Label>Attendance Status</Label>
                  <Select value={regForm.attendanceStatus} onValueChange={v => setRegForm({ ...regForm, attendanceStatus: v })}>
                    <SelectTrigger data-testid="select-reg-attendance"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={regForm.notes} onChange={e => setRegForm({ ...regForm, notes: e.target.value })} placeholder="Any notes..." rows={2} data-testid="input-reg-notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegDialogOpen(false)} data-testid="button-cancel-reg">Cancel</Button>
            <Button onClick={handleSaveReg} disabled={addRegMutation.isPending || updateRegMutation.isPending} data-testid="button-save-reg">
              {(addRegMutation.isPending || updateRegMutation.isPending) ? "Saving..." : editingReg ? "Update" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
