import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/date-utils";
import {
  Settings2,
  Save,
  Plus,
  Edit2,
  Trash2,
  Gift,
  Target,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Award,
  Bell,
  UserCheck,
} from "lucide-react";

const LEAD_STATUSES = ["Raw Lead Captured", "New Lead", "Contact Made", "Interested", "Qualified"];
const ASSIGNMENT_STRATEGIES = [
  { value: "round_robin", label: "Round Robin" },
  { value: "specific_user", label: "Specific User" },
  { value: "least_loaded", label: "Least Loaded" },
];
const EPISODE_STAGES = [
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
const REWARD_TYPES = ["Recognition", "Cash", "Discount", "Loyalty Points", "Gift Voucher", "Other"];
const REFERRER_TYPES = ["All", "Doctor", "Patient", "Hospital", "Agent", "Other"];

type ReferralConfigType = {
  id: number;
  tenantId: number;
  autoCreateLead: boolean;
  defaultLeadStatus: string;
  assignmentStrategy: string;
  assignToUserIds: number[];
  assignToBranchId: number | null;
  trackReferralLeads: boolean;
  trackedFunnelStages: string[];
};

type RewardRule = {
  id: number;
  name: string;
  triggerStage: string;
  referrerTypeFilter: string | null;
  rewardType: string;
  rewardLabel: string | null;
  rewardValue: string | null;
  notifyReferrer: boolean;
  isActive: boolean;
};

type RewardLog = {
  id: number;
  rewardRuleId: number;
  referralId: number;
  referrerId: number | null;
  leadId: number | null;
  episodeId: number | null;
  triggerStage: string;
  rewardType: string;
  rewardLabel: string | null;
  rewardValue: string | null;
  status: string;
  processedAt: string | null;
  createdAt: string;
  referrerName: string | null;
  leadName: string | null;
  ruleName: string | null;
};

type CrmUser = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
};

type Branch = {
  id: number;
  name: string;
  status: string;
};

