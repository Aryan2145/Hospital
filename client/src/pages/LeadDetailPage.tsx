import { useRoute, useLocation } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useLead, useLeadActivities, useUpdateLead, useCreateActivity, useTasks, useCreateTask, useUpdateTask, useHandoverAction, useAssignLead, useActiveCrmUsers, useDoctors, useDoctorAvailability, useCreateAppointment } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getStatusColor, getPriorityColor, getValidTransitions, isValidTransition, LEAD_STATUSES } from "@/lib/lead-status";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Clock,
  StickyNote,
  ArrowRightLeft,
  MessageSquare,
  Activity,
  CheckSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  User,
  Building,
  Target,
  TrendingUp,
  ChevronRight,
  UserPlus,
  ArrowRight,
  X,
  Shield,
} from "lucide-react";

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  note: StickyNote,
  status_change: ArrowRightLeft,
  appointment: Calendar,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageSquare,
  task: CheckSquare,
};

export default function LeadDetailPage() {
  const [, params] = useRoute("/leads/:id");
  const [, setLocation] = useLocation();
  const leadId = Number(params?.id);
  const { data: lead, isLoading } = useLead(leadId);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading lead..." />
        </main>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Lead not found</p>
            <Button variant="outline" onClick={() => setLocation("/leads")} data-testid="button-back-to-leads">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <LeadHeader lead={lead} onBack={() => setLocation("/leads")} />
        {lead.handoverStatus === "Pending" && <HandoverBanner lead={lead} />}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <ActivityTimeline leadId={lead.id} />
          </div>
          <div className="w-80 flex flex-col overflow-y-auto bg-muted/20">
            <NextActionPanel lead={lead} />
            <TasksPanel leadId={lead.id} />
            <QuickActions lead={lead} />
          </div>
        </div>
      </main>
    </div>
  );
}

