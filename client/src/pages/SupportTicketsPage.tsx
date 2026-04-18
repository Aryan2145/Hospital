import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, fmtDateTime } from "@/lib/date-utils";
import {
  Ticket,
  Plus,
  Bug,
  Lightbulb,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Paperclip,
  Send,
  ArrowLeft,
  Image,
  X,
} from "lucide-react";

const CATEGORIES = [
  { value: "Bug Report", label: "Bug Report", icon: Bug, color: "text-red-500" },
  { value: "Feature Request", label: "Feature Request", icon: Lightbulb, color: "text-amber-500" },
  { value: "Training Request", label: "Training Request", icon: GraduationCap, color: "text-blue-500" },
];

const PRIORITIES = [
  { value: "Low", label: "Low", color: "bg-gray-100 text-gray-700" },
  { value: "Medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "High", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "Critical", label: "Critical", color: "bg-red-100 text-red-700" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  Open: { color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  "In Progress": { color: "bg-amber-100 text-amber-700", icon: Clock },
  Resolved: { color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  Closed: { color: "bg-gray-100 text-gray-700", icon: CheckCircle2 },
};

type TicketType = {
  id: number;
  ticketNumber: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  attachments: string[];
  createdByName?: string | null;
  hospitalName?: string | null;
  status: string;
  assignedName: string | null;
  adminPriority: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
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

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("open");
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<TicketType[]>({
    queryKey: ["/api/support-tickets"],
  });

  const openTickets = tickets.filter(t => t.status === "Open" || t.status === "In Progress");
  const closedTickets = tickets.filter(t => t.status === "Resolved" || t.status === "Closed");

  if (selectedTicket) {
    return <TicketDetailView ticketId={selectedTicket} onBack={() => setSelectedTicket(null)} toast={toast} />;
  }

  return (
    <div className="flex h-screen bg-background" data-testid="page-support-tickets">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Ticket className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Support Tickets</h1>
                <p className="text-sm text-muted-foreground">Report issues, request features, or ask for training</p>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-ticket">
              <Plus className="w-4 h-4 mr-2" /> New Ticket
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("open")} data-testid="stat-card-open">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{openTickets.length}</div>
                <div className="text-sm text-muted-foreground">Open</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("open")} data-testid="stat-card-in-progress">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{openTickets.filter(t => t.status === "In Progress").length}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("closed")} data-testid="stat-card-resolved">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{closedTickets.length}</div>
                <div className="text-sm text-muted-foreground">Resolved</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4" data-testid="tabs-ticket-list">
              <TabsTrigger value="open" data-testid="tab-open-tickets">
                Open ({openTickets.length})
              </TabsTrigger>
              <TabsTrigger value="closed" data-testid="tab-closed-tickets">
                Resolved / Closed ({closedTickets.length})
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all-tickets">
                All ({tickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <TicketList tickets={openTickets} isLoading={isLoading} onSelect={setSelectedTicket} emptyText="No open tickets" />
            </TabsContent>
            <TabsContent value="closed">
              <TicketList tickets={closedTickets} isLoading={isLoading} onSelect={setSelectedTicket} emptyText="No resolved tickets" />
            </TabsContent>
            <TabsContent value="all">
              <TicketList tickets={tickets} isLoading={isLoading} onSelect={setSelectedTicket} emptyText="No tickets yet" />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} toast={toast} />
    </div>
  );
}

