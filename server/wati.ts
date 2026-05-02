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

function humanizeWatiError(data: any, status: number): string {
  const msg: string = data?.message || data?.error || data?.errors?.[0]?.message || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return "WATI access token is invalid or expired. Please generate a new token in your WATI dashboard and update it in the settings.";
  }
  if (status === 404) {
    return "WATI API endpoint not found. Please verify your WATI API URL is correct (e.g., https://live-server-XXXXX.wati.io).";
  }
  if (status === 429) {
    return "WATI rate limit reached. Please wait a few minutes and try again.";
  }
  if (msg.toLowerCase().includes("template")) {
    return `Template error: ${msg}. Ensure the template is approved in your WATI dashboard.`;
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
  if (!config.enabled || !config.apiUrl || !config.accessToken) {
    return { success: false, error: "WATI not configured or disabled" };
  }

  const url = `${config.apiUrl}/api/v1/sendTemplateMessage?whatsappNumber=${params.to}`;

  const body = {
    template_name: params.templateName,
    broadcast_name: params.broadcastName,
    parameters: params.parameters,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = humanizeWatiError(data, response.status);
      console.error("[WATI] Template send failed:", data?.message || response.status);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.id || data?.messageId || undefined;
    console.log("[WATI] Template message sent:", messageId);
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WATI] Network error:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendWatiSession(
  config: WatiConfig,
  to: string,
  text: string
): Promise<WatiSendResult> {
  if (!config.enabled || !config.apiUrl || !config.accessToken) {
    return { success: false, error: "WATI not configured or disabled" };
  }

  const url = `${config.apiUrl}/api/v1/sendSessionMessage?whatsappNumber=${to}`;

  const body = { messageText: text };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = humanizeWatiError(data, response.status);
      console.error("[WATI] Session message failed:", data?.message || response.status);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.id || data?.messageId || undefined;
    console.log("[WATI] Session message sent:", messageId);
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WATI] Network error:", err.message);
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
      return { success: false, message: "Could not reach WATI. Please verify your API URL (e.g., https://live-server-XXXXX.wati.io)." };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, message: `Connection failed: ${humanizeWatiError(data, response.status)}` };
    }

    return { success: true, message: "Connected to WATI successfully! Your API credentials are valid." };
  } catch (err: any) {
    if (err.message?.includes("fetch") || err.code === "ENOTFOUND") {
      return { success: false, message: "Cannot reach WATI server. Verify the API URL is correct (e.g., https://live-server-XXXXX.wati.io)." };
    }
    return { success: false, message: `Network error: ${err.message}` };
  }
}
