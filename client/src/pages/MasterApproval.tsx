import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Database } from "lucide-react";
import { format } from "date-fns";

export default function MasterApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["/api/masters-pending"],
    queryFn: async () => {
      const res = await fetch("/api/masters-pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending items");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      const res = await fetch(`/api/masters/${tableName}/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
      toast({ title: "Item approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ tableName, id }: { tableName: string; id: number }) => {
      const res = await fetch(`/api/masters/${tableName}/${id}/reject`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters-pending"] });
      toast({ title: "Item rejected" });
    },
  });

  const formatTableName = (name: string) => {
    return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-approval-title">
            <Database className="w-5 h-5 text-primary" />
            Master Data Approval
          </h1>
          <p className="text-sm text-muted-foreground">Review and approve inline-created master data items</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading pending items...</div>
        ) : !pendingItems?.length ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending master data items to review.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{pendingItems.length} item(s) pending approval</p>
            {pendingItems.map((item: any) => (
              <Card key={`${item.tableName}-${item.id}`} className="p-4" data-testid={`card-approval-${item.tableName}-${item.id}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground text-sm">{item.name}</span>
                      <Badge variant="outline" className="text-[10px]">{formatTableName(item.tableName)}</Badge>
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                        <Clock className="w-2.5 h-2.5 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Code: {item.code}</span>
                      {item.createdAt && <span>Created {format(new Date(item.createdAt), "MMM d, h:mm a")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => approveMutation.mutate({ tableName: item.tableName, id: item.id })}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${item.tableName}-${item.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => rejectMutation.mutate({ tableName: item.tableName, id: item.id })}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-${item.tableName}-${item.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
