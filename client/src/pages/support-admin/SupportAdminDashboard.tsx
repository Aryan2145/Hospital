import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, fmtDateTime } from "@/lib/date-utils";
import {
  Headset,
  Ticket,
  Users,
  LogOut,
  Bug,
  Lightbulb,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  ArrowLeft,
  Image,
  ImageOff,
  Plus,
  UserPlus,
  Edit2,
  Eye,
  EyeOff,
  Filter,
} from "lucide-react";

const CATEGORIES = [
  { value: "Bug Report", icon: Bug, color: "text-red-500" },
  { value: "Feature Request", icon: Lightbulb, color: "text-amber-500" },
  { value: "Training Request", icon: GraduationCap, color: "text-blue-500" },
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

type TicketType = {
  id: number;
  ticketNumber: string;
  category: string;
  priority: string;
  adminPriority: string | null;
  subject: string;
  description: string;
  attachments: string[];
  status: string;
  assignedSupportUserId: number | null;
  assignedName: string | null;
  crmUserName: string | null;
  tenantName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  comments?: CommentType[];
};

type CommentType = {
  id: number;
  authorType: string;
  authorName: string;
  message: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
};

type SupportUserType = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function SupportAdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<"tickets" | "users">("tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: currentUser, isLoading: userLoading, error: userError } = useQuery<SupportUserType>({
    queryKey: ["/api/support-admin/me"],
    retry: false,
  });

  useEffect(() => {
    if (userError) setLocation("/support-admin");
  }, [userError, setLocation]);

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/support-admin/logout"),
    onSuccess: () => {
      queryClient.clear();
      setLocation("/support-admin");
    },
  });

  if (userLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  if (!currentUser) return null;

  if (selectedTicketId) {
    return <TicketDetail
      ticketId={selectedTicketId}
      currentUser={currentUser}
      onBack={() => setSelectedTicketId(null)}
      toast={toast}
    />;
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="page-support-admin-dashboard">
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Headset className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">RGB Hospital CRM Support Portal</h1>
            <p className="text-xs text-slate-400">Logged in as {currentUser.name} ({currentUser.role})</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={activeSection === "tickets" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection("tickets")}
            className={activeSection !== "tickets" ? "text-white hover:text-white hover:bg-slate-700" : ""}
            data-testid="button-section-tickets"
          >
            <Ticket className="w-4 h-4 mr-1.5" /> Tickets
          </Button>
          {currentUser.role === "support_admin" && (
            <Button
              variant={activeSection === "users" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection("users")}
              className={activeSection !== "users" ? "text-white hover:text-white hover:bg-slate-700" : ""}
              data-testid="button-section-users"
            >
              <Users className="w-4 h-4 mr-1.5" /> Team
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} className="text-white hover:text-white hover:bg-slate-700" data-testid="button-support-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {activeSection === "tickets" ? (
          <TicketListSection
            currentUser={currentUser}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectTicket={setSelectedTicketId}
            toast={toast}
          />
        ) : (
          <TeamManagementSection toast={toast} />
        )}
      </main>
    </div>
  );
}

