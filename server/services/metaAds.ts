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

function getCredentials() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const appId = process.env.META_APP_ID;

  if (!accessToken || !adAccountId) {
    throw new Error("Meta API credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID environment variables.");
  }

  return { accessToken, adAccountId, appId };
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
