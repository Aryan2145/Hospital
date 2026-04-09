import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ExternalLink, Trash2, Pencil, Image, Film, FileText,
  Globe, ClipboardList, Link2, Video, Mail, BookOpen,
} from "lucide-react";

type ResourceLink = {
  id: number;
  tenantId: number;
  entityType: string;
  entityId: number;
  linkType: string;
  label: string | null;
  url: string;
  displayOrder: number | null;
  createdBy: string | null;
  createdAt: string | null;
};

const CAMPAIGN_LINK_TYPES = [
  { value: "Poster", label: "Poster" },
  { value: "Reel", label: "Reel" },
  { value: "Video", label: "Video" },
  { value: "Ad Creative", label: "Ad Creative" },
  { value: "Landing Page", label: "Landing Page" },
  { value: "Other", label: "Other" },
];

const EVENT_LINK_TYPES = [
  { value: "Registration Form", label: "Registration Form" },
  { value: "Landing Page", label: "Landing Page" },
  { value: "Poster", label: "Poster" },
  { value: "Invitation", label: "Invitation" },
  { value: "Brochure", label: "Brochure" },
  { value: "Video", label: "Video" },
  { value: "Other", label: "Other" },
];

function getLinkIcon(linkType: string) {
  switch (linkType) {
    case "Poster": return <Image className="h-4 w-4" />;
    case "Reel": return <Film className="h-4 w-4" />;
    case "Video": return <Video className="h-4 w-4" />;
    case "Ad Creative": return <FileText className="h-4 w-4" />;
    case "Landing Page": return <Globe className="h-4 w-4" />;
    case "Registration Form": return <ClipboardList className="h-4 w-4" />;
    case "Invitation": return <Mail className="h-4 w-4" />;
    case "Brochure": return <BookOpen className="h-4 w-4" />;
    default: return <Link2 className="h-4 w-4" />;
  }
}

function getLinkColor(linkType: string) {
  switch (linkType) {
    case "Poster": return "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300";
    case "Reel": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300";
    case "Video": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300";
    case "Ad Creative": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300";
    case "Landing Page": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300";
    case "Registration Form": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300";
    case "Invitation": return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300";
    case "Brochure": return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300";
    default: return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-300";
  }
}

function safeOpenUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {}
}

interface ResourceLinksSectionProps {
  entityType: "campaign" | "event";
  entityId: number;
  compact?: boolean;
}

