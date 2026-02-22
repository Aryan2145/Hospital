import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
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
import { Plus, Pencil, FileText, Calendar, IndianRupee, Loader2, Stethoscope, User } from "lucide-react";
import { format } from "date-fns";

interface Episode {
  id: number;
  tenantId: number;
  patientId: number;
  leadId: number | null;
  treatmentDepartmentId: number | null;
  treatmentSubDepartmentId: number | null;
  doctorId: number | null;
  branchId: number | null;
  episodeType: string | null;
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
  "Open": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "In Treatment": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Closed": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Cancelled": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function TransactionsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const [formPatientId, setFormPatientId] = useState("");
  const [formDoctorId, setFormDoctorId] = useState("");
  const [formEpisodeType, setFormEpisodeType] = useState("OPD");
  const [formStatus, setFormStatus] = useState("Open");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formDiagnosis, setFormDiagnosis] = useState("");
  const [formTreatmentPlan, setFormTreatmentPlan] = useState("");
  const [formEstimatedCost, setFormEstimatedCost] = useState("");
  const [formActualCost, setFormActualCost] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
  });

  const { data: patientsList } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });

  const { data: doctorsList } = useDoctors();

  const { data: treatmentDepts } = useQuery<any[]>({
    queryKey: ["/api/masters/treatmentDepartments"],
  });

  const patientMap = useMemo(() => {
    const map: Record<number, string> = {};
    patientsList?.forEach((p: any) => { map[p.id] = `${p.firstName || ""} ${p.lastName || ""}`.trim() || `Patient #${p.id}`; });
    return map;
  }, [patientsList]);

  const doctorMap = useMemo(() => {
    const map: Record<number, string> = {};
    doctorsList?.forEach((d: any) => { map[d.id] = d.name; });
    return map;
  }, [doctorsList]);

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
      toast({ title: "Consultation episode created" });
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
      toast({ title: "Consultation episode updated" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormPatientId("");
    setFormDoctorId("");
    setFormEpisodeType("OPD");
    setFormStatus("Open");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormDiagnosis("");
    setFormTreatmentPlan("");
    setFormEstimatedCost("");
    setFormActualCost("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEdit = (ep: Episode) => {
    setEditing(ep);
    setFormPatientId(String(ep.patientId));
    setFormDoctorId(ep.doctorId ? String(ep.doctorId) : "");
    setFormEpisodeType(ep.episodeType || "OPD");
    setFormStatus(ep.status);
    setFormStartDate(ep.startDate ? ep.startDate.split("T")[0] : "");
    setFormEndDate(ep.endDate ? ep.endDate.split("T")[0] : "");
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
    if (!formPatientId) {
      toast({ title: "Patient is required", variant: "destructive" });
      return;
    }
    const data: any = {
      patientId: Number(formPatientId),
      episodeType: formEpisodeType,
      status: formStatus,
    };
    if (formDoctorId && formDoctorId !== "none") data.doctorId = Number(formDoctorId);
    if (formStartDate) data.startDate = formStartDate;
    if (formEndDate) data.endDate = formEndDate;
    if (formDiagnosis) data.diagnosis = formDiagnosis;
    if (formTreatmentPlan) data.treatmentPlan = formTreatmentPlan;
    if (formEstimatedCost) data.estimatedCost = Number(formEstimatedCost);
    if (formActualCost) data.actualCost = Number(formActualCost);
    if (formNotes) data.notes = formNotes;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-transactions-title">Consultation Episodes</h2>
              <p className="text-muted-foreground mt-1">Track patient consultation episodes — from first visit through treatment to completion.</p>
            </div>
            <Button onClick={openCreate} data-testid="button-create-episode">
              <Plus className="w-4 h-4 mr-2" />
              New Consultation Episode
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
                    { value: "Open", label: "Open" },
                    { value: "In Treatment", label: "In Treatment" },
                    { value: "Closed", label: "Closed" },
                    { value: "Cancelled", label: "Cancelled" },
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
            <LoadingSpinner text="Loading consultation episodes..." />
          ) : filteredEpisodes.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No consultation episodes found. Create one when a patient comes for consultation.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEpisodes.map((ep) => (
                <Card key={ep.id} className="p-4" data-testid={`card-episode-${ep.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_COLORS[ep.status] || "bg-gray-100 text-gray-700"}>
                          {ep.status}
                        </Badge>
                        <Badge variant="outline">{ep.episodeType || "OPD"}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="w-4 h-4" />
                          {patientMap[ep.patientId] || `Patient #${ep.patientId}`}
                        </span>
                        {ep.doctorId && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Stethoscope className="w-4 h-4" />
                            {doctorMap[ep.doctorId] || `Doctor #${ep.doctorId}`}
                          </span>
                        )}
                        {ep.startDate && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(ep.startDate), "MMM dd, yyyy")}
                            {ep.endDate && ` - ${format(new Date(ep.endDate), "MMM dd, yyyy")}`}
                          </span>
                        )}
                      </div>
                      {ep.diagnosis && <p className="text-xs text-muted-foreground">Diagnosis: {ep.diagnosis}</p>}
                      {(ep.estimatedCost != null || ep.actualCost != null) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {ep.estimatedCost != null && <span>Est: ₹{ep.estimatedCost.toLocaleString("en-IN")}</span>}
                          {ep.actualCost != null && <span>Actual: ₹{ep.actualCost.toLocaleString("en-IN")}</span>}
                        </div>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(ep)} data-testid={`button-edit-episode-${ep.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Consultation Episode" : "New Consultation Episode"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Patient *</Label>
                <SearchableSelect
                  value={formPatientId}
                  onValueChange={setFormPatientId}
                  disabled={!!editing}
                  options={(patientsList || []).map((p: any) => ({
                    value: String(p.id),
                    label: `${p.firstName} ${p.lastName}${p.phone ? ` (${p.phone})` : ""}`,
                  }))}
                  placeholder="Select patient"
                  data-testid="episode-select-patient"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Doctor</Label>
                <SearchableSelect
                  value={formDoctorId}
                  onValueChange={setFormDoctorId}
                  options={[
                    { value: "none", label: "None" },
                    ...(doctorsList || []).map((d: any) => ({
                      value: String(d.id),
                      label: d.name,
                    })),
                  ]}
                  placeholder="Select doctor (optional)"
                  data-testid="episode-select-doctor"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    ]}
                    placeholder="Select type"
                    data-testid="episode-select-type"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <SearchableSelect
                    value={formStatus}
                    onValueChange={setFormStatus}
                    options={[
                      { value: "Open", label: "Open" },
                      { value: "In Treatment", label: "In Treatment" },
                      { value: "Closed", label: "Closed" },
                      { value: "Cancelled", label: "Cancelled" },
                    ]}
                    placeholder="Select status"
                    data-testid="episode-select-status"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} data-testid="episode-input-start" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} data-testid="episode-input-end" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Diagnosis</Label>
                <Input value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)} placeholder="Diagnosis" data-testid="episode-input-diagnosis" />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Treatment Plan</Label>
                <Textarea value={formTreatmentPlan} onChange={(e) => setFormTreatmentPlan(e.target.value)} placeholder="Treatment plan..." rows={2} data-testid="episode-input-treatment" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Estimated Cost</Label>
                  <Input type="number" value={formEstimatedCost} onChange={(e) => setFormEstimatedCost(e.target.value)} placeholder="0" data-testid="episode-input-est-cost" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Actual Cost</Label>
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
                disabled={isPending || !formPatientId}
                data-testid="button-save-episode"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {editing ? "Update Episode" : "Create Consultation Episode"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
