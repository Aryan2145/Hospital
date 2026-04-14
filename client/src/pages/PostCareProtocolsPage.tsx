import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  HeartPulse,
  Clock,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Star,
} from "lucide-react";

type ProtocolStep = {
  id?: number;
  stepNumber: number;
  daysAfterDischarge: number;
  taskTitle: string;
  taskDescription: string;
  assigneeType: string;
  assigneeRoleCode: string;
  priority: string;
  status: string;
};

type Protocol = {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  description: string | null;
  triggerOn: string;
  isDefault: boolean;
  status: string;
  displayOrder: number;
  steps?: ProtocolStep[];
};

const EMPTY_STEP: ProtocolStep = {
  stepNumber: 1,
  daysAfterDischarge: 7,
  taskTitle: "",
  taskDescription: "",
  assigneeType: "PostCareOwner",
  assigneeRoleCode: "",
  priority: "Normal",
  status: "Active",
};

export default function PostCareProtocolsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    triggerOn: "Post Care",
    isDefault: false,
    status: "Active",
  });
  const [steps, setSteps] = useState<ProtocolStep[]>([{ ...EMPTY_STEP }]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: protocols = [], isLoading } = useQuery<Protocol[]>({
    queryKey: ["/api/post-care-protocols"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/post-care-protocols", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/post-care-protocols"] });
      setDialogOpen(false);
      toast({ title: "Protocol created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/post-care-protocols/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/post-care-protocols"] });
      setDialogOpen(false);
      toast({ title: "Protocol updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/post-care-protocols/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/post-care-protocols"] });
      setDeleteConfirm(null);
      toast({ title: "Protocol deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingProtocol(null);
    setFormData({ code: "", name: "", description: "", triggerOn: "Post Care", isDefault: false, status: "Active" });
    setSteps([{ ...EMPTY_STEP }]);
    setDialogOpen(true);
  }

  async function openEdit(protocol: Protocol) {
    try {
      const res = await fetch(`/api/post-care-protocols/${protocol.id}`, { credentials: "include" });
      const full = await res.json();
      setEditingProtocol(full);
      setFormData({
        code: full.code,
        name: full.name,
        description: full.description || "",
        triggerOn: full.triggerOn,
        isDefault: full.isDefault,
        status: full.status,
      });
      setSteps(full.steps?.length > 0 ? full.steps : [{ ...EMPTY_STEP }]);
      setDialogOpen(true);
    } catch {
      toast({ title: "Error loading protocol", variant: "destructive" });
    }
  }

  function addStep() {
    const maxDay = steps.length > 0 ? Math.max(...steps.map(s => s.daysAfterDischarge)) : 0;
    setSteps([...steps, {
      ...EMPTY_STEP,
      stepNumber: steps.length + 1,
      daysAfterDischarge: maxDay + 30,
    }]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  }

  function updateStep(index: number, field: keyof ProtocolStep, value: any) {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSteps(updated.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  }

  function handleSave() {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }
    const validSteps = steps.filter(s => s.taskTitle.trim());
    if (validSteps.length === 0) {
      toast({ title: "At least one step with a task title is required", variant: "destructive" });
      return;
    }
    const payload = { ...formData, steps: validSteps };
    if (editingProtocol) {
      updateMutation.mutate({ id: editingProtocol.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "Urgent": return "destructive";
      case "High": return "destructive";
      case "Normal": return "secondary";
      case "Low": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-post-care-protocols">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Post-Care Protocols</h1>
                <p className="text-sm text-muted-foreground">Configure follow-up schedules for patients after treatment</p>
              </div>
            </div>
            <Button onClick={openCreate} data-testid="button-create-protocol">
              <Plus className="h-4 w-4 mr-2" />
              New Protocol
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
          ) : protocols.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Protocols Configured</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Create your first post-care follow-up protocol to automate patient follow-ups after treatment.</p>
                <Button onClick={openCreate} variant="outline" data-testid="button-create-first-protocol">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Protocol
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {protocols.map(protocol => (
                <Card key={protocol.id} className="hover:shadow-sm transition-shadow" data-testid={`card-protocol-${protocol.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground" data-testid={`text-protocol-name-${protocol.id}`}>{protocol.name}</h3>
                          {protocol.isDefault && (
                            <Badge variant="default" className="text-xs" data-testid={`badge-default-${protocol.id}`}>
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          <Badge variant={protocol.status === "Active" ? "outline" : "secondary"} className="text-xs">
                            {protocol.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{protocol.description || "No description"}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Triggers on: {protocol.triggerOn}
                          </span>
                          <span>Code: {protocol.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(protocol)} data-testid={`button-edit-protocol-${protocol.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(protocol.id)} data-testid={`button-delete-protocol-${protocol.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="protocol-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingProtocol ? "Edit Protocol" : "Create Post-Care Protocol"}
            </DialogTitle>
            <p id="protocol-dialog-desc" className="text-sm text-muted-foreground">
              Define the follow-up rhythm for patients after treatment
            </p>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Protocol Code *</Label>
                <Input
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                  placeholder="e.g. ORTHO_STANDARD"
                  data-testid="input-protocol-code"
                />
              </div>
              <div>
                <Label>Protocol Name *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Standard Ortho Post-Op"
                  data-testid="input-protocol-name"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this follow-up protocol..."
                rows={2}
                data-testid="input-protocol-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Trigger On</Label>
                <Select value={formData.triggerOn} onValueChange={v => setFormData({ ...formData, triggerOn: v })}>
                  <SelectTrigger data-testid="select-trigger-on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Post Care">Post Care</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={v => setFormData({ ...formData, isDefault: v })}
                  data-testid="switch-is-default"
                />
                <Label className="text-sm">Default Protocol</Label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Follow-Up Steps</Label>
                <Button variant="outline" size="sm" onClick={addStep} data-testid="button-add-step">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, i) => (
                  <Card key={i} className="border-l-4 border-l-primary/30" data-testid={`card-step-${i}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="text-xs font-mono">Step {i + 1}</Badge>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, "up")} disabled={i === 0}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, "down")} disabled={i === steps.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(i)} disabled={steps.length <= 1}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Days After Discharge *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={step.daysAfterDischarge}
                            onChange={e => updateStep(i, "daysAfterDischarge", parseInt(e.target.value) || 1)}
                            data-testid={`input-days-${i}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Task Title *</Label>
                          <Input
                            value={step.taskTitle}
                            onChange={e => updateStep(i, "taskTitle", e.target.value)}
                            placeholder="e.g. Day 7 Follow-Up Call"
                            data-testid={`input-task-title-${i}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Priority</Label>
                          <Select value={step.priority} onValueChange={v => updateStep(i, "priority", v)}>
                            <SelectTrigger data-testid={`select-priority-${i}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">Assign To</Label>
                          <Select value={step.assigneeType} onValueChange={v => updateStep(i, "assigneeType", v)}>
                            <SelectTrigger data-testid={`select-assignee-type-${i}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PostCareOwner">Post-Care Owner (Doctor)</SelectItem>
                              <SelectItem value="Counsellor">Episode Counsellor</SelectItem>
                              <SelectItem value="RoundRobin">Round Robin by Role</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {step.assigneeType === "RoundRobin" && (
                          <div>
                            <Label className="text-xs">Role for Round Robin</Label>
                            <Select value={step.assigneeRoleCode} onValueChange={v => updateStep(i, "assigneeRoleCode", v)}>
                              <SelectTrigger data-testid={`select-role-code-${i}`}>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PATIENT_COORDINATOR">Patient Coordinator</SelectItem>
                                <SelectItem value="COUNSELLOR">Counsellor</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <Label className="text-xs">Task Description</Label>
                        <Input
                          value={step.taskDescription}
                          onChange={e => updateStep(i, "taskDescription", e.target.value)}
                          placeholder="Additional instructions for this follow-up..."
                          data-testid={`input-task-desc-${i}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-protocol"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingProtocol ? "Update Protocol" : "Create Protocol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent aria-describedby="delete-confirm-desc">
          <DialogHeader>
            <DialogTitle>Delete Protocol</DialogTitle>
            <p id="delete-confirm-desc" className="text-sm text-muted-foreground">
              Are you sure? This will permanently remove this protocol and all its steps. Existing post-care tasks already created will not be affected.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
