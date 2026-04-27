const META_GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

interface MetaInsightsResponse {
  data: Array<{
    impressions?: string;
    clicks?: string;
    spend?: string;
    ctr?: string;
    cpc?: string;
    reach?: string;
    frequency?: string;
    actions?: Array<{ action_type: string; value: string }>;
    date_start: string;
    date_stop: string;
  }>;
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

interface MetaCampaignsResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
    insights?: {
      data: Array<{
        impressions?: string;
        clicks?: string;
        spend?: string;
        ctr?: string;
        cpc?: string;
        actions?: Array<{ action_type: string; value: string }>;
      }>;
    };
  }>;
}

export interface MetaAdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  reach: number;
  conversions: number;
  dateStart: string;
  dateStop: string;
}

export interface MetaCampaignSummary {
  id: string;
  name: string;
  status: string;
  objective: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

let _tenantCredentials: { accessToken: string; adAccountId: string; appId?: string } | null = null;

export function setTenantCredentials(creds: { accessToken: string; adAccountId: string; appId?: string }) {
  _tenantCredentials = creds;
}

export function clearTenantCredentials() {
  _tenantCredentials = null;
}

function normalizeAdAccountId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("act_")) return trimmed;
  return `act_${trimmed}`;
}

function getCredentials() {
  if (_tenantCredentials) {
    return {
      ...(_tenantCredentials),
      adAccountId: normalizeAdAccountId(_tenantCredentials.adAccountId),
    };
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const appId = process.env.META_APP_ID;

  if (!accessToken || !adAccountId) {
    throw new Error("Meta API credentials not configured. Please configure your Meta connector in Configurations → Connectors.");
  }

  return { accessToken, adAccountId: normalizeAdAccountId(adAccountId), appId };
}

async function metaApiGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { accessToken } = getCredentials();
  const url = new URL(`${META_GRAPH_API_BASE}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    const errMsg = data.error.message || "Unknown Meta API error";
    const errCode = data.error.code || 0;
    throw new Error(`Meta API Error (${errCode}): ${errMsg}`);
  }

  return data as T;
}

function extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const conversionTypes = [
    "offsite_conversion",
    "lead",
    "complete_registration",
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.lead_grouped",
  ];
  let total = 0;
  for (const action of actions) {
    if (conversionTypes.some(t => action.action_type.includes(t)) || action.action_type === "lead") {
      total += parseInt(action.value, 10) || 0;
    }
  }
  return total;
}

export interface MetaLeadgenData {
  id: string;
  created_time: string;
  ad_id?: string;
  form_id?: string;
  page_id?: string;
  field_data: Array<{ name: string; values: string[] }>;
}

/**
 * Fetch the actual lead data from Meta using a leadgen_id.
 * Called after receiving a Meta Lead Ads webhook notification.
 * accessToken is passed explicitly (not from tenant creds) so this
 * can be called without a full connector context.
 */
export async function fetchLeadgenData(leadgenId: string, accessToken: string): Promise<MetaLeadgenData> {
  const url = new URL(`${META_GRAPH_API_BASE}/${leadgenId}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,created_time,ad_id,form_id,page_id,field_data");

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error (${data.error.code}): ${data.error.message}`);
  }

  return data as MetaLeadgenData;
}

export async function testMetaConnection(): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const { adAccountId } = getCredentials();
    const data = await metaApiGet<{ name: string; account_status: number; id: string }>(
      `/${adAccountId}`,
      { fields: "name,account_status" }
    );
    return {
      success: true,
      accountName: data.name,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAccountInsights(datePreset: string = "last_30d"): Promise<MetaAdMetrics | null> {
  try {
    const { adAccountId } = getCredentials();
    const data = await metaApiGet<MetaInsightsResponse>(
      `/${adAccountId}/insights`,
      {
        fields: "impressions,clicks,spend,ctr,cpc,reach,actions",
        date_preset: datePreset,
      }
    );

    if (!data.data || data.data.length === 0) return null;

    const row = data.data[0];
    return {
      impressions: parseInt(row.impressions || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
      spend: parseFloat(row.spend || "0"),
      ctr: parseFloat(row.ctr || "0"),
      cpc: parseFloat(row.cpc || "0"),
      reach: parseInt(row.reach || "0", 10),
      conversions: extractConversions(row.actions),
      dateStart: row.date_start,
      dateStop: row.date_stop,
    };
  } catch (err: any) {
    console.error("Failed to fetch Meta account insights:", err.message);
    throw err;
  }
}

export async function fetchCampaignInsights(datePreset: string = "last_30d"): Promise<MetaCampaignSummary[]> {
  try {
    const { adAccountId } = getCredentials();
    const data = await metaApiGet<MetaCampaignsResponse>(
      `/${adAccountId}/campaigns`,
      {
        fields: "name,status,objective,insights.date_preset(" + datePreset + "){impressions,clicks,spend,ctr,cpc,actions}",
        limit: "50",
      }
    );

    if (!data.data) return [];

    return data.data.map(campaign => {
      const ins = campaign.insights?.data?.[0];
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        impressions: parseInt(ins?.impressions || "0", 10),
        clicks: parseInt(ins?.clicks || "0", 10),
        spend: parseFloat(ins?.spend || "0"),
        ctr: parseFloat(ins?.ctr || "0"),
        cpc: parseFloat(ins?.cpc || "0"),
        conversions: extractConversions(ins?.actions),
      };
    });
  } catch (err: any) {
    console.error("Failed to fetch Meta campaign insights:", err.message);
    throw err;
  }
}

/**
 * Fetch insights for a single Meta campaign by its campaign ID.
 * Results are cached in-memory for 1 hour to avoid hitting rate limits.
 */
const _singleCampaignInsightsCache = new Map<string, { data: MetaAdMetrics; expiresAt: number }>();

export async function fetchSingleCampaignInsights(metaCampaignId: string, datePreset: string = "last_30d"): Promise<MetaAdMetrics | null> {
  const cacheKey = `${metaCampaignId}:${datePreset}`;
  const cached = _singleCampaignInsightsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const data = await metaApiGet<MetaInsightsResponse>(
    `/${metaCampaignId}/insights`,
    { fields: "impressions,clicks,spend,ctr,cpc,reach,actions", date_preset: datePreset }
  );

  if (!data.data || data.data.length === 0) return null;
  const row = data.data[0];
  const result: MetaAdMetrics = {
    impressions: parseInt(row.impressions || "0", 10),
    clicks: parseInt(row.clicks || "0", 10),
    spend: parseFloat(row.spend || "0"),
    ctr: parseFloat(row.ctr || "0"),
    cpc: parseFloat(row.cpc || "0"),
    reach: parseInt(row.reach || "0", 10),
    conversions: extractConversions(row.actions),
    dateStart: row.date_start,
    dateStop: row.date_stop,
  };
  _singleCampaignInsightsCache.set(cacheKey, { data: result, expiresAt: Date.now() + 60 * 60 * 1000 });
  return result;
}

export async function fetchDailyInsights(days: number = 7): Promise<MetaAdMetrics[]> {
  try {
    const { adAccountId } = getCredentials();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await metaApiGet<MetaInsightsResponse>(
      `/${adAccountId}/insights`,
      {
        fields: "impressions,clicks,spend,ctr,cpc,reach,actions",
        time_range: JSON.stringify({
          since: startDate.toISOString().split("T")[0],
          until: endDate.toISOString().split("T")[0],
        }),
        time_increment: "1",
      }
    );

    if (!data.data) return [];

    return data.data.map(row => ({
      impressions: parseInt(row.impressions || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
      spend: parseFloat(row.spend || "0"),
      ctr: parseFloat(row.ctr || "0"),
      cpc: parseFloat(row.cpc || "0"),
      reach: parseInt(row.reach || "0", 10),
      conversions: extractConversions(row.actions),
      dateStart: row.date_start,
      dateStop: row.date_stop,
    }));
  } catch (err: any) {
    console.error("Failed to fetch Meta daily insights:", err.message);
    throw err;
  }
}