function TicketListSection({ currentUser, statusFilter, setStatusFilter, searchTerm, setSearchTerm, onSelectTicket, toast }: {
  currentUser: SupportUserType;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onSelectTicket: (id: number) => void;
  toast: any;
}) {
  const { data: tickets = [], isLoading } = useQuery<TicketType[]>({
    queryKey: ["/api/support-admin/tickets"],
  });

  const { data: supportUsers = [] } = useQuery<SupportUserType[]>({
    queryKey: ["/api/support-admin/users"],
    enabled: currentUser.role === "support_admin",
  });

  const filtered = tickets.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(term) ||
        t.subject.toLowerCase().includes(term) ||
        t.crmUserName?.toLowerCase().includes(term) ||
        t.tenantName?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "Open").length,
    inProgress: tickets.filter(t => t.status === "In Progress").length,
    resolved: tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length,
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("Open")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("In Progress")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("Resolved")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search tickets by number, subject, user, or hospital..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search-tickets"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading tickets...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No tickets found</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="table-support-tickets">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Ticket</th>
                <th className="text-left p-3 font-medium">Subject</th>
                <th className="text-left p-3 font-medium">Hospital / User</th>
                <th className="text-left p-3 font-medium">Priority</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Assigned</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const catConfig = CATEGORIES.find(c => c.value === ticket.category);
                const CatIcon = catConfig?.icon || Bug;
                return (
                  <tr key={ticket.id} className="border-t hover:bg-muted/20" data-testid={`row-ticket-${ticket.id}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <CatIcon className={`w-4 h-4 ${catConfig?.color || "text-gray-500"}`} />
                        <span className="font-mono text-xs">{ticket.ticketNumber}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[200px] truncate font-medium">{ticket.subject}</div>
                      <div className="text-xs text-muted-foreground">{ticket.category}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">{ticket.tenantName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{ticket.crmUserName || "—"}</div>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-[10px] ${PRIORITY_COLORS[ticket.adminPriority || ticket.priority] || ""}`}>
                        {ticket.adminPriority || ticket.priority}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-[10px] ${STATUS_COLORS[ticket.status] || ""}`}>{ticket.status}</Badge>
                    </td>
                    <td className="p-3 text-xs">{ticket.assignedName || <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(ticket.createdAt)}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onSelectTicket(ticket.id)} data-testid={`button-view-ticket-${ticket.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TicketDetail({ ticketId, currentUser, onBack, toast }: {
  ticketId: number;
  currentUser: SupportUserType;
  onBack: () => void;
  toast: any;
}) {
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [lightboxBroken, setLightboxBroken] = useState(false);
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());

  const { data: ticket, isLoading } = useQuery<TicketType>({
    queryKey: ["/api/support-admin/tickets", ticketId],
  });

  const { data: supportUsers = [] } = useQuery<SupportUserType[]>({
    queryKey: ["/api/support-admin/users"],
    enabled: currentUser.role === "support_admin",
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/support-admin/tickets/${ticketId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/tickets"] });
      toast({ title: "Ticket updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/support-admin/tickets/${ticketId}/comments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/tickets"] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="text-center py-12 text-muted-foreground">Loading ticket...</div>
      </div>
    );
  }

  const catConfig = CATEGORIES.find(c => c.value === ticket.category);
  const CatIcon = catConfig?.icon || Bug;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="page-support-ticket-detail">
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center gap-3">
        <Headset className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-semibold">Support Portal</h1>
        <span className="text-slate-400">—</span>
        <span className="text-sm text-slate-300">{ticket.ticketNumber}</span>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" className="mb-4" onClick={onBack} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tickets
        </Button>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <CatIcon className={`w-6 h-6 ${catConfig?.color || ""}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs ${STATUS_COLORS[ticket.status] || ""}`}>{ticket.status}</Badge>
                      <Badge className={`text-xs ${PRIORITY_COLORS[ticket.adminPriority || ticket.priority] || ""}`}>
                        {ticket.adminPriority || ticket.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                    </div>
                    <h2 className="text-xl font-semibold mb-2" data-testid="text-admin-ticket-subject">{ticket.subject}</h2>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">{ticket.description}</p>

                    {ticket.attachments && (ticket.attachments as string[]).length > 0 && (
                      <div className="mb-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Attachments</Label>
                        <div className="flex flex-wrap gap-2">
                          {(ticket.attachments as string[]).map((url, i) => (
                            brokenThumbs.has(url) ? (
                              <div key={i} className="w-20 h-20 border rounded bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground" title="Image no longer available">
                                <ImageOff className="w-5 h-5" />
                                <span className="text-[9px]">Unavailable</span>
                              </div>
                            ) : (
                              <button key={i} onClick={() => { setLightboxBroken(false); setViewingImage(url); }}
                                className="border rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                                data-testid={`btn-admin-attachment-${i}`}>
                                <img src={url} alt={`Screenshot ${i + 1}`} className="w-20 h-20 object-cover"
                                  onError={() => setBrokenThumbs(prev => new Set(prev).add(url))} />
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                      <span>Hospital: <strong>{ticket.tenantName}</strong></span>
                      <span>User: <strong>{ticket.crmUserName}</strong></span>
                      <span>Created: {fmtDateTime(ticket.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> Comments & Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.comments && ticket.comments.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {ticket.comments.map(comment => (
                      <div key={comment.id} className={`flex gap-3 ${comment.isInternal ? "opacity-70" : ""}`}
                        data-testid={`admin-comment-${comment.id}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          comment.authorType === "support_user" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {(comment.authorName || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{comment.authorName}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {comment.authorType === "support_user" ? "Support" : "Customer"}
                            </Badge>
                            {comment.isInternal && <Badge variant="secondary" className="text-[10px]">Internal Note</Badge>}
                            <span className="text-xs text-muted-foreground">{fmtDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm mb-4">No comments yet.</div>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Switch checked={isInternal} onCheckedChange={setIsInternal} data-testid="switch-internal-note" />
                    <Label className="text-xs text-muted-foreground">Internal note (not visible to customer)</Label>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder={isInternal ? "Add an internal note..." : "Reply to the customer..."}
                      rows={2}
                      className="flex-1"
                      data-testid="input-admin-comment"
                    />
                    <Button
                      onClick={() => {
                        if (newComment.trim()) commentMutation.mutate({ message: newComment, isInternal });
                      }}
                      disabled={!newComment.trim() || commentMutation.isPending}
                      className="self-end"
                      data-testid="button-send-admin-comment"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ticket Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={v => updateMutation.mutate({ status: v })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-admin-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Priority (Admin Override)</Label>
                  <Select
                    value={ticket.adminPriority || ticket.priority}
                    onValueChange={v => updateMutation.mutate({ adminPriority: v })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-admin-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">User suggested: {ticket.priority}</p>
                </div>

                <div>
                  <Label className="text-xs">Assign To</Label>
                  <Select
                    value={ticket.assignedSupportUserId ? String(ticket.assignedSupportUserId) : "unassigned"}
                    onValueChange={v => updateMutation.mutate({
                      assignedSupportUserId: v === "unassigned" ? null : Number(v)
                    })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-assign-to">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {supportUsers.filter(u => u.isActive).map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket #</span>
                  <span className="font-mono">{ticket.ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hospital</span>
                  <span>{ticket.tenantName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised By</span>
                  <span>{ticket.crmUserName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{fmtDate(ticket.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{fmtDate(ticket.updatedAt)}</span>
                </div>
                {ticket.closedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closed</span>
                    <span>{fmtDate(ticket.closedAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {viewingImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => { setViewingImage(null); setLightboxBroken(false); }}>
          <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setViewingImage(null); setLightboxBroken(false); }}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-3xl font-bold leading-none"
              data-testid="btn-admin-close-lightbox">×</button>
            {lightboxBroken ? (
              <div className="bg-white/10 rounded-lg p-12 flex flex-col items-center gap-4 text-white">
                <ImageOff className="w-16 h-16 opacity-60" />
                <p className="text-lg font-medium opacity-80">Image no longer available</p>
                <p className="text-sm opacity-50">This screenshot was stored on the server and is no longer accessible.</p>
              </div>
            ) : (
              <img src={viewingImage} alt="Screenshot"
                className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
                onError={() => setLightboxBroken(true)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamManagementSection({ toast }: { toast: any }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SupportUserType | null>(null);

  const { data: users = [], isLoading } = useQuery<SupportUserType[]>({
    queryKey: ["/api/support-admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/support-admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/users"] });
      setCreateOpen(false);
      toast({ title: "Team member created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/support-admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-admin/users"] });
      setEditUser(null);
      toast({ title: "Team member updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Support Team</h2>
          <p className="text-sm text-muted-foreground">Manage support team members who can access the portal</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-add-team-member">
          <UserPlus className="w-4 h-4 mr-2" /> Add Team Member
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map(user => (
            <Card key={user.id} data-testid={`card-support-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      user.isActive ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"
                    }`}>
                      {user.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant={user.isActive ? "default" : "secondary"} className="text-[10px]">
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      {user.lastLoginAt && (
                        <div className="text-xs text-muted-foreground">Last login: {fmtDate(user.lastLoginAt)}</div>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Add Team Member"
      />

      {editUser && (
        <UserDialog
          open={true}
          onOpenChange={() => setEditUser(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editUser.id, data })}
          isPending={updateMutation.isPending}
          title="Edit Team Member"
          defaults={editUser}
        />
      )}
    </div>
  );
}

function UserDialog({ open, onOpenChange, onSubmit, isPending, title, defaults }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  title: string;
  defaults?: SupportUserType;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: defaults?.name || "",
    email: defaults?.email || "",
    phone: defaults?.phone || "",
    password: "",
    userRole: defaults?.role || "support_agent",
    isActive: defaults?.isActive ?? true,
  });

  useEffect(() => {
    if (defaults) {
      setForm({
        name: defaults.name,
        email: defaults.email,
        phone: defaults.phone || "",
        password: "",
        userRole: defaults.role,
        isActive: defaults.isActive ?? true,
      });
    } else {
      setForm({ name: "", email: "", phone: "", password: "", userRole: "support_agent", isActive: true });
    }
  }, [defaults]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby="user-dialog-desc">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p id="user-dialog-desc" className="text-sm text-muted-foreground">
            {defaults ? "Update team member details" : "Create a new support team member"}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-user-name" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-user-email" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-user-phone" />
          </div>
          <div>
            <Label>{defaults ? "New Password (leave blank to keep current)" : "Password *"}</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                data-testid="input-user-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                data-testid="button-toggle-user-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.userRole} onValueChange={v => setForm({ ...form, userRole: v })}>
              <SelectTrigger data-testid="select-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support_admin">Support Admin</SelectItem>
                <SelectItem value="support_agent">Support Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {defaults && (
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} data-testid="switch-user-active" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const data: any = { ...form };
              if (defaults && !data.password) delete data.password;
              onSubmit(data);
            }}
            disabled={isPending}
            data-testid="button-save-user"
          >
            {isPending ? "Saving..." : defaults ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
