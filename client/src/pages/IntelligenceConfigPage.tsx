import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Thermometer,
  TrendingUp,
  AlertTriangle,
  Save,
  Settings2,
  Percent,
  ArrowRight,
} from "lucide-react";

const TEMPERATURE_RULES = [
  { event: "Appointment Booked", impact: "→ Warm", description: "Lead books their first appointment" },
  { event: "Rescheduled Once", impact: "No change", description: "Single reschedule, normal behavior" },
  { event: "Rescheduled 2+ times", impact: "↓ Downgrade 1 level", description: "Multiple reschedules indicate dropping interest" },
  { event: "No Show", impact: "↓ Downgrade 1 level", description: "Patient did not attend appointment" },
  { event: "Consultation Done", impact: "→ Warm+", description: "Doctor consultation completed" },
  { event: "Estimate Shared", impact: "→ Warm++", description: "Treatment estimate shared with patient" },
  { event: "Insurance Approved", impact: "→ Hot", description: "Insurance pre-authorization approved" },
  { event: "Advance Received", impact: "→ Very Hot", description: "Patient made advance payment" },
  { event: "No activity > 7 days", impact: "→ Dormant", description: "Lead goes cold without any interaction" },
];

const ESCALATION_RULES = [
  { trigger: "No Show", action: "Auto-create follow-up task", timing: "Immediate", severity: "Normal" },
  { trigger: "2nd No Show", action: "Escalate to supervisor", timing: "Immediate", severity: "Urgent" },
  { trigger: "Consultation done, no planning in 48hrs", action: "Alert manager", timing: "48 hours", severity: "High" },
  { trigger: "Insurance pending > 24hrs", action: "Escalate to insurance desk", timing: "24 hours", severity: "High" },
  { trigger: "Lead dormant > 7 days", action: "Mark as Dormant", timing: "Daily check", severity: "Normal" },
  { trigger: "Estimate shared, no response in 72hrs", action: "Follow-up task", timing: "72 hours", severity: "Normal" },
];

const TEMP_COLORS: Record<string, string> = {
  "Cold": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "Warm": "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  "Warm+": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "Warm++": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "Hot": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  "Very Hot": "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200",
  "Dormant": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export default function IntelligenceConfigPage() {
  const { toast } = useToast();

  const { data: probabilityConfigs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/revenue-probability-config"],
  });

  const [editedProbabilities, setEditedProbabilities] = useState<Record<number, number>>({});

  const updateProbability = useMutation({
    mutationFn: async ({ id, probability }: { id: number; probability: number }) => {
      await apiRequest("PATCH", `/api/revenue-probability-config/${id}`, { probability });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-probability-config"] });
      toast({ title: "Probability updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSaveProbabilities = () => {
    Object.entries(editedProbabilities).forEach(([id, prob]) => {
      updateProbability.mutate({ id: Number(id), probability: prob });
    });
    setEditedProbabilities({});
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading configuration..." />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground" data-testid="text-page-title">Intelligence Configuration</h1>
            <p className="text-xs text-muted-foreground">Temperature rules, escalation triggers, and revenue probability mapping</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card className="p-5" data-testid="card-temperature-rules">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Temperature Rules</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Lead temperature is automatically computed based on these events. Temperature levels: Cold → Warm → Warm+ → Warm++ → Hot → Very Hot | Dormant
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {Object.entries(TEMP_COLORS).map(([temp, cls]) => (
              <Badge key={temp} className={`text-[10px] ${cls}`}>{temp}</Badge>
            ))}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Event / Trigger</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Temperature Impact</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {TEMPERATURE_RULES.map((rule, idx) => (
                  <tr key={idx} className="border-t border-border" data-testid={`temp-rule-${idx}`}>
                    <td className="p-2.5 font-medium text-foreground">{rule.event}</td>
                    <td className="p-2.5">
                      <span className={`inline-flex items-center gap-1 ${rule.impact.startsWith("↓") ? "text-red-600" : rule.impact === "No change" ? "text-muted-foreground" : "text-green-600"}`}>
                        {rule.impact}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground hidden md:table-cell">{rule.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5" data-testid="card-revenue-probability">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Revenue Probability Mapping</h2>
            </div>
            {Object.keys(editedProbabilities).length > 0 && (
              <Button size="sm" onClick={handleSaveProbabilities} disabled={updateProbability.isPending} data-testid="button-save-probabilities">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Changes
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Map each clinical stage or milestone to a revenue conversion probability. This drives the Revenue Forecast on the dashboard.
          </p>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Stage / Milestone</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-32">Probability %</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-24 hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {probabilityConfigs.map((config: any) => {
                  const editedValue = editedProbabilities[config.id];
                  const currentValue = editedValue !== undefined ? editedValue : config.probability;
                  return (
                    <tr key={config.id} className="border-t border-border" data-testid={`prob-config-${config.id}`}>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{config.stageName}</span>
                          {editedValue !== undefined && (
                            <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">Modified</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={currentValue}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val <= 100) {
                                setEditedProbabilities(prev => ({ ...prev, [config.id]: val }));
                              }
                            }}
                            className="w-20 h-7 text-xs"
                            data-testid={`input-probability-${config.id}`}
                          />
                          <Percent className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </td>
                      <td className="p-2.5 hidden md:table-cell">
                        <Badge variant={config.status === "Active" ? "default" : "secondary"} className="text-[10px]">
                          {config.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5" data-testid="card-escalation-rules">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Escalation Rules</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Automated escalation triggers that create tasks and alerts based on patient journey events.
          </p>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Trigger</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Timing</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground w-24">Severity</th>
                </tr>
              </thead>
              <tbody>
                {ESCALATION_RULES.map((rule, idx) => (
                  <tr key={idx} className="border-t border-border" data-testid={`escalation-rule-${idx}`}>
                    <td className="p-2.5 font-medium text-foreground">{rule.trigger}</td>
                    <td className="p-2.5 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {rule.action}
                      </div>
                    </td>
                    <td className="p-2.5 text-muted-foreground hidden md:table-cell">{rule.timing}</td>
                    <td className="p-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          rule.severity === "Urgent" ? "border-red-300 text-red-600" :
                          rule.severity === "High" ? "border-amber-300 text-amber-600" :
                          "border-gray-300 text-gray-600"
                        }`}
                      >
                        {rule.severity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