function TicketList({ tickets, isLoading, onSelect, emptyText }: {
  tickets: TicketType[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  emptyText: string;
}) {
  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading tickets...</div>;

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Ticket className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">{emptyText}</h3>
          <p className="text-sm text-muted-foreground/70">Create a new ticket to report an issue or request a feature.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map(ticket => {
        const catConfig = CATEGORIES.find(c => c.value === ticket.category);
        const CatIcon = catConfig?.icon || Bug;
        const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.Open;
        const priorityCfg = PRIORITIES.find(p => p.value === (ticket.adminPriority || ticket.priority));

        return (
          <Card
            key={ticket.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelect(ticket.id)}
            data-testid={`card-ticket-${ticket.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg bg-muted/50 mt-0.5`}>
                    <CatIcon className={`w-5 h-5 ${catConfig?.color || "text-gray-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge className={`text-[10px] ${statusCfg.color}`}>{ticket.status}</Badge>
                      <Badge className={`text-[10px] ${priorityCfg?.color || ""}`}>{ticket.adminPriority || ticket.priority}</Badge>
                    </div>
                    <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{ticket.category}</span>
                      <span>{fmtDate(ticket.createdAt)}</span>
                      {ticket.hospitalName && <span className="text-primary/70">{ticket.hospitalName}</span>}
                      {ticket.assignedName && <span>Assigned: {ticket.assignedName}</span>}
                      {ticket.commentCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="w-3 h-3" /> {ticket.commentCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CreateTicketDialog({ open, onOpenChange, toast }: { open: boolean; onOpenChange: (v: boolean) => void; toast: any }) {
  const [category, setCategory] = useState("Bug Report");
  const [priority, setPriority] = useState("Medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create ticket");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      toast({ title: `Ticket Created: ${data.ticketNumber}`, description: "Your ticket has been submitted successfully." });
      onOpenChange(false);
      setCategory("Bug Report");
      setPriority("Medium");
      setSubject("");
      setDescription("");
      setFiles([]);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Please fill in subject and description", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("category", category);
    formData.append("priority", priority);
    formData.append("subject", subject);
    formData.append("description", description);
    files.forEach(f => formData.append("screenshots", f));
    createMutation.mutate(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="create-ticket-desc">
        <DialogHeader>
          <DialogTitle data-testid="text-create-ticket-title">Create Support Ticket</DialogTitle>
          <p id="create-ticket-desc" className="text-sm text-muted-foreground">Report a bug, suggest a feature, or request training</p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                    category === cat.value ? "bg-primary/10 border-primary/30 text-primary font-medium" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setCategory(cat.value)}
                  data-testid={`button-category-${cat.value.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <cat.icon className={`w-5 h-5 ${cat.color}`} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1" data-testid="select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief summary of the issue or request"
              data-testid="input-ticket-subject"
            />
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail. Include steps to reproduce for bugs."
              rows={5}
              data-testid="input-ticket-description"
            />
          </div>

          <div>
            <Label>Screenshots (optional)</Label>
            <div className="mt-1">
              <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground">
                <Image className="w-4 h-4" />
                <span>Attach screenshots (max 5)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files).slice(0, 5 - files.length);
                      setFiles(prev => [...prev, ...newFiles]);
                    }
                  }}
                  data-testid="input-ticket-screenshots"
                />
              </label>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                      <Paperclip className="w-3 h-3" />
                      <span className="max-w-[100px] truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-ticket">Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-ticket">
            {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailView({ ticketId, onBack, toast }: { ticketId: number; onBack: () => void; toast: any }) {
  const [newComment, setNewComment] = useState("");

  const { data: ticket, isLoading } = useQuery<TicketType & { comments: CommentType[] }>({
    queryKey: ["/api/support-tickets", ticketId],
  });

  const commentMutation = useMutation({
    mutationFn: (message: string) => apiRequest("POST", `/api/support-tickets/${ticketId}/comments`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-tickets"] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !ticket) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <div className="text-center py-12 text-muted-foreground">Loading ticket...</div>
        </main>
      </div>
    );
  }

  const catConfig = CATEGORIES.find(c => c.value === ticket.category);
  const CatIcon = catConfig?.icon || Bug;
  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.Open;
  const priorityCfg = PRIORITIES.find(p => p.value === (ticket.adminPriority || ticket.priority));

  return (
    <div className="flex h-screen bg-background" data-testid="page-ticket-detail">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-4xl mx-auto">
          <Button variant="ghost" className="mb-4" onClick={onBack} data-testid="button-back-to-tickets">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tickets
          </Button>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-muted/50`}>
                  <CatIcon className={`w-6 h-6 ${catConfig?.color || "text-gray-500"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono text-muted-foreground" data-testid="text-ticket-number">{ticket.ticketNumber}</span>
                    <Badge className={`text-xs ${statusCfg.color}`}>{ticket.status}</Badge>
                    <Badge className={`text-xs ${priorityCfg?.color || ""}`}>{ticket.adminPriority || ticket.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                  </div>
                  <h2 className="text-xl font-semibold mb-2" data-testid="text-ticket-subject">{ticket.subject}</h2>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">{ticket.description}</p>

                  {ticket.attachments && (ticket.attachments as string[]).length > 0 && (
                    <div className="mb-4">
                      <Label className="text-xs text-muted-foreground mb-2 block">Attachments</Label>
                      <div className="flex flex-wrap gap-2">
                        {(ticket.attachments as string[]).map((url, i) => (
                          <button key={i} onClick={() => setViewingImage(url)}
                            className="border rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                            data-testid={`btn-attachment-${i}`}>
                            <img src={url} alt={`Screenshot ${i + 1}`} className="w-20 h-20 object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                    <span>Created: {fmtDateTime(ticket.createdAt)}</span>
                    {ticket.createdByName && <span>Raised by: <strong>{ticket.createdByName}</strong></span>}
                    <span>Updated: {fmtDateTime(ticket.updatedAt)}</span>
                    {ticket.assignedName && <span>Assigned to: <strong>{ticket.assignedName}</strong></span>}
                    {ticket.closedAt && <span>Closed: {fmtDateTime(ticket.closedAt)}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Updates & Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.comments && ticket.comments.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {ticket.comments.map(comment => (
                    <div key={comment.id} className={`flex gap-3 ${comment.authorType === "support_user" ? "" : ""}`}
                      data-testid={`comment-${comment.id}`}
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
                            {comment.authorType === "support_user" ? "Support Team" : "You"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{fmtDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.message}</p>
                        {comment.attachments && (comment.attachments as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(comment.attachments as string[]).map((url, i) => (
                              <button key={i} onClick={() => setViewingImage(url)}
                                className="border rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                                data-testid={`btn-comment-attachment-${i}`}>
                                <img src={url} alt={`Attachment ${i + 1}`} className="w-16 h-16 object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm mb-4">
                  No comments yet. The support team will respond to your ticket soon.
                </div>
              )}

              {(ticket.status === "Open" || ticket.status === "In Progress") && (
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Add a comment or provide more details..."
                      rows={2}
                      className="flex-1"
                      data-testid="input-new-comment"
                    />
                    <Button
                      onClick={() => {
                        if (newComment.trim()) commentMutation.mutate(newComment);
                      }}
                      disabled={!newComment.trim() || commentMutation.isPending}
                      className="self-end"
                      data-testid="button-send-comment"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {viewingImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}>
          <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-3xl font-bold leading-none"
              data-testid="btn-close-lightbox">×</button>
            <img src={viewingImage} alt="Screenshot" className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
