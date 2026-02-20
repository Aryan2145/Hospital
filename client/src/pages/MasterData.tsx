import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MASTER_CATEGORIES } from "@shared/routes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  Database,
  ArrowLeft,
} from "lucide-react";

interface MasterRecord {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  status: string;
  displayOrder: number | null;
  [key: string]: any;
}

export default function MasterData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTableLabel, setSelectedTableLabel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", status: "Active", displayOrder: 0 });

  const { data: records = [], isLoading } = useQuery<MasterRecord[]>({
    queryKey: ["/api/masters", selectedTable],
    queryFn: async () => {
      if (!selectedTable) return [];
      const res = await fetch(`/api/masters/${selectedTable}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/masters/${selectedTable}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/masters/${selectedTable}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record updated successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/masters/${selectedTable}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/masters", selectedTable] });
      toast({ title: "Record deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormData({ code: "", name: "", status: "Active", displayOrder: 0 });
    setEditingRecord(null);
  }

  function handleEdit(record: MasterRecord) {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      status: record.status,
      displayOrder: record.displayOrder ?? 0,
    });
    setIsDialogOpen(true);
  }

  function handleSubmit() {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  const filteredRecords = records.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCategoryData = MASTER_CATEGORIES.find((c) => c.category === selectedCategory);

  return (
    <div className="flex h-screen w-full" data-testid="master-data-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-4 border-b bg-card">
          <div className="flex items-center gap-2 flex-wrap">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Master Data Management</h1>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{selectedCategory}</span>
              </>
            )}
            {selectedTableLabel && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedTableLabel}</span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {!selectedCategory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MASTER_CATEGORIES.map((cat) => (
                <Card
                  key={cat.category}
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => setSelectedCategory(cat.category)}
                  data-testid={`card-category-${cat.category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <h3 className="font-semibold mb-2">{cat.category}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {cat.tables.length} master table{cat.tables.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cat.tables.slice(0, 3).map((t) => (
                      <Badge key={t.key} variant="secondary" className="text-xs">
                        {t.label}
                      </Badge>
                    ))}
                    {cat.tables.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{cat.tables.length - 3} more
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : !selectedTable ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => setSelectedCategory(null)}
                className="mb-4"
                data-testid="button-back-categories"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCategoryData?.tables.map((tbl) => (
                  <Card
                    key={tbl.key}
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedTable(tbl.key);
                      setSelectedTableLabel(tbl.label);
                    }}
                    data-testid={`card-table-${tbl.key}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{tbl.label}</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedTable(null);
                    setSelectedTableLabel("");
                    setSearchTerm("");
                  }}
                  data-testid="button-back-tables"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-master"
                  />
                </div>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  data-testid="button-add-record"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedTableLabel}
                </Button>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No records found. Click "Add" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id} data-testid={`row-master-${record.id}`}>
                          <TableCell className="font-mono text-sm">{record.code}</TableCell>
                          <TableCell>{record.name}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "Active" ? "default" : "secondary"}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.displayOrder ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(record)}
                                data-testid={`button-edit-${record.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this record?")) {
                                    deleteMutation.mutate(record.id);
                                  }
                                }}
                                data-testid={`button-delete-${record.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingRecord ? "Edit" : "Add"} {selectedTableLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. ORTHO"
                data-testid="input-code"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Orthopaedics"
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Display Order</label>
              <Input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-display-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
