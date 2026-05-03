const WATI_KILL_SWITCH = true;

export interface WatiConfig {
  apiUrl: string;
  accessToken: string;
  enabled: boolean;
  templateAppointment: string;
  templateReminder: string;
}

interface WatiSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function getWatiConfigFromSettings(
  settings: { settingKey: string; settingValue: string | null }[]
): WatiConfig {
  const get = (key: string) => settings.find(s => s.settingKey === key)?.settingValue || "";
  return {
    apiUrl: get("wati_api_url").replace(/\/$/, ""),
    accessToken: get("wati_access_token"),
    enabled: get("wati_enabled") === "true",
    templateAppointment: get("wati_template_appointment") || "",
    templateReminder: get("wati_template_reminder") || "",
  };
}

export function formatPhoneForWati(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

/**
 * Safely parses a response body as JSON.
 * WATI sometimes returns an empty body (especially on session messages),
 * so we must never call .json() directly — use .text() and try-parse instead.
 */
async function safeParseJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _rawText: text };
  }
}

function humanizeWatiError(data: any, status: number): string {
  const msg: string = data?.message || data?.error || data?.errors?.[0]?.message || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return "WATI access token is invalid or expired. Please generate a new token in your WATI dashboard and update it in the settings.";
  }
  if (status === 404) {
    return "WATI API endpoint not found. Please verify your WATI API URL is correct (e.g., https://live-mt-server.wati.io/YOUR_ACCOUNT_ID).";
  }
  if (status === 429) {
    return "WATI rate limit reached. Please wait a few minutes and try again.";
  }
  if (status === 400 && msg.toLowerCase().includes("session")) {
    return "No active WhatsApp session with this number. The patient must have messaged you within the last 24 hours for a session message to work. Use a template message instead.";
  }
  if (msg.toLowerCase().includes("template")) {
    return `Template error: ${msg}. Ensure the template is approved in your WATI dashboard.`;
  }
  if (data?._rawText) {
    return `WATI error (HTTP ${status}): ${data._rawText.substring(0, 200)}`;
  }
  return msg;
}

export async function sendWatiTemplate(
  config: WatiConfig,
  params: {
    to: string;
    templateName: string;
    broadcastName: string;
    parameters: { name: string; value: string }[];
  }
): Promise<WatiSendResult> {
  if (WATI_KILL_SWITCH) {
    console.warn("[WATI] Kill-switch active — template message blocked (not sent).");
    return { success: false, error: "WATI messaging is currently disabled by administrator." };
  }
  if (!config.enabled || !config.apiUrl || !config.accessToken) {
    return { success: false, error: "WATI not configured or disabled" };
  }

  const url = `${config.apiUrl}/api/v2/sendTemplateMessage?whatsappNumber=${params.to}`;

  const body = {
    template_name: params.templateName,
    broadcast_name: params.broadcastName,
    parameters: params.parameters,
  };

  // Guard: reject before hitting WATI if any parameter value is blank
  const blankParam = params.parameters.find(p => !p.value || !p.value.trim());
  if (blankParam) {
    const errMsg = `Parameter "${blankParam.name}" has an empty value — WATI will reject blank parameters. Fill in the Hospital Contact Number in WhatsApp Settings and save again.`;
    console.error("[WATI] Aborting template send:", errMsg);
    return { success: false, error: errMsg };
  }

  console.log(`[WATI] Sending template "${params.templateName}" to ${params.to} with params:`,
    params.parameters.map(p => `${p.name}="${p.value}"`).join(", "));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await safeParseJson(response);

    if (!response.ok) {
      // WATI can put the error in message, error, or errors[0].message — check all
      const rawDetail = data?.message || data?.error || data?.errors?.[0]?.message || data?._rawText || "";
      console.error(`[WATI] Template send failed: HTTP ${response.status}`, rawDetail || "(no body)");
      const errorMsg = humanizeWatiError(data, response.status);
      return { success: false, error: rawDetail ? `HTTP ${response.status} — ${rawDetail}` : errorMsg };
    }

    const messageId = data?.id || data?.messageId || data?.result || undefined;
    console.log("[WATI] Template message sent:", messageId ?? "(no id returned)");
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WATI] Template fetch error:", err.message);
    return { success: false, error: `Network error: ${err.message}` };
  }
}