function LeadHeader({ lead, onBack }: { lead: any; onBack: () => void }) {
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const validTransitions = getValidTransitions(lead.status);

  const handleStatusChange = (newStatus: string) => {
    if (!isValidTransition(lead.status, newStatus)) {
      toast({ title: "Invalid transition", description: `Cannot move from "${lead.status}" to "${newStatus}"`, variant: "destructive" });
      return;
    }
    updateLead.mutate({ id: lead.id, status: newStatus });
  };

  const slaBreached = lead.slaBreached;
  const slaDeadline = lead.slaDeadline ? new Date(lead.slaDeadline) : null;
  const slaExpired = slaDeadline ? isPast(slaDeadline) : false;

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center gap-3 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground truncate" data-testid="text-lead-name">{lead.name}</h1>
            <span className="text-xs font-mono text-muted-foreground" data-testid="text-lead-id">#{lead.id}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={cn("text-xs", getStatusColor(lead.status))} data-testid="badge-status">
          {lead.status}
        </Badge>

        {lead.priority && lead.priority !== "Normal" && (
          <Badge className={cn("text-xs", getPriorityColor(lead.priority))} data-testid="badge-priority">
            {lead.priority}
          </Badge>
        )}

        {lead.leadScore !== null && lead.leadScore !== undefined && lead.leadScore > 0 && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-score">
            <TrendingUp className="w-3 h-3" />
            Score: {lead.leadScore}
          </Badge>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
          <Phone className="w-3 h-3" />
          <span data-testid="text-phone">{lead.phoneE164}</span>
        </div>

        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span data-testid="text-email">{lead.email}</span>
          </div>
        )}

        {(slaBreached || slaExpired) && (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 gap-1" data-testid="badge-sla-breached">
            <AlertTriangle className="w-3 h-3" />
            SLA Breached
          </Badge>
        )}

        {slaDeadline && !slaExpired && !slaBreached && (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 gap-1" data-testid="badge-sla-timer">
            <Clock className="w-3 h-3" />
            SLA: {formatDistanceToNow(slaDeadline)}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {validTransitions.length > 0 && (
            <Select onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-change-status">
                <SelectValue placeholder="Change Status" />
              </SelectTrigger>
              <SelectContent>
                {validTransitions.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`option-status-${s.replace(/\s+/g, '-').toLowerCase()}`}>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3" />
                      {s}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}

function HandoverBanner({ lead }: { lead: any }) {
  const handoverAction = useHandoverAction();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleAccept = () => {
    handoverAction.mutate(
      { leadId: lead.id, action: "accept" },
      {
        onSuccess: () => toast({ title: "Handover accepted" }),
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    handoverAction.mutate(
      { leadId: lead.id, action: "reject", rejectionReason },
      {
        onSuccess: () => {
          toast({ title: "Handover rejected" });
          setRejectDialogOpen(false);
          setRejectionReason("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const slaDeadline = lead.slaDeadline ? new Date(lead.slaDeadline) : null;
  const slaExpired = slaDeadline ? isPast(slaDeadline) : false;

  return (
    <div className={cn(
      "px-4 py-3 flex items-center gap-3 flex-wrap border-b border-border",
      slaExpired ? "bg-red-50 dark:bg-red-950/30" : "bg-amber-50 dark:bg-amber-950/30"
    )} data-testid="banner-handover">
      <Shield className={cn("w-5 h-5 shrink-0", slaExpired ? "text-red-600" : "text-amber-600")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", slaExpired ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300")}>
          Pending Handover
          {lead.handoverFromUserId && <span className="font-normal"> from CRM User #{lead.handoverFromUserId}</span>}
        </p>
        {slaDeadline && (
          <p className={cn("text-xs", slaExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
            {slaExpired ? "SLA breached - " : "Accept within "}
            {formatDistanceToNow(slaDeadline, { addSuffix: true })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={handoverAction.isPending}
          data-testid="button-accept-handover"
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Accept
        </Button>
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={handoverAction.isPending}
              data-testid="button-reject-handover"
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Handover</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason for rejection</label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why are you rejecting this handover?"
                  rows={3}
                  data-testid="input-rejection-reason"
                />
              </div>
              <Button onClick={handleReject} variant="destructive" className="w-full" disabled={handoverAction.isPending} data-testid="button-confirm-reject">
                Confirm Rejection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ActivityTimeline({ leadId }: { leadId: number }) {
  const { data: activities, isLoading } = useLeadActivities(leadId);
  const createActivity = useCreateActivity();
  const [text, setText] = useState("");
  const [activityType, setActivityType] = useState("note");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    createActivity.mutate({
      leadId,
      data: {
        leadId,
        type: activityType,
        description: text,
        tenantId: 1,
        createdBy: "placeholder",
      },
    });
    setText("");
  };

  return (
    <>
      <div className="p-4 border-b border-border bg-card">
        <h3 className="font-semibold text-sm text-foreground">Activity Timeline</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
        ) : !activities?.length ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No activity recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Activity;
              const isStatusChange = activity.type === "status_change" || (activity.oldStatus && activity.newStatus);
              return (
                <div key={activity.id} className="flex gap-3" data-testid={`activity-${activity.id}`}>
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      activity.type === "call" ? "bg-blue-100 text-blue-600" :
                      isStatusChange ? "bg-purple-100 text-purple-600" :
                      activity.type === "appointment" ? "bg-green-100 text-green-600" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold uppercase text-foreground/70">{activity.type.replace(/_/g, " ")}</span>
                      {activity.outcome && (
                        <Badge variant="outline" className="text-[10px]">{activity.outcome}</Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {activity.createdAt && format(new Date(activity.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{activity.description}</p>
                    {isStatusChange && activity.oldStatus && activity.newStatus && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <Badge className={cn("text-[10px]", getStatusColor(activity.oldStatus))}>{activity.oldStatus}</Badge>
                        <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                        <Badge className={cn("text-[10px]", getStatusColor(activity.newStatus))}>{activity.newStatus}</Badge>
                      </div>
                    )}
                    {activity.callDurationSeconds && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Duration: {Math.floor(activity.callDurationSeconds / 60)}m {activity.callDurationSeconds % 60}s
                        {activity.callDirection && ` | ${activity.callDirection}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-activity-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
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

function NextActionPanel({ lead }: { lead: any }) {
  const updateLead = useUpdateLead();
  const [editing, setEditing] = useState(false);
  const [nextActionDate, setNextActionDate] = useState(lead.nextActionDate ? format(new Date(lead.nextActionDate), "yyyy-MM-dd'T'HH:mm") : "");
  const [nextActionNotes, setNextActionNotes] = useState(lead.nextActionNotes || "");

  const handleSave = () => {
    updateLead.mutate({
      id: lead.id,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : undefined,
      nextActionNotes: nextActionNotes || null,
    });
    setEditing(false);
  };

  const hasNextAction = lead.nextActionDate || lead.nextActionNotes;

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Next Action
        </h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(!editing)} data-testid="button-edit-next-action">
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Input
            type="datetime-local"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
            className="text-xs"
            data-testid="input-next-action-date"
          />
          <Textarea
            value={nextActionNotes}
            onChange={(e) => setNextActionNotes(e.target.value)}
            placeholder="Notes..."
            className="text-xs resize-none"
            rows={2}
            data-testid="input-next-action-notes"
          />
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave} disabled={updateLead.isPending} data-testid="button-save-next-action">
            Save
          </Button>
        </div>
      ) : hasNextAction ? (
        <Card className="p-3">
          {lead.nextActionDate && (
            <div className="flex items-center gap-2 text-xs mb-1">
              <Calendar className="w-3 h-3 text-primary" />
              <span className="font-medium">{format(new Date(lead.nextActionDate), "MMM d, yyyy h:mm a")}</span>
              {isPast(new Date(lead.nextActionDate)) && (
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Overdue</Badge>
              )}
            </div>
          )}
          {lead.nextActionNotes && (
            <p className="text-xs text-muted-foreground mt-1">{lead.nextActionNotes}</p>
          )}
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">No next action set.</p>
      )}
    </div>
  );
}

function TasksPanel({ leadId }: { leadId: number }) {
  const { data: leadTasks, isLoading } = useTasks(leadId);
  const updateTask = useUpdateTask();

  const pendingTasks = leadTasks?.filter((t) => t.status !== "Completed") || [];
  const completedTasks = leadTasks?.filter((t) => t.status === "Completed") || [];

  const handleComplete = (taskId: number) => {
    updateTask.mutate({ id: taskId, status: "Completed" });
  };

  return (
    <div className="p-4 border-b border-border">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
        <CheckSquare className="w-4 h-4 text-primary" />
        Tasks ({pendingTasks.length})
      </h3>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : pendingTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending tasks.</p>
      ) : (
        <div className="space-y-2">
          {pendingTasks.slice(0, 5).map((task) => (
            <Card key={task.id} className="p-2" data-testid={`task-${task.id}`}>
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleComplete(task.id)}
                  className="mt-0.5 w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 hover:bg-primary/10"
                  data-testid={`button-complete-task-${task.id}`}
                >
                  <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                  {task.dueDate && (
                    <p className={cn("text-[10px]", isPast(new Date(task.dueDate)) ? "text-red-500" : "text-muted-foreground")}>
                      Due: {format(new Date(task.dueDate), "MMM d")}
                    </p>
                  )}
                </div>
                {task.priority === "High" && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">High</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickActions({ lead }: { lead: any }) {
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const assignLead = useAssignLead();
  const createAppointment = useCreateAppointment();
  const { data: crmUsers } = useActiveCrmUsers();
  const { data: doctorsList } = useDoctors();
  const { toast } = useToast();
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("Normal");
  const [selectedCrmUserId, setSelectedCrmUserId] = useState("");
  const [apptDoctorId, setApptDoctorId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptSlot, setApptSlot] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  const { data: availability, isLoading: availLoading } = useDoctorAvailability(
    apptDoctorId ? Number(apptDoctorId) : null,
    apptDate || null
  );

  const handleLogCall = () => {
    createActivity.mutate({
      leadId: lead.id,
      data: {
        leadId: lead.id,
        type: "call",
        description: callNotes || "Phone call",
        outcome: callOutcome || undefined,
        callDurationSeconds: callDuration ? parseInt(callDuration) * 60 : undefined,
        callDirection: "Outbound",
        tenantId: 1,
        createdBy: "placeholder",
      },
    }, {
      onSuccess: () => {
        setCallNotes("");
        setCallOutcome("");
        setCallDuration("");
        setCallDialogOpen(false);
        toast({ title: "Call logged" });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleCreateTask = () => {
    if (!taskTitle.trim() || !taskDueDate) return;
    createTask.mutate({
      leadId: lead.id,
      title: taskTitle,
      dueDate: new Date(taskDueDate),
      priority: taskPriority,
      status: "Pending",
      tenantId: 1,
    }, {
      onSuccess: () => {
        setTaskTitle("");
        setTaskDueDate("");
        setTaskPriority("Normal");
        setTaskDialogOpen(false);
        toast({ title: "Task created" });
      },
      onError: (err) => {
        toast({ title: "Error creating task", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3">Quick Actions</h3>
      <div className="space-y-2">
        <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-log-call">
              <Phone className="w-4 h-4 mr-2" />
              Log Call
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Call</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Outcome</label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger data-testid="select-call-outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Connected">Connected</SelectItem>
                    <SelectItem value="No Answer">No Answer</SelectItem>
                    <SelectItem value="Busy">Busy</SelectItem>
                    <SelectItem value="Voicemail">Voicemail</SelectItem>
                    <SelectItem value="Wrong Number">Wrong Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <Input
                  type="number"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="0"
                  data-testid="input-call-duration"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes..."
                  rows={3}
                  data-testid="input-call-notes"
                />
              </div>
              <Button onClick={handleLogCall} className="w-full" disabled={createActivity.isPending} data-testid="button-submit-call">
                Log Call
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-create-task">
              <CheckSquare className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                <Input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  data-testid="input-task-due-date"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateTask} className="w-full" disabled={createTask.isPending || !taskTitle.trim() || !taskDueDate} data-testid="button-submit-task">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-book-appointment">
              <Calendar className="w-4 h-4 mr-2" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Doctor</label>
                <Select value={apptDoctorId} onValueChange={(v) => { setApptDoctorId(v); setApptSlot(""); }}>
                  <SelectTrigger data-testid="select-appt-doctor">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorsList?.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name} {d.specialization ? `(${d.specialization})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={apptDate}
                  onChange={(e) => { setApptDate(e.target.value); setApptSlot(""); }}
                  min={new Date().toISOString().split("T")[0]}
                  data-testid="input-appt-date"
                />
              </div>
              {apptDoctorId && apptDate && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Available Slots</label>
                  {availLoading ? (
                    <p className="text-xs text-muted-foreground py-2">Loading slots...</p>
                  ) : availability && !availability.available ? (
                    <p className="text-xs text-destructive py-2">{availability.reason}</p>
                  ) : availability && availability.slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {availability.slots.map((slot) => (
                        <Button
                          key={slot.startTime}
                          variant={apptSlot === slot.startTime ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          disabled={slot.availableCount === 0}
                          onClick={() => setApptSlot(slot.startTime)}
                          data-testid={`button-slot-${slot.startTime}`}
                        >
                          {slot.startTime?.substring(0, 5)} - {slot.endTime?.substring(0, 5)}
                          <span className="ml-1 text-muted-foreground">({slot.availableCount})</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">No slots available</p>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={apptNotes}
                  onChange={(e) => setApptNotes(e.target.value)}
                  placeholder="Appointment notes..."
                  rows={2}
                  data-testid="input-appt-notes"
                />
              </div>
              <Button
                onClick={() => {
                  const selectedSlot = availability?.slots.find(s => s.startTime === apptSlot);
                  createAppointment.mutate(
                    {
                      leadId: lead.id,
                      doctorId: Number(apptDoctorId),
                      appointmentDate: new Date(apptDate + "T" + (apptSlot ? apptSlot.substring(0, 5) : "09:00") + ":00").toISOString(),
                      startTime: apptSlot || undefined,
                      endTime: selectedSlot?.endTime || undefined,
                      notes: apptNotes || undefined,
                      status: "Scheduled",
                    },
                    {
                      onSuccess: (data) => {
                        toast({ title: "Appointment booked", description: `Token #${data.tokenNumber}` });
                        setApptDialogOpen(false);
                        setApptDoctorId("");
                        setApptDate("");
                        setApptSlot("");
                        setApptNotes("");
                      },
                      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                    }
                  );
                }}
                className="w-full"
                disabled={createAppointment.isPending || !apptDoctorId || !apptDate}
                data-testid="button-confirm-appointment"
              >
                Book Appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-xs" data-testid="button-assign-lead">
              <UserPlus className="w-4 h-4 mr-2" />
              Assign / Transfer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assign to CRM User</label>
                <Select value={selectedCrmUserId} onValueChange={setSelectedCrmUserId}>
                  <SelectTrigger data-testid="select-assign-user">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {crmUsers?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {lead.assignedCrmUserId && (
                <p className="text-xs text-muted-foreground">
                  Currently assigned to CRM User #{lead.assignedCrmUserId}
                </p>
              )}
              <Button
                onClick={() => {
                  if (!selectedCrmUserId) return;
                  assignLead.mutate(
                    { leadId: lead.id, assignToCrmUserId: Number(selectedCrmUserId) },
                    {
                      onSuccess: () => {
                        toast({ title: "Lead assigned", description: "Handover is now pending acceptance." });
                        setAssignDialogOpen(false);
                        setSelectedCrmUserId("");
                      },
                      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                    }
                  );
                }}
                className="w-full"
                disabled={assignLead.isPending || !selectedCrmUserId}
                data-testid="button-confirm-assign"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Assign & Initiate Handover
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
