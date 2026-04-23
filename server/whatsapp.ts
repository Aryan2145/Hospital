interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  enabled: boolean;
  templateName: string;
}

interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
}

export async function sendWhatsAppTemplate(
  config: WhatsAppConfig,
  params: SendTemplateParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.enabled || !config.phoneNumberId || !config.accessToken) {
    return { success: false, error: "WhatsApp not configured or disabled" };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

  const body: any = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode || "en" },
    },
  };

  if (params.components && params.components.length > 0) {
    body.template.components = params.components;
  }

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
      const errorMsg = humanizeMetaError(data, response.status);
      console.error("[WhatsApp] Send failed:", data?.error?.message || response.status);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    console.log("[WhatsApp] Message sent successfully:", messageId);
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WhatsApp] Network error:", err.message);
    return { success: false, error: err.message };
  }
}

function humanizeMetaError(data: any, status: number): string {
  const code = data?.error?.code;
  const subcode = data?.error?.error_subcode;
  const msg: string = data?.error?.message || `HTTP ${status}`;

  // Token invalid / expired / malformed
  if (code === 190 || msg.includes("postcard") || msg.includes("payload") || msg.includes("OAuthException")) {
    return "Access Token is invalid or expired. Please generate a new Permanent Access Token in Meta Business Suite → System Users and update it in WhatsApp settings.";
  }
  // Recipient not in test whitelist
  if (subcode === 131030 || msg.toLowerCase().includes("not a valid whatsapp")) {
    return "Recipient phone number is not registered on WhatsApp. Verify the number and ensure it is active on WhatsApp.";
  }
  // Rate limit
  if (code === 80007 || code === 130429) {
    return "WhatsApp rate limit reached. Please wait a few minutes and try again.";
  }
  // Template not found
  if (code === 132001) {
    return "Message template not found or not approved. Check the template name in Meta Business Manager.";
  }
  return msg;
}

export async function sendWhatsAppText(
  config: WhatsAppConfig,
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.enabled || !config.phoneNumberId || !config.accessToken) {
    return { success: false, error: "WhatsApp not configured or disabled" };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
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
      const errorMsg = humanizeMetaError(data, response.status);
      console.error("[WhatsApp] Text send failed:", data?.error?.message || response.status);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    console.log("[WhatsApp] Text sent successfully:", messageId);
    return { success: true, messageId };
  } catch (err: any) {
    console.error("[WhatsApp] Network error:", err.message);
    return { success: false, error: err.message };
  }
}

export async function testWhatsAppConnection(
  config: WhatsAppConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.phoneNumberId || !config.accessToken) {
    return { success: false, message: "Phone Number ID and Access Token are required" };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = humanizeMetaError(data, response.status);
      return { success: false, message: `Connection failed: ${errorMsg}` };
    }

    const displayName = data?.verified_name || data?.display_phone_number || "Connected";
    return { success: true, message: `Connected successfully! WhatsApp Business: ${displayName}` };
  } catch (err: any) {
    return { success: false, message: `Network error: ${err.message}` };
  }
}

export function getWhatsAppConfigFromSettings(
  settings: { settingKey: string; settingValue: string | null }[]
): WhatsAppConfig {
  const get = (key: string) => settings.find(s => s.settingKey === key)?.settingValue || "";
  return {
    phoneNumberId: get("wa_phone_number_id"),
    accessToken: get("wa_access_token"),
    enabled: get("wa_enabled") === "true",
    templateName: get("wa_template_appointment") || "appointment_confirmation",
  };
}

export function formatPhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}
