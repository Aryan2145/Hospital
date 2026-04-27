import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Plus, Pencil, Megaphone, Calendar, IndianRupee, Loader2,
  Link2, Copy, Eye, Target, TrendingUp, MousePointerClick,
  ExternalLink, Zap, BarChart3, RefreshCw, CheckCircle2,
} from "lucide-react";
import { fmtDate } from "@/lib/date-utils";
import { ResourceLinksSection, ResourceLinksInlineEditor } from "@/components/ResourceLinksSection";
import { SiFacebook } from "react-icons/si";

interface Campaign {
  id: number;
  tenantId: number;
  name: string;
  companyPrefix: string | null;
  platform: string | null;
  objective: string | null;
  year: string | null;
  month: string | null;
  adNumber: string | null;
  funnelStage: string | null;
  channel: string | null;
  targetAudience: string | null;
  description: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  connectorId: number | null;
  metaCampaignId: string | null;
  metaCampaignName: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

interface MetaCampaignOption {
  id: string;
  name: string;
  status: string;
  objective: string;
  impressions: number;
  clicks: number;
  spend: number;
}

interface MetaInsights {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  reach: number;
  conversions: number;
}

interface UtmFunnelRow {
  utmCampaign: string;
  utmSource: string | null;
  utmMedium: string | null;
  leads: number;
  appointments: number;
  episodes: number;
  treatmentStarted: number;
  surgeryDone: number;
  revenue: number;
}

const PLATFORMS = [
  { value: "Meta", label: "Meta (Facebook/Instagram)" },
  { value: "Google", label: "Google Ads" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "X", label: "X (Twitter)" },
  { value: "YouTube", label: "YouTube" },
  { value: "Microsoft", label: "Microsoft Ads (Bing)" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Offline", label: "Offline" },
  { value: "Other", label: "Other" },
];

const OBJECTIVES = [
  { value: "Awareness", label: "Awareness" },
  { value: "LeadGen", label: "Lead Generation" },
  { value: "Traffic", label: "Traffic" },
  { value: "Conversions", label: "Conversions" },
  { value: "Retargeting", label: "Retargeting" },
  { value: "Branding", label: "Branding" },
  { value: "Engagement", label: "Engagement" },
  { value: "AppInstalls", label: "App Installs" },
  { value: "VideoViews", label: "Video Views" },
  { value: "Reach", label: "Reach" },
];

const FUNNEL_STAGES = [
  { value: "TOFU", label: "TOFU (Top of Funnel)" },
  { value: "MOFU", label: "MOFU (Middle of Funnel)" },
  { value: "BOFU", label: "BOFU (Bottom of Funnel)" },
];

const MONTHS = [
  { value: "Jan", label: "January" }, { value: "Feb", label: "February" },
  { value: "Mar", label: "March" }, { value: "Apr", label: "April" },
  { value: "May", label: "May" }, { value: "Jun", label: "June" },
  { value: "Jul", label: "July" }, { value: "Aug", label: "August" },
  { value: "Sep", label: "September" }, { value: "Oct", label: "October" },
  { value: "Nov", label: "November" }, { value: "Dec", label: "December" },
];

const TARGET_AUDIENCES = [
  { value: "Cold", label: "Cold Audience" },
  { value: "Warm", label: "Warm Audience" },
  { value: "Hot", label: "Hot Audience (Retarget)" },
  { value: "Lookalike", label: "Lookalike Audience" },
  { value: "Custom", label: "Custom Audience" },
  { value: "Interest", label: "Interest Based" },
  { value: "Demographic", label: "Demographic" },
  { value: "Geographic", label: "Geographic" },
];

const PLATFORM_UTM_MAP: Record<string, { source: string; medium: string }> = {
  Meta: { source: "facebook", medium: "cpc" },
  Google: { source: "google", medium: "cpc" },
  LinkedIn: { source: "linkedin", medium: "cpc" },
  X: { source: "twitter", medium: "cpc" },
  YouTube: { source: "youtube", medium: "video" },
  Microsoft: { source: "bing", medium: "cpc" },
  WhatsApp: { source: "whatsapp", medium: "social" },
  Offline: { source: "offline", medium: "offline" },
  Other: { source: "other", medium: "referral" },
};

const PLATFORM_CHANNELS: Record<string, { value: string; label: string }[]> = {
  Meta: [
    { value: "Facebook Feed", label: "Facebook Feed" },
    { value: "Facebook Stories", label: "Facebook Stories" },
    { value: "Facebook Reels", label: "Facebook Reels" },
    { value: "Facebook Marketplace", label: "Facebook Marketplace" },
    { value: "Instagram Feed", label: "Instagram Feed" },
    { value: "Instagram Stories", label: "Instagram Stories" },
    { value: "Instagram Reels", label: "Instagram Reels" },
    { value: "Instagram Explore", label: "Instagram Explore" },
    { value: "Messenger", label: "Messenger" },
    { value: "Audience Network", label: "Audience Network" },
    { value: "Facebook Lead Forms", label: "Facebook Lead Forms" },
    { value: "Instagram Lead Forms", label: "Instagram Lead Forms" },
  ],
  Google: [
    { value: "Google Search", label: "Google Search" },
    { value: "Google Display", label: "Google Display Network" },
    { value: "Google Shopping", label: "Google Shopping" },
    { value: "Google Discovery", label: "Google Discovery" },
    { value: "Google Maps", label: "Google Maps" },
    { value: "Gmail Ads", label: "Gmail Ads" },
    { value: "Google Performance Max", label: "Performance Max" },
  ],
  LinkedIn: [
    { value: "LinkedIn Feed", label: "LinkedIn Feed" },
    { value: "LinkedIn Sponsored InMail", label: "Sponsored InMail" },
    { value: "LinkedIn Text Ads", label: "Text Ads" },
    { value: "LinkedIn Dynamic Ads", label: "Dynamic Ads" },
    { value: "LinkedIn Lead Gen Forms", label: "Lead Gen Forms" },
  ],
  X: [
    { value: "X Timeline", label: "Timeline" },
    { value: "X Search", label: "Search Results" },
    { value: "X Trends", label: "Trends" },
  ],
  YouTube: [
    { value: "YouTube Pre-roll", label: "Pre-roll (Skippable)" },
    { value: "YouTube Non-skip", label: "Non-skippable" },
    { value: "YouTube Bumper", label: "Bumper Ads (6 sec)" },
    { value: "YouTube Discovery", label: "Discovery Ads" },
    { value: "YouTube Shorts", label: "YouTube Shorts" },
  ],
  Microsoft: [
    { value: "Bing Search", label: "Bing Search" },
    { value: "Microsoft Audience", label: "Microsoft Audience Network" },
    { value: "Microsoft Shopping", label: "Microsoft Shopping" },
  ],
  WhatsApp: [
    { value: "WhatsApp Broadcast", label: "Broadcast Messages" },
    { value: "WhatsApp Click-to-Chat", label: "Click-to-Chat Ads" },
    { value: "WhatsApp Status", label: "Status / Stories" },
  ],
  Offline: [
    { value: "Print", label: "Print (Newspaper/Magazine)" },
    { value: "TV", label: "Television" },
    { value: "Radio", label: "Radio" },
    { value: "Hoarding", label: "Hoarding / Billboard" },
    { value: "Pamphlet", label: "Pamphlet / Flyer" },
    { value: "Event", label: "Event / Camp" },
    { value: "Referral", label: "Doctor Referral" },
    { value: "Walk-in", label: "Walk-in" },
  ],
  Other: [
    { value: "SMS", label: "SMS" },
    { value: "Email", label: "Email" },
    { value: "Website", label: "Website" },
    { value: "Blog", label: "Blog / Content" },
    { value: "Other", label: "Other" },
  ],
};

function generateYears(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = String(currentYear + i - 1);
    return { value: y, label: y };
  });
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

function UtmRow({ label, value, onCopy }: { label: string; value: string | null | undefined; onCopy: (v: string, l: string) => void }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm flex-1 truncate">{value}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onCopy(value, label)}>
        <Copy className="w-3 h-3" />
      </Button>
    </div>
  );
}