export default function ReferralConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("lead-settings");

  const { data: config, isLoading: configLoading } = useQuery<ReferralConfigType>({
    queryKey: ["/api/referral-config"],
  });

  const { data: rewardRules = [] } = useQuery<RewardRule[]>({
    queryKey: ["/api/referral-reward-rules"],
  });

  const { data: rewardLogs = [] } = useQuery<RewardLog[]>({
    queryKey: ["/api/referral-reward-logs"],
  });

  const { data: crmUsers = [] } = useQuery<CrmUser[]>({
    queryKey: ["/api/masters/crmUsers"],
  });

  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/masters/branches"],
  });

  const activeUsers = crmUsers.filter((u: any) => u.isActive !== false && (u.approvalStatus === "Approved" || !u.approvalStatus));
  const activeBranches = branchesList.filter((b: any) => b.status === "Active" && (b.approvalStatus === "Approved" || !b.approvalStatus));

  return (
    <div className="flex h-screen bg-background" data-testid="page-referral-config">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Settings2 className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Referral Configuration</h1>
              <p className="text-sm text-muted-foreground">Configure how referrals create leads, tracking, and reward rules</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6" data-testid="tabs-referral-config">
              <TabsTrigger value="lead-settings" data-testid="tab-lead-settings">
                <Target className="w-4 h-4 mr-1.5" /> Lead Settings
              </TabsTrigger>
              <TabsTrigger value="tracking" data-testid="tab-tracking">
                <TrendingUp className="w-4 h-4 mr-1.5" /> Tracking
              </TabsTrigger>
              <TabsTrigger value="reward-rules" data-testid="tab-reward-rules">
                <Award className="w-4 h-4 mr-1.5" /> Reward Rules
              </TabsTrigger>
              <TabsTrigger value="reward-log" data-testid="tab-reward-log">
                <Gift className="w-4 h-4 mr-1.5" /> Reward Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lead-settings">
              {configLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>
              ) : config ? (
                <LeadSettingsTab config={config} activeUsers={activeUsers} activeBranches={activeBranches} toast={toast} />
              ) : null}
            </TabsContent>

            <TabsContent value="tracking">
              {config && <TrackingTab config={config} toast={toast} />}
            </TabsContent>

            <TabsContent value="reward-rules">
              <RewardRulesTab rules={rewardRules} toast={toast} />
            </TabsContent>

            <TabsContent value="reward-log">
              <RewardLogTab logs={rewardLogs} toast={toast} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function LeadSettingsTab({ config, activeUsers, activeBranches, toast }: {
  config: ReferralConfigType;
  activeUsers: any[];
  activeBranches: any[];
  toast: any;
}) {
  const [form, setForm] = useState({
    autoCreateLead: config.autoCreateLead,
    defaultLeadStatus: config.defaultLeadStatus,
    assignmentStrategy: config.assignmentStrategy,
    assignToUserIds: config.assignToUserIds || [],
    assignToBranchId: config.assignToBranchId,
  });

  useEffect(() => {
    setForm({
      autoCreateLead: config.autoCreateLead,
      defaultLeadStatus: config.defaultLeadStatus,
      assignmentStrategy: config.assignmentStrategy,
      assignToUserIds: config.assignToUserIds || [],
      assignToBranchId: config.assignToBranchId,
    });
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/referral-config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-config"] });
      toast({ title: "Lead settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function toggleUser(userId: number) {
    setForm(prev => ({
      ...prev,
      assignToUserIds: prev.assignToUserIds.includes(userId)
        ? prev.assignToUserIds.filter(id => id !== userId)
        : [...prev.assignToUserIds, userId],
    }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" /> Auto-Create Lead from Referral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-Create Lead</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When a referral is recorded, automatically create a lead in the CRM</p>
            </div>
            <Switch
              checked={form.autoCreateLead}
              onCheckedChange={v => setForm({ ...form, autoCreateLead: v })}
              data-testid="switch-auto-create-lead"
            />
          </div>

          {form.autoCreateLead && (
            <>
              <div className="border-t pt-4">
                <Label>Default Lead Status</Label>
                <Select value={form.defaultLeadStatus} onValueChange={v => setForm({ ...form, defaultLeadStatus: v })}>
                  <SelectTrigger className="mt-1" data-testid="select-default-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <Label>Assignment Strategy</Label>
                <Select value={form.assignmentStrategy} onValueChange={v => setForm({ ...form, assignmentStrategy: v })}>
                  <SelectTrigger className="mt-1" data-testid="select-assignment-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.assignmentStrategy === "round_robin" && "Leads are distributed evenly across selected users in rotation"}
                  {form.assignmentStrategy === "specific_user" && "All referral leads are assigned to the first selected user"}
                  {form.assignmentStrategy === "least_loaded" && "Leads are assigned to the user with the fewest active leads"}
                </p>
              </div>

              <div className="border-t pt-4">
                <Label>Assign To Users</Label>
                <p className="text-xs text-muted-foreground mb-2">Select which CRM users should receive referral leads</p>
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {activeUsers.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">No active users found</div>
                  ) : (
                    activeUsers.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                          form.assignToUserIds.includes(u.id) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleUser(u.id)}
                        data-testid={`button-toggle-user-${u.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{u.name} <span className="text-muted-foreground text-xs">({u.code})</span></span>
                          {form.assignToUserIds.includes(u.id) && <CheckCircle className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {form.assignToUserIds.length > 0 && (
                  <p className="text-xs text-primary mt-1">{form.assignToUserIds.length} user(s) selected</p>
                )}
              </div>

              <div className="border-t pt-4">
                <Label>Branch (Optional)</Label>
                <Select
                  value={form.assignToBranchId ? String(form.assignToBranchId) : "none"}
                  onValueChange={v => setForm({ ...form, assignToBranchId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Branch Filter</SelectItem>
                    {activeBranches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Optionally assign referral leads to a specific branch</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          data-testid="button-save-lead-settings"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Lead Settings"}
        </Button>
      </div>
    </div>
  );
}

function TrackingTab({ config, toast }: { config: ReferralConfigType; toast: any }) {
  const [form, setForm] = useState({
    trackReferralLeads: config.trackReferralLeads,
    trackedFunnelStages: config.trackedFunnelStages || [],
  });

  useEffect(() => {
    setForm({
      trackReferralLeads: config.trackReferralLeads,
      trackedFunnelStages: config.trackedFunnelStages || [],
    });
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/referral-config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-config"] });
      toast({ title: "Tracking settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function toggleStage(stage: string) {
    setForm(prev => ({
      ...prev,
      trackedFunnelStages: prev.trackedFunnelStages.includes(stage)
        ? prev.trackedFunnelStages.filter(s => s !== stage)
        : [...prev.trackedFunnelStages, stage],
    }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Referral Funnel Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Track Referral-Sourced Leads</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Enable separate tracking for leads that originated from referrals</p>
            </div>
            <Switch
              checked={form.trackReferralLeads}
              onCheckedChange={v => setForm({ ...form, trackReferralLeads: v })}
              data-testid="switch-track-referrals"
            />
          </div>

          {form.trackReferralLeads && (
            <div className="border-t pt-4">
              <Label className="mb-2 block">Funnel Stages to Track</Label>
              <p className="text-xs text-muted-foreground mb-3">Select which episode stages to track for referral-sourced leads. These will appear in referral analytics.</p>
              <div className="grid grid-cols-2 gap-2">
                {EPISODE_STAGES.map(stage => (
                  <button
                    key={stage}
                    type="button"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      form.trackedFunnelStages.includes(stage)
                        ? "bg-primary/10 border-primary/30 text-primary font-medium"
                        : "hover:bg-muted/50 border-border"
                    }`}
                    onClick={() => toggleStage(stage)}
                    data-testid={`button-toggle-stage-${stage.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {form.trackedFunnelStages.includes(stage) ? (
                      <CheckCircle className="w-4 h-4 text-primary" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                    {stage}
                  </button>
                ))}
              </div>
              {form.trackedFunnelStages.length > 0 && (
                <p className="text-xs text-primary mt-2">{form.trackedFunnelStages.length} stage(s) selected</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          data-testid="button-save-tracking"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Tracking Settings"}
        </Button>
      </div>
    </div>
  );
}

function RewardRulesTab({ rules, toast }: { rules: RewardRule[]; toast: any }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RewardRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerStage: "Consultation Done",
    referrerTypeFilter: "All",
    rewardType: "Recognition",
    rewardLabel: "",
    rewardValue: "",
    notifyReferrer: false,
    isActive: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/referral-reward-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-reward-rules"] });
      setDialogOpen(false);
      toast({ title: "Reward rule created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/referral-reward-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-reward-rules"] });
      setDialogOpen(false);
      toast({ title: "Reward rule updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/referral-reward-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-reward-rules"] });
      toast({ title: "Reward rule deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", triggerStage: "Consultation Done", referrerTypeFilter: "All", rewardType: "Recognition", rewardLabel: "", rewardValue: "", notifyReferrer: false, isActive: true });
    setDialogOpen(true);
  }

  function openEdit(rule: RewardRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      triggerStage: rule.triggerStage,
      referrerTypeFilter: rule.referrerTypeFilter || "All",
      rewardType: rule.rewardType,
      rewardLabel: rule.rewardLabel || "",
      rewardValue: rule.rewardValue || "",
      notifyReferrer: rule.notifyReferrer,
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Rule name is required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      rewardLabel: form.rewardLabel || null,
      rewardValue: form.rewardValue || null,
      referrerTypeFilter: form.referrerTypeFilter === "All" ? null : form.referrerTypeFilter,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reward Rules</h3>
          <p className="text-sm text-muted-foreground">Define when referral rewards are triggered based on episode milestones</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-reward-rule">
          <Plus className="w-4 h-4 mr-2" /> Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Reward Rules</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">Create your first reward rule to start tracking referral rewards.</p>
            <Button onClick={openCreate} variant="outline" data-testid="button-create-first-rule">
              <Plus className="w-4 h-4 mr-2" /> Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} data-testid={`card-reward-rule-${rule.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${rule.isActive ? "bg-green-50 dark:bg-green-950/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                      <Award className={`w-5 h-5 ${rule.isActive ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.isActive ? "default" : "secondary"} className="text-[10px]">
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Trigger: <strong>{rule.triggerStage}</strong></span>
                        {rule.referrerTypeFilter && <span>Referrer: {rule.referrerTypeFilter}</span>}
                        <span>Reward: {rule.rewardType}{rule.rewardLabel ? ` — ${rule.rewardLabel}` : ""}</span>
                        {rule.notifyReferrer && (
                          <span className="flex items-center gap-0.5"><Bell className="w-3 h-3" /> Notify</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => { if (confirm("Delete this reward rule?")) deleteMutation.mutate(rule.id); }}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby="reward-rule-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-reward-rule-title">
              {editing ? "Edit Reward Rule" : "Create Reward Rule"}
            </DialogTitle>
            <p id="reward-rule-desc" className="text-sm text-muted-foreground">
              Define when a referral reward should be triggered
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Consultation Reward"
                data-testid="input-rule-name"
              />
            </div>
            <div>
              <Label>Trigger Stage *</Label>
              <Select value={form.triggerStage} onValueChange={v => setForm({ ...form, triggerStage: v })}>
                <SelectTrigger data-testid="select-trigger-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EPISODE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Reward triggers when the episode reaches this stage</p>
            </div>
            <div>
              <Label>Referrer Type Filter</Label>
              <Select value={form.referrerTypeFilter} onValueChange={v => setForm({ ...form, referrerTypeFilter: v })}>
                <SelectTrigger data-testid="select-referrer-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Apply this rule only to specific referrer types, or "All" for everyone</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reward Type</Label>
                <Select value={form.rewardType} onValueChange={v => setForm({ ...form, rewardType: v })}>
                  <SelectTrigger data-testid="select-reward-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reward Value</Label>
                <Input
                  value={form.rewardValue}
                  onChange={e => setForm({ ...form, rewardValue: e.target.value })}
                  placeholder="e.g., 500, 10%"
                  data-testid="input-reward-value"
                />
              </div>
            </div>
            <div>
              <Label>Reward Label / Description</Label>
              <Input
                value={form.rewardLabel}
                onChange={e => setForm({ ...form, rewardLabel: e.target.value })}
                placeholder="e.g., Referral Thank You Gift"
                data-testid="input-reward-label"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Notify Referrer</Label>
                <p className="text-[11px] text-muted-foreground">Flag the referrer when the reward is triggered</p>
              </div>
              <Switch
                checked={form.notifyReferrer}
                onCheckedChange={v => setForm({ ...form, notifyReferrer: v })}
                data-testid="switch-notify-referrer"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm({ ...form, isActive: v })}
                data-testid="switch-rule-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-rule">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editing ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RewardLogTab({ logs, toast }: { logs: RewardLog[]; toast: any }) {
  const updateLogMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/referral-reward-logs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-reward-logs"] });
      toast({ title: "Reward status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "Processed": return "default";
      case "Pending": return "secondary";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Reward Log</h3>
        <p className="text-sm text-muted-foreground">History of triggered referral rewards and their processing status</p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Rewards Triggered Yet</h3>
            <p className="text-sm text-muted-foreground/70">Rewards will appear here when referral-sourced episodes reach configured trigger stages.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="table-reward-logs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Rule</th>
                <th className="text-left p-3 font-medium">Referrer</th>
                <th className="text-left p-3 font-medium">Lead</th>
                <th className="text-left p-3 font-medium">Trigger</th>
                <th className="text-left p-3 font-medium">Reward</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t hover:bg-muted/20" data-testid={`row-reward-log-${log.id}`}>
                  <td className="p-3 text-muted-foreground">{log.createdAt ? fmtDate(log.createdAt) : "—"}</td>
                  <td className="p-3 font-medium">{log.ruleName || `Rule #${log.rewardRuleId}`}</td>
                  <td className="p-3">{log.referrerName || "—"}</td>
                  <td className="p-3">{log.leadName || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">{log.triggerStage}</Badge>
                  </td>
                  <td className="p-3">
                    <span className="text-xs">{log.rewardType}{log.rewardLabel ? ` — ${log.rewardLabel}` : ""}{log.rewardValue ? ` (${log.rewardValue})` : ""}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant={statusColor(log.status) as any} className="text-[10px]">{log.status}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    {log.status === "Pending" && (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-green-600"
                          onClick={() => updateLogMutation.mutate({ id: log.id, status: "Processed" })}
                          data-testid={`button-process-reward-${log.id}`}
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Process
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => updateLogMutation.mutate({ id: log.id, status: "Cancelled" })}
                          data-testid={`button-cancel-reward-${log.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    )}
                    {log.status === "Processed" && log.processedAt && (
                      <span className="text-xs text-muted-foreground">{fmtDate(log.processedAt)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
