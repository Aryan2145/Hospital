import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getStatusColor } from "@/lib/lead-status";
import { fmtDate } from "@/lib/date-utils";
import { GitMerge, Check, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MergeLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateLeads: any[];
  mobileNumber: string;
}

export function MergeLeadsModal({ open, onOpenChange, duplicateLeads, mobileNumber }: MergeLeadsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [primaryLeadId, setPrimaryLeadId] = useState<number | null>(null);
  const [selectedMergeIds, setSelectedMergeIds] = useState<number[]>([]);
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, number>>({});
  const [mergeNotes, setMergeNotes] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (open && duplicateLeads.length > 0) {
      setStep(1);
      setPrimaryLeadId(null);
      setSelectedMergeIds([]);
      setFieldDecisions({});
      setMergeNotes("");
      setConfirmation("");
    }
  }, [open, duplicateLeads]);

  const mergeIds = selectedMergeIds.filter(id => id !== primaryLeadId);

  const { data: previewData, isLoading: previewLoading, isError: previewError } = useQuery<any>({
    queryKey: ["/api/leads", primaryLeadId, "merge-preview", mergeIds.join(",")],
    queryFn: async () => {
      if (!primaryLeadId || mergeIds.length === 0) return null;
      const res = await fetch(`/api/leads/${primaryLeadId}/merge-preview?with=${mergeIds.join(",")}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load merge preview");
      }
      return res.json();
    },
    enabled: step >= 3 && !!primaryLeadId && mergeIds.length > 0,
    retry: 1,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leads/merge", {
        primaryLeadId,
        mergedLeadIds: mergeIds,
        fieldDecisions,
        notes: mergeNotes || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Leads merged successfully", description: `${mergeIds.length} lead(s) merged into Lead #${primaryLeadId}. ${Object.values(data.movedRecordCounts || {}).reduce((s: number, v: any) => s + Number(v), 0)} records moved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/duplicates"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Merge failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const FIELD_LABELS: Record<string, string> = {
    name: "Name", email: "Email", status: "Status", notes: "Notes", tags: "Tags",
    address: "Address", pinCode: "Pin Code", leadSourceId: "Lead Source", campaignId: "Campaign",
    assignedCrmUserId: "Assigned To", doctorId: "Doctor", treatmentDepartmentId: "Department",
    utmSource: "UTM Source", utmMedium: "UTM Medium", utmCampaign: "UTM Campaign",
    gender: "Gender", dateOfBirth: "Date of Birth", bloodGroup: "Blood Group",
    insuranceProvider: "Insurance Provider", insurancePolicyNumber: "Policy Number",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="merge-leads-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Merge Duplicate Leads
          </DialogTitle>
          <DialogDescription>
            {mobileNumber && `Duplicates found for ${mobileNumber}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn("flex items-center gap-1", s <= step ? "text-primary" : "text-muted-foreground")}>
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                s < step ? "bg-primary text-white border-primary" :
                s === step ? "border-primary text-primary" : "border-muted-foreground/30"
              )}>
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              <span className="text-xs hidden sm:inline">
                {s === 1 ? "Primary" : s === 2 ? "Select" : s === 3 ? "Fields" : "Confirm"}
              </span>
              {s < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select the primary lead to keep. All data will be merged into this lead.</p>
            {duplicateLeads.map((lead: any) => (
              <div
                key={lead.id}
                onClick={() => setPrimaryLeadId(lead.id)}
                className={cn(
                  "p-3 border rounded-lg cursor-pointer transition-colors",
                  primaryLeadId === lead.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                )}
                data-testid={`select-primary-lead-${lead.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">#{lead.id}</span>
                  </div>
                  <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{lead.phone_e164 || lead.phoneE164 || lead.phone}</span>
                  {lead.email && <span>{lead.email}</span>}
                  <span>Created {(lead.created_at || lead.createdAt) ? fmtDate(lead.created_at || lead.createdAt) : "—"}</span>
                  {(lead.assigned_to_name || lead.assignedToName) && <span>Assigned to {lead.assigned_to_name || lead.assignedToName}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select the duplicate leads to merge into the primary lead.</p>
            {duplicateLeads.filter(l => l.id !== primaryLeadId).map((lead: any) => {
              const isSelected = selectedMergeIds.includes(lead.id);
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setSelectedMergeIds(prev =>
                      isSelected ? prev.filter(id => id !== lead.id) : [...prev, lead.id]
                    );
                  }}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3",
                    isSelected ? "border-orange-500 bg-orange-50" : "hover:border-muted-foreground/50"
                  )}
                  data-testid={`select-merge-lead-${lead.id}`}
                >
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                    isSelected ? "border-orange-500 bg-orange-500" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{lead.name} <span className="text-xs text-muted-foreground">#{lead.id}</span></span>
                      <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{lead.phone_e164 || lead.phoneE164 || lead.phone}</span>
                      {lead.email && <span>{lead.email}</span>}
                      <span>Created {(lead.created_at || lead.createdAt) ? fmtDate(lead.created_at || lead.createdAt) : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review field conflicts. Choose which value to keep for each field.</p>

            {previewLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm">Loading merge preview...</span>
              </div>
            )}

            {previewError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Failed to load merge preview. Please go back and try again.
              </div>
            )}

            {previewData?.fieldComparison && Object.entries(previewData.fieldComparison).map(([field, values]: [string, any]) => {
              const uniqueValues = Object.entries(values).filter(([, v]) => v != null);
              const distinctValues = new Set(uniqueValues.map(([, v]) => String(v)));
              if (distinctValues.size <= 1) return null;

              return (
                <div key={field} className="border rounded-lg p-3">
                  <Label className="text-sm font-medium">{FIELD_LABELS[field] || field}</Label>
                  <div className="mt-2 space-y-1">
                    {uniqueValues.map(([leadId, value]: [string, any]) => {
                      const isPrimary = Number(leadId) === primaryLeadId;
                      const isSelected = fieldDecisions[field] === Number(leadId) || (!fieldDecisions[field] && isPrimary);
                      return (
                        <div
                          key={leadId}
                          onClick={() => setFieldDecisions(prev => ({ ...prev, [field]: Number(leadId) }))}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded cursor-pointer text-sm",
                            isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                          )}
                          data-testid={`field-choice-${field}-${leadId}`}
                        >
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            isSelected ? "border-primary" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <span className="flex-1 truncate">{String(value)}</span>
                          {isPrimary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                          <span className="text-xs text-muted-foreground">Lead #{leadId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {previewData?.recordCounts && (
              <div className="border rounded-lg p-3">
                <Label className="text-sm font-medium">Records to be moved</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mergeIds.map(mid => {
                    const counts = previewData.recordCounts[mid];
                    if (!counts) return null;
                    const total = Object.values(counts).reduce((s: number, v: any) => s + Number(v), 0);
                    if (total === 0) return null;
                    return (
                      <div key={mid} className="text-xs text-muted-foreground">
                        <span className="font-medium">Lead #{mid}:</span>{" "}
                        {Object.entries(counts)
                          .filter(([, v]) => Number(v) > 0)
                          .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
                          .join(", ")}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm">Merge Notes (optional)</Label>
              <Textarea
                value={mergeNotes}
                onChange={e => setMergeNotes(e.target.value)}
                placeholder="Reason for merging..."
                className="mt-1"
                data-testid="textarea-merge-notes"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Confirm Merge</p>
                  <p className="text-sm text-amber-700 mt-1">
                    This will merge {mergeIds.length} lead(s) into Lead #{primaryLeadId}.
                    Merged leads will be archived (not deleted). All related records (activities, tasks, episodes, appointments, call logs) will be moved to the primary lead.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Type MERGE to confirm</Label>
              <Input
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder="Type MERGE"
                className="mt-1"
                data-testid="input-merge-confirmation"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-4">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-merge-back">
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-merge-cancel">
              Cancel
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !primaryLeadId) ||
                  (step === 2 && selectedMergeIds.length === 0) ||
                  (step === 3 && (previewLoading || previewError))
                }
                data-testid="button-merge-next"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={confirmation !== "MERGE" || mergeMutation.isPending}
                variant="destructive"
                data-testid="button-merge-confirm"
              >
                {mergeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Merging...</>
                ) : (
                  <><GitMerge className="h-4 w-4 mr-2" /> Merge Leads</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