function InlineMetaCard({ metaCampaignId }: { metaCampaignId: string }) {
  const queryKey = ["/api/connectors/meta/campaigns", metaCampaignId, "insights"];
  const { data: insights, isLoading } = useQuery<MetaInsights>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/connectors/meta/campaigns/${metaCampaignId}/insights`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/connectors/meta/campaigns/${metaCampaignId}/insights?force=true`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => { queryClient.setQueryData(queryKey, data); },
  });

  if (isLoading) return <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching Meta metrics…</div>;
  if (!insights || Object.keys(insights).length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1"><SiFacebook className="w-2.5 h-2.5" /> Live Meta Metrics</span>
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); syncMutation.mutate(); }} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: "Impr.", value: insights.impressions != null ? insights.impressions.toLocaleString() : "—" },
          { label: "Clicks", value: insights.clicks != null ? insights.clicks.toLocaleString() : "—" },
          { label: "Spend", value: insights.spend != null ? `₹${insights.spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—" },
          { label: "CTR", value: insights.ctr != null ? `${insights.ctr.toFixed(2)}%` : "—" },
          { label: "CPC", value: insights.cpc != null ? `₹${insights.cpc.toFixed(2)}` : "—" },
          { label: "Conv.", value: insights.conversions != null ? insights.conversions.toLocaleString() : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50/60 dark:bg-blue-950/20 rounded px-1.5 py-1 text-center">
            <p className="text-[9px] text-muted-foreground">{label}</p>
            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaInsightsPanel({ metaCampaignId }: { metaCampaignId: string }) {
  const queryKey = ["/api/connectors/meta/campaigns", metaCampaignId, "insights"];
  const { data: insights, isLoading } = useQuery<MetaInsights>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/connectors/meta/campaigns/${metaCampaignId}/insights`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/connectors/meta/campaigns/${metaCampaignId}/insights?force=true`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => { queryClient.setQueryData(queryKey, data); },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading Meta metrics…</div>;
  if (!insights || Object.keys(insights).length === 0) return (
    <p className="text-xs text-muted-foreground italic">No Meta metrics available for this campaign period.</p>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Impressions", value: insights.impressions?.toLocaleString() ?? "—" },
          { label: "Clicks", value: insights.clicks?.toLocaleString() ?? "—" },
          { label: "Spend", value: insights.spend != null ? `₹${insights.spend.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—" },
          { label: "CTR", value: insights.ctr != null ? `${insights.ctr.toFixed(2)}%` : "—" },
          { label: "CPC", value: insights.cpc != null ? `₹${insights.cpc.toFixed(2)}` : "—" },
          { label: "Conversions", value: insights.conversions?.toLocaleString() ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50/60 dark:bg-blue-950/20 rounded-md px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{value}</p>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="h-7 text-xs w-full" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-meta-insights">
        {syncMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
        Sync from Meta
      </Button>
    </div>
  );
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [pageTab, setPageTab] = useState("campaigns");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [formCompanyPrefix, setFormCompanyPrefix] = useState("Viroc");
  const [formPlatform, setFormPlatform] = useState("");
  const [formObjective, setFormObjective] = useState("");
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formMonth, setFormMonth] = useState(MONTHS[new Date().getMonth()].value);
  const [formAdNumber, setFormAdNumber] = useState("Ad1");
  const [formFunnelStage, setFormFunnelStage] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formTargetAudience, setFormTargetAudience] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsActive, setFormIsActive] = useState("true");
  const [formUtmTerm, setFormUtmTerm] = useState("");
  const [formUtmContent, setFormUtmContent] = useState("");
  const [formCreativeLinks, setFormCreativeLinks] = useState<{ linkType: string; label: string; url: string }[]>([]);
  const [formMetaCampaignId, setFormMetaCampaignId] = useState("");
  const [formMetaCampaignName, setFormMetaCampaignName] = useState("");

  const [detailMetaEditMode, setDetailMetaEditMode] = useState(false);
  const [detailMetaCampaignId, setDetailMetaCampaignId] = useState("");
  const [detailMetaCampaignName, setDetailMetaCampaignName] = useState("");

  const [utmDatePreset, setUtmDatePreset] = useState("30d");
  const [utmDateFrom, setUtmDateFrom] = useState("");
  const [utmDateTo, setUtmDateTo] = useState("");

  const utmEffectiveDates = useMemo(() => {
    if (utmDatePreset === "custom") return { dateFrom: utmDateFrom, dateTo: utmDateTo };
    const days = utmDatePreset === "7d" ? 7 : utmDatePreset === "90d" ? 90 : 30;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return {
      dateFrom: from.toISOString().split("T")[0],
      dateTo: to.toISOString().split("T")[0],
    };
  }, [utmDatePreset, utmDateFrom, utmDateTo]);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: channelsList } = useQuery<any[]>({
    queryKey: ["/api/masters/campaignChannels"],
  });

  const { data: connectorsList } = useQuery<any[]>({
    queryKey: ["/api/connectors"],
  });

  const metaConnected = useMemo(() => {
    if (!connectorsList) return false;
    return connectorsList.some((c: any) => c.platform === "meta" && c.status === "connected");
  }, [connectorsList]);

  const { data: metaCampaigns = [], isLoading: metaCampaignsLoading } = useQuery<MetaCampaignOption[]>({
    queryKey: ["/api/connectors/meta/campaigns"],
    enabled: metaConnected && ((formPlatform === "Meta" && dialogOpen) || (detailMetaEditMode && detailCampaign?.platform === "Meta")),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: utmFunnelRows = [], isLoading: utmLoading } = useQuery<UtmFunnelRow[]>({
    queryKey: ["/api/analytics/utm-funnel", utmEffectiveDates.dateFrom, utmEffectiveDates.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: utmEffectiveDates.dateFrom, dateTo: utmEffectiveDates.dateTo });
      const res = await fetch(`/api/analytics/utm-funnel?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: pageTab === "utm",
    staleTime: 5 * 60 * 1000,
  });

  const generatedName = useMemo(() => {
    const parts = [formCompanyPrefix, formPlatform, formObjective, formYear, formMonth, formAdNumber].filter(Boolean);
    return parts.join("_");
  }, [formCompanyPrefix, formPlatform, formObjective, formYear, formMonth, formAdNumber]);

  const utmSource = useMemo(() => {
    if (!formPlatform) return "";
    return PLATFORM_UTM_MAP[formPlatform]?.source || formPlatform.toLowerCase();
  }, [formPlatform]);

  const utmMedium = useMemo(() => {
    if (!formPlatform) return "";
    return PLATFORM_UTM_MAP[formPlatform]?.medium || "cpc";
  }, [formPlatform]);

  const utmCampaign = useMemo(() => generatedName.toLowerCase().replace(/\s+/g, "_"), [generatedName]);

  const utmString = useMemo(() => {
    if (!utmSource) return "";
    const params = new URLSearchParams();
    params.set("utm_source", utmSource);
    params.set("utm_medium", utmMedium);
    params.set("utm_campaign", utmCampaign);
    if (formUtmTerm) params.set("utm_term", formUtmTerm);
    if (formUtmContent) params.set("utm_content", formUtmContent);
    return `?${params.toString()}`;
  }, [utmSource, utmMedium, utmCampaign, formUtmTerm, formUtmContent]);

  useEffect(() => {
    if (!editing && formPlatform && formObjective && formYear && formMonth && campaigns) {
      const matching = campaigns.filter(
        (c) => c.platform === formPlatform && c.objective === formObjective && c.year === formYear && c.month === formMonth
      );
      const maxNum = matching.reduce((max, c) => {
        const m = c.adNumber?.match(/Ad(\d+)/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      setFormAdNumber(`Ad${maxNum + 1}`);
    }
  }, [formPlatform, formObjective, formYear, formMonth, campaigns, editing]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/campaigns", data);
      return res.json();
    },
    onSuccess: async (campaign: any) => {
      if (formCreativeLinks.length > 0) {
        try {
          await apiRequest("POST", `/api/campaigns/${campaign.id}/links`, formCreativeLinks);
        } catch (e: any) {
          toast({ title: "Campaign created but links failed to save", description: e.message, variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${id}`, data);
      return res.json();
    },
    onSuccess: async (_: any, variables: { id: number; data: any }) => {
      try {
        await apiRequest("POST", `/api/campaigns/${variables.id}/links`, formCreativeLinks);
      } catch (e: any) {
        toast({ title: "Campaign updated but links failed to save", description: e.message, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${variables.id}/links`] });
      toast({ title: "Campaign updated" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const quickLinkMutation = useMutation({
    mutationFn: async ({ id, metaCampaignId, metaCampaignName }: { id: number; metaCampaignId: string | null; metaCampaignName: string | null }) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${id}`, { metaCampaignId, metaCampaignName });
      return res.json();
    },
    onSuccess: (updated: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDetailCampaign(updated);
      setDetailMetaEditMode(false);
      toast({ title: updated.metaCampaignId ? "Meta campaign linked" : "Meta campaign unlinked" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (detailCampaign) {
      setDetailMetaCampaignId(detailCampaign.metaCampaignId || "");
      setDetailMetaCampaignName(detailCampaign.metaCampaignName || "");
      setDetailMetaEditMode(false);
    }
  }, [detailCampaign?.id]);

  const openCreate = () => {
    setEditing(null);
    setFormCompanyPrefix("Viroc");
    setFormPlatform("");
    setFormObjective("");
    setFormYear(String(new Date().getFullYear()));
    setFormMonth(MONTHS[new Date().getMonth()].value);
    setFormAdNumber("Ad1");
    setFormFunnelStage("");
    setFormChannel("");
    setFormTargetAudience("");
    setFormDescription("");
    setFormBudget("");
    setFormStartDate("");
    setFormEndDate("");
    setFormIsActive("true");
    setFormUtmTerm("");
    setFormUtmContent("");
    setFormCreativeLinks([]);
    setFormMetaCampaignId("");
    setFormMetaCampaignName("");
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setFormCompanyPrefix(c.companyPrefix || "Viroc");
    setFormPlatform(c.platform || "");
    setFormObjective(c.objective || "");
    setFormYear(c.year || String(new Date().getFullYear()));
    setFormMonth(c.month || "");
    setFormAdNumber(c.adNumber || "Ad1");
    setFormFunnelStage(c.funnelStage || "");
    setFormChannel(c.channel || "");
    setFormTargetAudience(c.targetAudience || "");
    setFormDescription(c.description || "");
    setFormBudget(c.budget != null ? String(c.budget) : "");
    setFormStartDate(c.startDate ? c.startDate.split("T")[0] : "");
    setFormEndDate(c.endDate ? c.endDate.split("T")[0] : "");
    setFormIsActive(c.isActive === false ? "false" : "true");
    setFormUtmTerm(c.utmTerm || "");
    setFormUtmContent(c.utmContent || "");
    setFormMetaCampaignId(c.metaCampaignId || "");
    setFormMetaCampaignName(c.metaCampaignName || "");
    setFormCreativeLinks([]);
    fetch(`/api/campaigns/${c.id}/links`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((links: any[]) => setFormCreativeLinks(links.map((l: any) => ({ linkType: l.linkType, label: l.label || "", url: l.url }))))
      .catch(() => {});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    if (!editing && (!formPlatform || !formObjective)) {
      toast({ title: "Platform and Objective are required", variant: "destructive" });
      return;
    }
    const data: any = {
      name: generatedName,
      companyPrefix: formCompanyPrefix || "Viroc",
      platform: formPlatform,
      objective: formObjective,
      year: formYear,
      month: formMonth,
      adNumber: formAdNumber,
      funnelStage: formFunnelStage || null,
      channel: formChannel || null,
      targetAudience: formTargetAudience || null,
      description: formDescription || null,
      isActive: formIsActive === "true",
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm: formUtmTerm || null,
      utmContent: formUtmContent || null,
      metaCampaignId: formMetaCampaignId || null,
      metaCampaignName: formMetaCampaignName || null,
    };
    if (formBudget) data.budget = Number(formBudget);
    if (formStartDate) data.startDate = formStartDate;
    if (formEndDate) data.endDate = formEndDate;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter((c) => {
      if (filterPlatform && c.platform !== filterPlatform) return false;
      if (filterStatus === "active" && c.isActive === false) return false;
      if (filterStatus === "inactive" && c.isActive !== false) return false;
      if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, filterPlatform, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    if (!campaigns) return { total: 0, active: 0, totalBudget: 0, platforms: 0 };
    const active = campaigns.filter((c) => c.isActive !== false).length;
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    const platforms = new Set(campaigns.map((c) => c.platform).filter(Boolean)).size;
    return { total: campaigns.length, active, totalBudget, platforms };
  }, [campaigns]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const metaCampaignOptions = useMemo(() =>
    metaCampaigns.map(mc => ({ value: mc.id, label: `${mc.name} (${mc.status})` })),
    [metaCampaigns]
  );

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-campaigns-title">Campaigns</h2>
              <p className="text-muted-foreground mt-1">Create and manage marketing campaigns with standardized naming and UTM tracking.</p>
            </div>
            <Button onClick={openCreate} data-testid="button-create-campaign">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>

          <Tabs value={pageTab} onValueChange={setPageTab}>
            <TabsList data-testid="tabs-campaigns-main">
              <TabsTrigger value="campaigns" data-testid="tab-campaigns-list">Campaigns</TabsTrigger>
              <TabsTrigger value="utm" data-testid="tab-utm-analytics">UTM Analytics</TabsTrigger>
            </TabsList>

            {/* ── Campaigns Tab ── */}
            <TabsContent value="campaigns" className="space-y-6 mt-4">
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card data-testid="stat-total-campaigns">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Total Campaigns</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                      </div>
                      <Megaphone className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-active-campaigns">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Active</p>
                        <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                      </div>
                      <Zap className="w-8 h-8 text-green-600/30" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-total-budget">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Total Budget</p>
                        <p className="text-2xl font-bold">₹{stats.totalBudget.toLocaleString("en-IN")}</p>
                      </div>
                      <IndianRupee className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-platforms">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Platforms</p>
                        <p className="text-2xl font-bold">{stats.platforms}</p>
                      </div>
                      <Target className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-64"
                  data-testid="input-search-campaigns"
                />
                <SearchableSelect
                  value={filterPlatform}
                  onValueChange={setFilterPlatform}
                  placeholder="All Platforms"
                  className="w-48"
                  data-testid="filter-platform"
                  options={[{ value: "", label: "All Platforms" }, ...PLATFORMS]}
                />
                <SearchableSelect
                  value={filterStatus}
                  onValueChange={setFilterStatus}
                  placeholder="All Status"
                  className="w-40"
                  data-testid="filter-status"
                  options={[
                    { value: "", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>

              {isLoading ? (
                <LoadingSpinner text="Loading campaigns..." />
              ) : filteredCampaigns.length === 0 ? (
                <Card className="p-12 text-center">
                  <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {campaigns && campaigns.length > 0 ? "No campaigns match your filters." : "No campaigns yet. Create your first campaign."}
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCampaigns.map((c) => (
                    <Card
                      key={c.id}
                      className="overflow-visible cursor-pointer hover:shadow-md transition-shadow"
                      data-testid={`card-campaign-${c.id}`}
                      onClick={() => setDetailCampaign(c)}
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                        <div className="space-y-1 min-w-0">
                          <CardTitle className="text-sm font-semibold truncate" data-testid={`text-campaign-name-${c.id}`}>
                            {c.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.platform && (
                              <Badge variant="outline" className="text-[10px]">
                                {c.platform}
                              </Badge>
                            )}
                            {c.objective && (
                              <Badge variant="secondary" className="text-[10px]">
                                {c.objective}
                              </Badge>
                            )}
                            {c.funnelStage && (
                              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                {c.funnelStage}
                              </Badge>
                            )}
                            {c.metaCampaignId && (
                              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-0.5">
                                <SiFacebook className="w-2.5 h-2.5" />
                                Linked
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant={c.isActive !== false ? "default" : "secondary"} className="text-[10px]">
                            {c.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                            data-testid={`button-edit-campaign-${c.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1.5 pb-3">
                        {c.budget != null && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>₹{c.budget.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {(c.startDate || c.endDate) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {c.startDate ? fmtDate(c.startDate) : "—"}
                              {" to "}
                              {c.endDate ? fmtDate(c.endDate) : "Ongoing"}
                            </span>
                          </div>
                        )}
                        {c.utmSource && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Link2 className="w-3 h-3" />
                            <span className="truncate">utm_source={c.utmSource}</span>
                          </div>
                        )}
                        {c.metaCampaignName && (
                          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                            <SiFacebook className="w-3 h-3" />
                            <span className="truncate">{c.metaCampaignName}</span>
                          </div>
                        )}
                        {c.metaCampaignId && (
                          <InlineMetaCard metaCampaignId={c.metaCampaignId} />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── UTM Analytics Tab ── */}
            <TabsContent value="utm" className="space-y-4 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold">UTM Attribution Funnel</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Full patient journey from first touch to surgery, grouped by campaign UTM tag.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {["7d", "30d", "90d", "custom"].map(p => (
                    <Button
                      key={p}
                      size="sm"
                      variant={utmDatePreset === p ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setUtmDatePreset(p)}
                      data-testid={`button-utm-preset-${p}`}
                    >
                      {p === "custom" ? "Custom" : `Last ${p}`}
                    </Button>
                  ))}
                  {utmDatePreset === "custom" && (
                    <>
                      <Input type="date" value={utmDateFrom} onChange={e => setUtmDateFrom(e.target.value)} className="h-7 text-xs w-36" data-testid="input-utm-date-from" />
                      <Input type="date" value={utmDateTo} onChange={e => setUtmDateTo(e.target.value)} className="h-7 text-xs w-36" data-testid="input-utm-date-to" />
                    </>
                  )}
                </div>
              </div>

              {utmLoading ? (
                <LoadingSpinner text="Loading UTM analytics..." />
              ) : utmFunnelRows.length === 0 ? (
                <Card className="p-10 text-center">
                  <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No UTM-tagged leads found in this period.</p>
                  <p className="text-xs text-muted-foreground mt-1">Make sure leads are captured with utm_campaign values set.</p>
                </Card>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-utm-funnel">
                    <thead>
                      <tr className="bg-muted/50 border-b text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2.5 font-medium min-w-[160px]">Campaign</th>
                        <th className="text-left px-3 py-2.5 font-medium">Source / Medium</th>
                        <th className="text-right px-3 py-2.5 font-medium">Leads</th>
                        <th className="text-right px-3 py-2.5 font-medium">Appts</th>
                        <th className="text-right px-3 py-2.5 font-medium text-[10px]">L→A %</th>
                        <th className="text-right px-3 py-2.5 font-medium">Episodes</th>
                        <th className="text-right px-3 py-2.5 font-medium text-[10px]">A→E %</th>
                        <th className="text-right px-3 py-2.5 font-medium">Treatment</th>
                        <th className="text-right px-3 py-2.5 font-medium">Surgery</th>
                        <th className="text-right px-3 py-2.5 font-medium text-[10px]">E→S %</th>
                        <th className="text-right px-3 py-2.5 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utmFunnelRows.map((row, i) => (
                        <tr
                          key={row.utmCampaign}
                          className="border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                          data-testid={`row-utm-${i}`}
                          onClick={() => navigate(`/leads?utmCampaign=${encodeURIComponent(row.utmCampaign)}`)}
                          title={`View leads from ${row.utmCampaign}`}
                        >
                          <td className="px-3 py-2 font-medium text-xs max-w-[200px]">
                            <span className="flex items-center gap-1 truncate" title={row.utmCampaign}>
                              {row.utmCampaign}
                              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {row.utmSource || "—"} / {row.utmMedium || "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{row.leads}</td>
                          <td className="px-3 py-2 text-right">{row.appointments}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pct(row.appointments, row.leads)}</td>
                          <td className="px-3 py-2 text-right">{row.episodes}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pct(row.episodes, row.appointments)}</td>
                          <td className="px-3 py-2 text-right">{row.treatmentStarted}</td>
                          <td className="px-3 py-2 text-right">
                            {row.surgeryDone > 0 ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                {row.surgeryDone}
                              </span>
                            ) : "0"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pct(row.surgeryDone, row.episodes)}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400 whitespace-nowrap">
                            {row.revenue > 0 ? `₹${row.revenue.toLocaleString("en-IN")}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t text-xs font-semibold">
                        <td className="px-3 py-2" colSpan={2}>Totals</td>
                        <td className="px-3 py-2 text-right">{utmFunnelRows.reduce((s, r) => s + r.leads, 0)}</td>
                        <td className="px-3 py-2 text-right">{utmFunnelRows.reduce((s, r) => s + r.appointments, 0)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{pct(utmFunnelRows.reduce((s, r) => s + r.appointments, 0), utmFunnelRows.reduce((s, r) => s + r.leads, 0))}</td>
                        <td className="px-3 py-2 text-right">{utmFunnelRows.reduce((s, r) => s + r.episodes, 0)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{pct(utmFunnelRows.reduce((s, r) => s + r.episodes, 0), utmFunnelRows.reduce((s, r) => s + r.appointments, 0))}</td>
                        <td className="px-3 py-2 text-right">{utmFunnelRows.reduce((s, r) => s + r.treatmentStarted, 0)}</td>
                        <td className="px-3 py-2 text-right">{utmFunnelRows.reduce((s, r) => s + r.surgeryDone, 0)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{pct(utmFunnelRows.reduce((s, r) => s + r.surgeryDone, 0), utmFunnelRows.reduce((s, r) => s + r.episodes, 0))}</td>
                        <td className="px-3 py-2 text-right text-green-700 dark:text-green-400">
                          ₹{utmFunnelRows.reduce((s, r) => s + r.revenue, 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Campaign Detail Dialog */}
        <Dialog open={!!detailCampaign} onOpenChange={(open) => { if (!open) setDetailCampaign(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {detailCampaign && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle className="text-lg">{detailCampaign.name}</DialogTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={detailCampaign.isActive !== false ? "default" : "secondary"}>
                        {detailCampaign.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => { setDetailCampaign(null); openEdit(detailCampaign); }} data-testid="button-edit-from-detail">
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="details" className="mt-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="details" className="flex-1" data-testid="tab-details">Details</TabsTrigger>
                    <TabsTrigger value="utm" className="flex-1" data-testid="tab-utm">UTM Parameters</TabsTrigger>
                    {detailCampaign.metaCampaignId && (
                      <TabsTrigger value="meta" className="flex-1" data-testid="tab-meta-performance">
                        <SiFacebook className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        Meta
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="resources" className="flex-1" data-testid="tab-resources">Resources</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow label="Platform" value={detailCampaign.platform} />
                      <InfoRow label="Objective" value={detailCampaign.objective} />
                      <InfoRow label="Funnel Stage" value={detailCampaign.funnelStage} />
                      <InfoRow label="Target Audience" value={detailCampaign.targetAudience} />
                      <InfoRow label="Channel" value={detailCampaign.channel} />
                      <InfoRow
                        label="Budget"
                        value={detailCampaign.budget != null ? `₹${detailCampaign.budget.toLocaleString("en-IN")}` : null}
                      />
                      <InfoRow
                        label="Start Date"
                        value={detailCampaign.startDate ? fmtDate(detailCampaign.startDate) : null}
                      />
                      <InfoRow
                        label="End Date"
                        value={detailCampaign.endDate ? fmtDate(detailCampaign.endDate) : null}
                      />
                      {/* Meta Campaign Linking — visible for Meta platform campaigns */}
                      {(detailCampaign.platform === "Meta") && (
                        <div className="col-span-2">
                          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <SiFacebook className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Meta Campaign Link</span>
                              </div>
                              {!detailMetaEditMode ? (
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDetailMetaEditMode(true)} data-testid="button-detail-link-meta">
                                  {detailCampaign.metaCampaignId ? <Pencil className="w-3 h-3 mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
                                  {detailCampaign.metaCampaignId ? "Change" : "Link"}
                                </Button>
                              ) : null}
                            </div>
                            {!detailMetaEditMode ? (
                              detailCampaign.metaCampaignId ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{detailCampaign.metaCampaignName}</span>
                                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">ID: {detailCampaign.metaCampaignId}</Badge>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No Meta campaign linked yet.</p>
                              )
                            ) : (
                              <div className="space-y-2">
                                {!metaConnected ? (
                                  <p className="text-xs text-amber-600">Meta connector not connected. Configure it in Connectors first.</p>
                                ) : metaCampaignsLoading ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading Meta campaigns…</div>
                                ) : (
                                  <SearchableSelect
                                    value={detailMetaCampaignId}
                                    onValueChange={(v) => {
                                      setDetailMetaCampaignId(v);
                                      const found = metaCampaigns.find(mc => mc.id === v);
                                      setDetailMetaCampaignName(found?.name || "");
                                    }}
                                    placeholder="Search Meta campaigns…"
                                    options={[{ value: "", label: "None (unlink)" }, ...metaCampaignOptions]}
                                    data-testid="select-detail-meta-campaign"
                                  />
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={quickLinkMutation.isPending}
                                    onClick={() => quickLinkMutation.mutate({ id: detailCampaign.id, metaCampaignId: detailMetaCampaignId || null, metaCampaignName: detailMetaCampaignName || null })}
                                    data-testid="button-detail-meta-save"
                                  >
                                    {quickLinkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailMetaEditMode(false)} data-testid="button-detail-meta-cancel">
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {detailCampaign.description && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{detailCampaign.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Campaign Name Breakdown</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailCampaign.companyPrefix && <Badge variant="outline">{detailCampaign.companyPrefix}</Badge>}
                        {detailCampaign.platform && <Badge variant="outline">{detailCampaign.platform}</Badge>}
                        {detailCampaign.objective && <Badge variant="outline">{detailCampaign.objective}</Badge>}
                        {detailCampaign.year && <Badge variant="outline">{detailCampaign.year}</Badge>}
                        {detailCampaign.month && <Badge variant="outline">{detailCampaign.month}</Badge>}
                        {detailCampaign.adNumber && <Badge variant="outline">{detailCampaign.adNumber}</Badge>}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="utm" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <UtmRow label="utm_source" value={detailCampaign.utmSource} onCopy={copyToClipboard} />
                      <UtmRow label="utm_medium" value={detailCampaign.utmMedium} onCopy={copyToClipboard} />
                      <UtmRow label="utm_campaign" value={detailCampaign.utmCampaign} onCopy={copyToClipboard} />
                      <UtmRow label="utm_term" value={detailCampaign.utmTerm} onCopy={copyToClipboard} />
                      <UtmRow label="utm_content" value={detailCampaign.utmContent} onCopy={copyToClipboard} />
                    </div>
                    {detailCampaign.utmSource && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Full UTM String</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-3 py-2 rounded flex-1 break-all" data-testid="text-full-utm">
                            ?utm_source={detailCampaign.utmSource}
                            &utm_medium={detailCampaign.utmMedium}
                            &utm_campaign={detailCampaign.utmCampaign}
                            {detailCampaign.utmTerm ? `&utm_term=${detailCampaign.utmTerm}` : ""}
                            {detailCampaign.utmContent ? `&utm_content=${detailCampaign.utmContent}` : ""}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set("utm_source", detailCampaign.utmSource || "");
                              params.set("utm_medium", detailCampaign.utmMedium || "");
                              params.set("utm_campaign", detailCampaign.utmCampaign || "");
                              if (detailCampaign.utmTerm) params.set("utm_term", detailCampaign.utmTerm);
                              if (detailCampaign.utmContent) params.set("utm_content", detailCampaign.utmContent);
                              copyToClipboard(`?${params.toString()}`, "UTM string");
                            }}
                            data-testid="button-copy-utm-string"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {detailCampaign.metaCampaignId && (
                    <TabsContent value="meta" className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <SiFacebook className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-semibold">{detailCampaign.metaCampaignName}</p>
                          <p className="text-xs text-muted-foreground">Campaign ID: {detailCampaign.metaCampaignId}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 bg-blue-50/40 dark:bg-blue-950/10">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Performance (Last 30 Days)</p>
                        <MetaInsightsPanel metaCampaignId={detailCampaign.metaCampaignId} />
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="resources" className="mt-4">
                    <ResourceLinksSection entityType="campaign" entityId={detailCampaign.id} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Create/Edit Campaign Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Auto-generated name preview */}
              <div className="bg-muted/50 rounded-lg p-4 border">
                <Label className="text-xs font-medium text-muted-foreground">Campaign Name (Auto-generated)</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="text-sm font-semibold bg-background px-3 py-2 rounded border flex-1 truncate" data-testid="text-generated-name">
                    {generatedName || "Select platform & objective to generate name"}
                  </code>
                  {generatedName && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(generatedName, "Campaign name")}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Name builder dropdowns */}
              <div>
                <p className="text-sm font-semibold mb-3">Campaign Name Builder</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Company</Label>
                    <Input
                      value={formCompanyPrefix}
                      onChange={(e) => setFormCompanyPrefix(e.target.value)}
                      placeholder="Company"
                      data-testid="input-company-prefix"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Platform *</Label>
                    <SearchableSelect
                      value={formPlatform}
                      onValueChange={(v) => { setFormPlatform(v); setFormChannel(""); setFormMetaCampaignId(""); setFormMetaCampaignName(""); }}
                      placeholder="Select platform"
                      options={PLATFORMS}
                      data-testid="select-campaign-platform"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Objective *</Label>
                    <SearchableSelect
                      value={formObjective}
                      onValueChange={setFormObjective}
                      placeholder="Select objective"
                      options={OBJECTIVES}
                      data-testid="select-campaign-objective"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Year</Label>
                    <SearchableSelect
                      value={formYear}
                      onValueChange={setFormYear}
                      placeholder="Year"
                      options={generateYears()}
                      data-testid="select-campaign-year"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Month</Label>
                    <SearchableSelect
                      value={formMonth}
                      onValueChange={setFormMonth}
                      placeholder="Month"
                      options={MONTHS}
                      data-testid="select-campaign-month"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Ad Number</Label>
                    <Input
                      value={formAdNumber}
                      onChange={(e) => setFormAdNumber(e.target.value)}
                      placeholder="Ad1"
                      data-testid="input-ad-number"
                    />
                  </div>
                </div>
              </div>

              {/* Campaign details */}
              <div>
                <p className="text-sm font-semibold mb-3">Campaign Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Funnel Stage</Label>
                    <SearchableSelect
                      value={formFunnelStage}
                      onValueChange={setFormFunnelStage}
                      placeholder="Select stage"
                      options={[{ value: "", label: "None" }, ...FUNNEL_STAGES]}
                      data-testid="select-campaign-funnel"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Target Audience</Label>
                    <SearchableSelect
                      value={formTargetAudience}
                      onValueChange={setFormTargetAudience}
                      placeholder="Select audience"
                      options={[{ value: "", label: "None" }, ...TARGET_AUDIENCES]}
                      data-testid="select-campaign-audience"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
                    <SearchableSelect
                      value={formChannel}
                      onValueChange={setFormChannel}
                      placeholder={formPlatform ? "Select channel" : "Select platform first"}
                      disabled={!formPlatform}
                      options={[
                        { value: "", label: "None" },
                        ...(formPlatform && PLATFORM_CHANNELS[formPlatform] ? PLATFORM_CHANNELS[formPlatform] : []),
                      ]}
                      data-testid="select-campaign-channel"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Budget (₹)</Label>
                    <Input
                      type="number"
                      value={formBudget}
                      onChange={(e) => setFormBudget(e.target.value)}
                      placeholder="Campaign budget"
                      data-testid="input-campaign-budget"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} data-testid="input-campaign-start" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                    <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} data-testid="input-campaign-end" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                    <Textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Campaign description or notes..."
                      rows={2}
                      data-testid="textarea-campaign-description"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                    <SearchableSelect
                      value={formIsActive}
                      onValueChange={setFormIsActive}
                      options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]}
                      data-testid="select-campaign-status"
                    />
                  </div>
                </div>
              </div>

              {/* Meta Campaign Linking — only shown when platform is Meta */}
              {formPlatform === "Meta" && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <SiFacebook className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Link to Meta Campaign</p>
                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">Optional</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Link this CRM campaign to its counterpart in Meta Ads Manager to see live performance metrics (Impressions, Clicks, Spend, CTR).
                    Campaigns must be created in Meta Ads Manager first.
                  </p>
                  {!metaConnected ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      Meta connector is not connected. Configure it in Connectors to enable linking.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Meta Campaign</Label>
                      {metaCampaignsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading campaigns from Meta…
                        </div>
                      ) : (
                        <SearchableSelect
                          value={formMetaCampaignId}
                          onValueChange={(v) => {
                            setFormMetaCampaignId(v);
                            const found = metaCampaigns.find(mc => mc.id === v);
                            setFormMetaCampaignName(found?.name || "");
                          }}
                          placeholder="Search and select a Meta campaign…"
                          options={[{ value: "", label: "None (unlink)" }, ...metaCampaignOptions]}
                          data-testid="select-meta-campaign-link"
                        />
                      )}
                      {formMetaCampaignId && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Linked to: {formMetaCampaignName || formMetaCampaignId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* UTM Parameters - Auto-generated */}
              <div>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  UTM Parameters
                  <Badge variant="secondary" className="text-[10px]">Auto-generated</Badge>
                </p>
                <div className="bg-muted/30 rounded-lg p-3 border space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] font-medium text-muted-foreground">utm_source</Label>
                      <Input value={utmSource} readOnly className="bg-muted/50 text-sm h-8" data-testid="input-utm-source" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-medium text-muted-foreground">utm_medium</Label>
                      <Input value={utmMedium} readOnly className="bg-muted/50 text-sm h-8" data-testid="input-utm-medium" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] font-medium text-muted-foreground">utm_campaign</Label>
                      <Input value={utmCampaign} readOnly className="bg-muted/50 text-sm h-8" data-testid="input-utm-campaign" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-medium text-muted-foreground">utm_term (optional)</Label>
                      <Input
                        value={formUtmTerm}
                        onChange={(e) => setFormUtmTerm(e.target.value)}
                        placeholder="e.g. orthopaedic+surgeon"
                        className="text-sm h-8"
                        data-testid="input-utm-term"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-medium text-muted-foreground">utm_content (optional)</Label>
                      <Input
                        value={formUtmContent}
                        onChange={(e) => setFormUtmContent(e.target.value)}
                        placeholder="e.g. banner_v1"
                        className="text-sm h-8"
                        data-testid="input-utm-content"
                      />
                    </div>
                  </div>
                  {utmString && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] bg-background px-2 py-1.5 rounded border flex-1 break-all" data-testid="text-utm-preview">
                          {utmString}
                        </code>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(utmString, "UTM string")} data-testid="button-copy-utm">
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <ResourceLinksInlineEditor
                  entityType="campaign"
                  links={formCreativeLinks}
                  onChange={setFormCreativeLinks}
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={isPending || (!formPlatform && !editing) || (!formObjective && !editing)}
                data-testid="button-save-campaign"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                {editing ? "Update Campaign" : "Create Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
