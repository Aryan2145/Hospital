import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDoctors } from "@/hooks/use-leads";
import { Plus, Pencil, FileText, Calendar, IndianRupee, Loader2, Stethoscope, User, UserCheck, Activity } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface Episode {
  id: number;
  tenantId: number;
  patientId: number;
  leadId: number | null;
  episodeName: string;
  treatmentDepartmentId: number | null;
  doctorId: number | null;
  branchId: number | null;
  episodeType: string | null;
  visitType: string | null;
  parentEpisodeId: number | null;
  visitNumber: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  insuranceClaimed: boolean | null;
  notes: string | null;
  createdAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  "Consultation Done": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Treatment Planning": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "Surgery Scheduled": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Surgery Done": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "In Treatment": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Post Care": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Follow Up": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Completed": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Discontinued": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const EPISODE_STATUSES = [
  "Consultation Done",
  "Treatment Planning",
  "Surgery Scheduled",
  "Surgery Done",
  "In Treatment",
  "Post Care",
  "Follow Up",
  "Completed",
  "Discontinued",
];

export default function TransactionsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const [formPatientId, setFormPatientId] = useState("");
  const [formDoctorId, setFormDoctorId] = useState("");
  const [formTreatmentDeptId, setFormTreatmentDeptId] = useState("");
  const [formEpisodeType, setFormEpisodeType] = useState("OPD");
  const [formVisitType, setFormVisitType] = useState("New");
  const [formParentEpisodeId, setFormParentEpisodeId] = useState("");
  const [formStatus, setFormStatus] = useState("Consultation Done");
  const [formDiagnosis, setFormDiagnosis] = useState("");
  const [formTreatmentPlan, setFormTreatmentPlan] = useState("");
  const [formEstimatedCost, setFormEstimatedCost] = useState("");
  const [formActualCost, setFormActualCost] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
    retry: 2,
    staleTime: 30000,
  });

  const { data: allLeads } = useQuery<any[]>({
    queryKey: ["/api/leads"],
    retry: 2,
    staleTime: 30000,
  });

  const { data: patientsList } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });

  const { data: doctorsList } = useDoctors();

  const { data: treatmentDepts } = useQuery<any[]>({
    queryKey: ["/api/masters/treatmentDepartments"],
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: checkedInToday = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments/checked-in-today"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/checked-in-today", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const leadMap = useMemo(() => {
    const map: Record<number, any> = {};
    allLeads?.forEach((l: any) => { map[l.id] = l; });
    return map;
  }, [allLeads]);

  const patientMap = useMemo(() => {
    const map: Record<number, any> = {};
    patientsList?.forEach((p: any) => {
      map[p.id] = {
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || `Patient #${p.id}`,
        phone: p.primaryPhone || "",
        ...p,
      };
    });
    return map;
  }, [patientsList]);

  const patientToLeadMap = useMemo(() => {
    const map: Record<number, any> = {};
    allLeads?.forEach((l: any) => {
      if (l.patientId) {
        map[l.patientId] = l;
      }
    });
    return map;
  }, [allLeads]);

  const doctorMap = useMemo(() => {
    const map: Record<number, string> = {};
    doctorsList?.forEach((d: any) => { map[d.id] = d.name; });
    return map;
  }, [doctorsList]);

  const treatmentDeptMap = useMemo(() => {
    const map: Record<number, string> = {};
    treatmentDepts?.forEach((d: any) => { map[d.id] = d.name; });
    return map;
  }, [treatmentDepts]);

  const filteredEpisodes = useMemo(() => {
    if (!episodes) return [];
    if (!filterStatus || filterStatus === "all") return episodes;
    return episodes.filter((e) => e.status === filterStatus);
  }, [episodes, filterStatus]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/episodes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Episode created successfully" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/episodes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({ title: "Episode updated successfully" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const selectedPatientLead = formPatientId ? patientToLeadMap[Number(formPatientId)] : null;

  const openCreate = () => {
    setEditing(null);
    setFormPatientId("");
    setFormDoctorId("");
    setFormTreatmentDeptId("");
    setFormEpisodeType("OPD");
    setFormVisitType("New");
    setFormParentEpisodeId("");
    setFormStatus("Consultation Done");
    setFormDiagnosis("");
    setFormTreatmentPlan("");
    setFormEstimatedCost("");
    setFormActualCost("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEdit = (ep: Episode) => {
    setEditing(ep);
    setFormPatientId(ep.patientId ? String(ep.patientId) : "");
    setFormDoctorId(ep.doctorId ? String(ep.doctorId) : "");
    setFormTreatmentDeptId(ep.treatmentDepartmentId ? String(ep.treatmentDepartmentId) : "");
    setFormEpisodeType(ep.episodeType || "OPD");
    setFormVisitType(ep.visitType || "New");
    setFormParentEpisodeId(ep.parentEpisodeId ? String(ep.parentEpisodeId) : "");
    setFormStatus(ep.status);
    setFormDiagnosis(ep.diagnosis || "");
    setFormTreatmentPlan(ep.treatmentPlan || "");
    setFormEstimatedCost(ep.estimatedCost != null ? String(ep.estimatedCost) : "");
    setFormActualCost(ep.actualCost != null ? String(ep.actualCost) : "");
    setFormNotes(ep.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    if (!editing && !formPatientId) {
      toast({ title: "Patient is required", variant: "destructive" });
      return;
    }
    if (!selectedPatientLead && !editing) {
      toast({ title: "No lead record found for this patient. The patient must have been converted from a lead first.", variant: "destructive" });
      return;
    }

    const data: any = {
      episodeType: formEpisodeType,
      visitType: formVisitType,
      status: formStatus,
    };
    if (formVisitType === "Follow Up" && formParentEpisodeId) {
      data.parentEpisodeId = Number(formParentEpisodeId);
    }
    if (formPatientId) data.patientId = Number(formPatientId);
    if (formTreatmentDeptId && formTreatmentDeptId !== "none") data.treatmentDepartmentId = Number(formTreatmentDeptId);
    else if (formTreatmentDeptId === "none") data.treatmentDepartmentId = null;
    if (formDoctorId && formDoctorId !== "none") data.doctorId = Number(formDoctorId);
    else if (formDoctorId === "none") data.doctorId = null;
    data.diagnosis = formDiagnosis || null;
    data.treatmentPlan = formTreatmentPlan || null;
    data.estimatedCost = formEstimatedCost ? Number(formEstimatedCost) : null;
    data.actualCost = formActualCost ? Number(formActualCost) : null;
    data.notes = formNotes || null;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-transactions-title">Consultation Episodes</h2>
              <p className="text-muted-foreground mt-1">Each episode tracks one treatment journey — from consultation through to completion.</p>
            </div>
            <Button onClick={openCreate} data-testid="button-create-episode">
              <Plus className="w-4 h-4 mr-2" />
              New Episode
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">Status</Label>
                <SearchableSelect
                  value={filterStatus}
                  onValueChange={setFilterStatus}
                  options={[
                    { value: "all", label: "All statuses" },
                    ...EPISODE_STATUSES.map((s) => ({ value: s, label: s })),
                  ]}
                  placeholder="All statuses"
                  data-testid="filter-episode-status"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setFilterStatus("")} data-testid="button-clear-episode-filters">
                Clear
              </Button>
            </div>
          </Card>

          {isLoading ? (
            <LoadingSpinner text="Loading episodes..." />
          ) : filteredEpisodes.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No episodes found. Create one when a patient completes their consultation.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEpisodes.map((ep) => {
                const patient = ep.patientId ? patientMap[ep.patientId] : null;
                const patientName = patient?.name || (ep.patientId ? `Patient #${ep.patientId}` : "Unlinked Patient");
                const lead = ep.leadId ? leadMap[ep.leadId] : null;
                const deptName = ep.treatmentDepartmentId ? treatmentDeptMap[ep.treatmentDepartmentId] : null;

                return (
                  <Card key={ep.id} className="p-4 hover:shadow-md transition-shadow" data-testid={`card-episode-${ep.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" data-testid={`text-episode-name-${ep.id}`}>
                            {ep.episodeName || `Episode #${ep.id}`}
                          </span>
                          <Badge className={STATUS_COLORS[ep.status] || "bg-gray-100 text-gray-700"} data-testid={`badge-episode-status-${ep.id}`}>
                            {ep.status}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-episode-type-${ep.id}`}>{ep.episodeType || "OPD"}</Badge>
                          <Badge variant="outline" className={ep.visitType === "Follow Up" ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]" : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"} data-testid={`badge-visit-type-${ep.id}`}>
                            {ep.visitType || "New"}{ep.visitNumber && ep.visitNumber > 1 ? ` #${ep.visitNumber}` : ""}
                          </Badge>
                          {deptName && <Badge variant="secondary" className="text-[10px]" data-testid={`badge-episode-dept-${ep.id}`}>{deptName}</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground" data-testid={`text-episode-patient-${ep.id}`}>
                            <User className="w-4 h-4" />
                            {patientName}
                          </span>
                          {ep.doctorId && (
                            <span className="flex items-center gap-1 text-muted-foreground" data-testid={`text-episode-doctor-${ep.id}`}>
                              <Stethoscope className="w-4 h-4" />
                              {doctorMap[ep.doctorId] || `Doctor #${ep.doctorId}`}
                            </span>
                          )}
                          {ep.startDate && (
                            <span className="flex items-center gap-1 text-muted-foreground" data-testid={`text-episode-dates-${ep.id}`}>
                              <Calendar className="w-4 h-4" />
                              {format(new Date(ep.startDate), "MMM dd, yyyy")}
                              {ep.endDate && ` → ${format(new Date(ep.endDate), "MMM dd, yyyy")}`}
                            </span>
                          )}
                        </div>
                        {ep.diagnosis && <p className="text-xs text-muted-foreground" data-testid={`text-episode-diagnosis-${ep.id}`}>Diagnosis: {ep.diagnosis}</p>}
                        {(ep.estimatedCost != null || ep.actualCost != null) && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {ep.estimatedCost != null && <span>Est: ₹{ep.estimatedCost.toLocaleString("en-IN")}</span>}
                            {ep.actualCost != null && <span>Actual: ₹{ep.actualCost.toLocaleString("en-IN")}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`/episodes/${ep.id}`}>
                          <Button size="icon" variant="ghost" data-testid={`button-view-episode-${ep.id}`}>
                            <Activity className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(ep)} data-testid={`button-edit-episode-${ep.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Episode" : "New Episode"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Patient *</Label>
                <SearchableSelect
                  value={formPatientId}
                  onValueChange={setFormPatientId}
                  disabled={editing && !!editing.patientId}
                  options={(() => {
                    const checkedInPatientIds = new Set(checkedInToday.filter((a: any) => a.patient_id).map((a: any) => a.patient_id));
                    const activePatients = (patientsList || []).filter((p: any) => p.status === "Active");
                    const checkedInOptions = activePatients
                      .filter((p: any) => checkedInPatientIds.has(p.id))
                      .map((p: any) => ({
                        value: String(p.id),
                        label: `✓ ${`${p.firstName || ""} ${p.lastName || ""}`.trim()} (Checked In)` + (p.primaryPhone ? ` — ${p.primaryPhone}` : ""),
                      }));
                    const otherOptions = activePatients
                      .filter((p: any) => !checkedInPatientIds.has(p.id))
                      .map((p: any) => ({
                        value: String(p.id),
                        label: `${p.firstName || ""} ${p.lastName || ""}`.trim() + (p.primaryPhone ? ` (${p.primaryPhone})` : ""),
                      }));
                    return [...checkedInOptions, ...otherOptions];
                  })()}
                  placeholder="Search patient by name or phone..."
                  data-testid="episode-select-patient"
                />
                {editing && !!editing.patientId && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Patient cannot be changed once linked to an episode.</p>
                )}
                {editing && !editing.patientId && (
                  <p className="text-[10px] text-orange-600 mt-0.5">This episode has no patient linked. Select a patient to link it.</p>
                )}
                {formPatientId && selectedPatientLead && (
                  <div className="mt-1.5 p-2 rounded-md bg-muted/50 border text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <UserCheck className="w-3 h-3" />
                      <span>Lead: <strong>{selectedPatientLead.name}</strong></span>
                      <Badge variant="outline" className="text-[9px] h-4 ml-1">{selectedPatientLead.status}</Badge>
                    </div>
                  </div>
                )}
                {formPatientId && !selectedPatientLead && !editing && (
                  <div className="mt-1.5 p-2 rounded-md bg-destructive/5 border border-destructive/10 text-xs text-destructive">
                    No lead record linked to this patient. A lead must be converted to a patient first.
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Treatment Department *</Label>
                <SearchableSelect
                  value={formTreatmentDeptId}
                  onValueChange={setFormTreatmentDeptId}
                  options={[
                    { value: "none", label: "General" },
                    ...(treatmentDepts || [])
                      .filter((d: any) => d.status === "Active")
                      .map((d: any) => ({
                        value: String(d.id),
                        label: d.name,
                      })),
                  ]}
                  placeholder="e.g. Orthopaedics, Cardiology, Trauma..."
                  data-testid="episode-select-treatment-dept"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">This drives the episode name. E.g., "Raj Kumar_Orthopaedics"</p>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Doctor</Label>
                <SearchableSelect
                  value={formDoctorId}
                  onValueChange={setFormDoctorId}
                  options={[
                    { value: "none", label: "None" },
                    ...(doctorsList || [])
                      .filter((d: any) => d.status === "Active")
                      .map((d: any) => ({
                        value: String(d.id),
                        label: d.name,
                      })),
                  ]}
                  placeholder="Select doctor (optional)"
                  data-testid="episode-select-doctor"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                  <SearchableSelect
                    value={formEpisodeType}
                    onValueChange={setFormEpisodeType}
                    options={[
                      { value: "OPD", label: "OPD" },
                      { value: "IPD", label: "IPD" },
                      { value: "Surgery", label: "Surgery" },
                      { value: "Emergency", label: "Emergency" },
                      { value: "Day Care", label: "Day Care" },
                    ]}
                    placeholder="Select type"
                    data-testid="episode-select-type"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Visit</Label>
                  <SearchableSelect
                    value={formVisitType}
                    onValueChange={(v) => {
                      setFormVisitType(v);
                      if (v === "New") setFormParentEpisodeId("");
                    }}
                    options={[
                      { value: "New", label: "New" },
                      { value: "Follow Up", label: "Follow Up" },
                    ]}
                    placeholder="Select visit type"
                    data-testid="episode-select-visit-type"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <SearchableSelect
                    value={formStatus}
                    onValueChange={setFormStatus}
                    options={EPISODE_STATUSES.map((s) => ({ value: s, label: s }))}
                    placeholder="Select status"
                    data-testid="episode-select-status"
                  />
                </div>
              </div>

              {formVisitType === "Follow Up" && formPatientId && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Parent Episode (Follow-up of)</Label>
                  <SearchableSelect
                    value={formParentEpisodeId}
                    onValueChange={setFormParentEpisodeId}
                    options={(episodes || [])
                      .filter((ep) => ep.patientId === Number(formPatientId))
                      .map((ep) => ({ value: String(ep.id), label: `${ep.episodeName} (${ep.status})` }))}
                    placeholder="Select parent episode"
                    data-testid="episode-select-parent"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Diagnosis</Label>
                <Input value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)} placeholder="e.g. ACL tear, Right knee" data-testid="episode-input-diagnosis" />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Treatment Plan</Label>
                <Textarea value={formTreatmentPlan} onChange={(e) => setFormTreatmentPlan(e.target.value)} placeholder="Treatment plan details..." rows={2} data-testid="episode-input-treatment" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Estimated Cost (₹)</Label>
                  <Input type="number" value={formEstimatedCost} onChange={(e) => setFormEstimatedCost(e.target.value)} placeholder="0" data-testid="episode-input-est-cost" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Actual Cost (₹)</Label>
                  <Input type="number" value={formActualCost} onChange={(e) => setFormActualCost(e.target.value)} placeholder="0" data-testid="episode-input-actual-cost" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notes..." rows={2} data-testid="episode-input-notes" />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={isPending || (!editing && (!formPatientId || !selectedPatientLead))}
                data-testid="button-save-episode"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {editing ? "Update Episode" : "Create Episode"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