export function ResourceLinksSection({ entityType, entityId, compact }: ResourceLinksSectionProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formLinkType, setFormLinkType] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const linkTypes = entityType === "campaign" ? CAMPAIGN_LINK_TYPES : EVENT_LINK_TYPES;
  const sectionLabel = entityType === "campaign" ? "Creatives" : "Resources";
  const apiPath = entityType === "campaign" ? `/api/campaigns/${entityId}/links` : `/api/events/${entityId}/links`;

  const { data: links = [], isLoading } = useQuery<ResourceLink[]>({
    queryKey: [apiPath],
    enabled: !!entityId,
  });

  const saveMutation = useMutation({
    mutationFn: async (linksData: { linkType: string; label: string | null; url: string }[]) => {
      const res = await apiRequest("POST", apiPath, linksData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPath] });
      toast({ title: `${sectionLabel} saved` });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", apiPath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPath] });
    },
  });

  function openAdd() {
    setEditingIndex(null);
    setFormLinkType(linkTypes[0].value);
    setFormLabel("");
    setFormUrl("");
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    const link = links[index];
    setEditingIndex(index);
    setFormLinkType(link.linkType);
    setFormLabel(link.label || "");
    setFormUrl(link.url);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingIndex(null);
  }

  function handleSave() {
    if (!formUrl.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    try {
      const parsed = new URL(formUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        toast({ title: "URL must start with http:// or https://", variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: "Invalid URL format", variant: "destructive" });
      return;
    }

    const newLink = { linkType: formLinkType, label: formLabel || null, url: formUrl };
    let updatedLinks: { linkType: string; label: string | null; url: string }[];

    if (editingIndex !== null) {
      updatedLinks = links.map((l, i) => i === editingIndex ? newLink : { linkType: l.linkType, label: l.label, url: l.url });
    } else {
      updatedLinks = [...links.map(l => ({ linkType: l.linkType, label: l.label, url: l.url })), newLink];
    }
    saveMutation.mutate(updatedLinks);
  }

  function handleDelete(index: number) {
    if (!confirm("Remove this link?")) return;
    const updatedLinks = links.filter((_, i) => i !== index).map(l => ({ linkType: l.linkType, label: l.label, url: l.url }));
    if (updatedLinks.length === 0) {
      deleteMutation.mutate();
    } else {
      saveMutation.mutate(updatedLinks);
    }
  }

  return (
    <div data-testid={`resource-links-${entityType}-${entityId}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {sectionLabel}
          {links.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{links.length}</Badge>}
        </p>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openAdd} data-testid={`button-add-link-${entityType}-${entityId}`}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No {sectionLabel.toLowerCase()} added yet.</p>
      ) : (
        <div className={compact ? "flex flex-wrap gap-1.5" : "space-y-1.5"}>
          {links.map((link, index) => (
            compact ? (
              <button
                key={link.id || index}
                onClick={() => safeOpenUrl(link.url)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${getLinkColor(link.linkType)} hover:opacity-80 transition-opacity cursor-pointer`}
                data-testid={`link-chip-${link.id || index}`}
              >
                {getLinkIcon(link.linkType)}
                <span>{link.label || link.linkType}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </button>
            ) : (
              <div
                key={link.id || index}
                className="flex items-center gap-2 group rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                data-testid={`link-row-${link.id || index}`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md ${getLinkColor(link.linkType)}`}>
                  {getLinkIcon(link.linkType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{link.label || link.linkType}</span>
                    <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-md"
                    data-testid={`link-url-${link.id || index}`}
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => safeOpenUrl(link.url)} data-testid={`button-open-link-${link.id || index}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(index)} data-testid={`button-edit-link-${link.id || index}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(index)}
                    data-testid={`button-delete-link-${link.id || index}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md" aria-describedby="resource-link-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-link-dialog-title">
              {editingIndex !== null ? `Edit ${sectionLabel.slice(0, -1)}` : `Add ${sectionLabel.slice(0, -1)}`}
            </DialogTitle>
            <p id="resource-link-dialog-desc" className="text-sm text-muted-foreground">
              Add a Google Drive or external URL
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={formLinkType} onValueChange={setFormLinkType}>
                <SelectTrigger data-testid="select-link-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {linkTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={entityType === "campaign" ? "e.g. Main Poster v2" : "e.g. Event Registration Link"}
                data-testid="input-link-label"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                data-testid="input-link-url"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-link">Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-link">
              {saveMutation.isPending ? "Saving..." : editingIndex !== null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ResourceLinksInlineEditorProps {
  entityType: "campaign" | "event";
  links: { linkType: string; label: string; url: string }[];
  onChange: (links: { linkType: string; label: string; url: string }[]) => void;
}

export function ResourceLinksInlineEditor({ entityType, links, onChange }: ResourceLinksInlineEditorProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formLinkType, setFormLinkType] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const linkTypes = entityType === "campaign" ? CAMPAIGN_LINK_TYPES : EVENT_LINK_TYPES;
  const sectionLabel = entityType === "campaign" ? "Creatives" : "Resources";

  function openAdd() {
    setEditingIndex(null);
    setFormLinkType(linkTypes[0].value);
    setFormLabel("");
    setFormUrl("");
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setFormLinkType(links[index].linkType);
    setFormLabel(links[index].label);
    setFormUrl(links[index].url);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formUrl.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    try {
      const parsed = new URL(formUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        toast({ title: "URL must start with http:// or https://", variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: "Invalid URL format", variant: "destructive" });
      return;
    }

    const newLink = { linkType: formLinkType, label: formLabel, url: formUrl };
    if (editingIndex !== null) {
      const updated = [...links];
      updated[editingIndex] = newLink;
      onChange(updated);
    } else {
      onChange([...links, newLink]);
    }
    setDialogOpen(false);
    setEditingIndex(null);
  }

  function handleRemove(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  return (
    <div data-testid={`inline-links-${entityType}`}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {sectionLabel}
          {links.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{links.length}</Badge>}
        </Label>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={openAdd} data-testid={`button-inline-add-link`}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No {sectionLabel.toLowerCase()} added.</p>
      ) : (
        <div className="space-y-1">
          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
              <div className={`flex items-center justify-center w-6 h-6 rounded ${getLinkColor(link.linkType)}`}>
                {getLinkIcon(link.linkType)}
              </div>
              <span className="font-medium truncate flex-1">{link.label || link.linkType}</span>
              <span className="text-muted-foreground truncate max-w-[200px]">{link.url}</span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(index)} data-testid={`button-inline-edit-${index}`}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleRemove(index)} data-testid={`button-inline-remove-${index}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingIndex(null); } }}>
        <DialogContent className="max-w-md" aria-describedby="inline-link-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? `Edit ${sectionLabel.slice(0, -1)}` : `Add ${sectionLabel.slice(0, -1)}`}</DialogTitle>
            <p id="inline-link-dialog-desc" className="text-sm text-muted-foreground">Add a Google Drive or external URL</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={formLinkType} onValueChange={setFormLinkType}>
                <SelectTrigger data-testid="select-inline-link-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {linkTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g. Main Poster v2" data-testid="input-inline-link-label" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." data-testid="input-inline-link-url" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingIndex(null); }}>Cancel</Button>
            <Button type="button" onClick={handleSave} data-testid="button-inline-save-link">
              {editingIndex !== null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