export async function sendWatiSession(
  config: WatiConfig,
  to: string,
  text: string
): Promise<WatiSendResult> {
  if (WATI_KILL_SWITCH) {
    console.warn("[WATI] Kill-switch active — session message blocked (not sent).");
    return { success: false, error: "WATI messaging is currently disabled by administrator." };
  }
  if (!config.enabled || !config.apiUrl || !config.accessToken) {
    return { success: false, error: "WATI not configured or disabled" };
  }

  // Try both v1 and v2 session message endpoints — WATI servers differ on which is active
  const endpoints = [
    `${config.apiUrl}/api/v1/sendSessionMessage?whatsappNumber=${to}`,
    `${config.apiUrl}/api/v2/sendSessionMessage?whatsappNumber=${to}`,
  ];

  const body = { messageText: text };

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 404) {
        console.log(`[WATI] Session endpoint not found at ${url}, trying next...`);
        continue; // try next endpoint
      }

      // WATI often returns an empty body (200/201) for session messages — treat any 2xx as success
      const data = await safeParseJson(response);

      if (!response.ok) {
        const rawDetail = data?.message || data?.error || data?._rawText || "";
        console.error("[WATI] Session message failed:", response.status, rawDetail || "(no body)");
        return { success: false, error: humanizeWatiError(data, response.status) };
      }

      const messageId = data?.id || data?.messageId || data?.result || undefined;
      console.log("[WATI] Session message sent via", url, "—", messageId ?? "(no id returned)");
      return { success: true, messageId };
    } catch (err: any) {
      console.error("[WATI] Session fetch error:", err.message);
      return { success: false, error: `Network error: ${err.message}` };
    }
  }

  return { success: false, error: "WATI session message endpoint not found (tried v1 and v2). This WATI account may not support session messages — use templates instead." };
}

export async function listWatiTemplates(
  config: WatiConfig
): Promise<{ success: boolean; templates?: any[]; error?: string }> {
  if (!config.apiUrl || !config.accessToken) {
    return { success: false, error: "WATI not configured" };
  }
  try {
    const url = `${config.apiUrl}/api/v1/templates?pageSize=100`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${config.accessToken}` },
    });
    const data = await safeParseJson(response);
    if (!response.ok) {
      const rawDetail = data?.message || data?.error || data?._rawText || `HTTP ${response.status}`;
      return { success: false, error: rawDetail };
    }
    const templates = data?.messageTemplates || data?.templates || data?.result || [];
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testWatiConnection(
  config: WatiConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.apiUrl || !config.accessToken) {
    return { success: false, message: "WATI API URL and Access Token are required" };
  }

  const url = `${config.apiUrl}/api/v1/getContacts?pageSize=1`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: "Authentication failed. Please check your WATI access token." };
    }

    if (response.status === 404) {
      return { success: false, message: "Could not reach WATI. Please verify your API URL (e.g., https://live-mt-server.wati.io/YOUR_ACCOUNT_ID)." };
    }

    if (!response.ok) {
      const data = await safeParseJson(response);
      return { success: false, message: `Connection failed: ${humanizeWatiError(data, response.status)}` };
    }

    return { success: true, message: "Connected to WATI successfully! Your API credentials are valid." };
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.message?.includes("getaddrinfo")) {
      return { success: false, message: "Cannot reach WATI server. Verify the API URL is correct (e.g., https://live-mt-server.wati.io/YOUR_ACCOUNT_ID)." };
    }
    return { success: false, message: `Network error: ${err.message}` };
  }
}
