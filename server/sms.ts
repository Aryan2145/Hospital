export interface SmsResult {
  success: boolean;
  message: string;
  requestId?: string;
}

export function isMSG91Configured(): boolean {
  return !!(
    process.env.MSG91_AUTH_KEY &&
    process.env.MSG91_SENDER_ID &&
    process.env.MSG91_TEMPLATE_ID
  );
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\s+/g, "").replace(/^\+/, "");
  if (!normalized.startsWith("91")) {
    normalized = `91${normalized}`;
  }
  return normalized;
}

export async function sendPasswordResetSMS(
  phone: string,
  userName: string,
  resetLink: string,
  hospitalName: string = "RGB Hospital CRM"
): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !senderId || !templateId) {
    throw new Error("MSG91 is not configured. Missing MSG91_AUTH_KEY, MSG91_SENDER_ID, or MSG91_TEMPLATE_ID.");
  }

  const normalizedPhone = normalizePhone(phone);

  const payload = {
    template_id: templateId,
    sender: senderId,
    short_url: "1",
    recipients: [
      {
        mobiles: normalizedPhone,
        name: userName,
        reset_link: resetLink,
        hospital_name: hospitalName,
      },
    ],
  };

  console.log(`[sms] Sending password reset SMS to ${normalizedPhone} via MSG91`);

  const response = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "authkey": authKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { message: responseText };
  }

  if (!response.ok) {
    console.error(`[sms] MSG91 error: status=${response.status}, body=${responseText}`);
    throw new Error(`SMS send failed: ${responseData.message || response.statusText}`);
  }

  if (responseData.type === "error") {
    console.error(`[sms] MSG91 returned error: ${responseData.message}`);
    throw new Error(`SMS send failed: ${responseData.message}`);
  }

  console.log(`[sms] SMS sent successfully to ${normalizedPhone}, requestId=${responseData.request_id || "N/A"}`);

  return {
    success: true,
    message: "SMS sent successfully",
    requestId: responseData.request_id,
  };
}

export interface DiscountApprovalSmsParams {
  phone: string;
  approverName: string;
  requestedBy: string;
  patientName: string;
  episodeId: number;
  discountPercent: number;
  discountAmount: number;
  hospitalName?: string;
}

/**
 * Send a discount approval notification SMS to a CRM user.
 * Uses MSG91_DISCOUNT_TEMPLATE_ID if set (recommended for DLT compliance),
 * otherwise falls back to simple transactional route via sendhttp.php.
 * Silently skips if MSG91 is not configured.
 */
export async function sendDiscountApprovalSMS(params: DiscountApprovalSmsParams): Promise<SmsResult | null> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;

  if (!authKey || !senderId) {
    console.log("[sms] MSG91 not configured — skipping discount approval SMS");
    return null;
  }

  const normalizedPhone = normalizePhone(params.phone);
  const formattedAmount = `Rs.${params.discountAmount.toLocaleString("en-IN")}`;
  const displayName = params.hospitalName || "Hospital CRM";

  const discountTemplateId = process.env.MSG91_DISCOUNT_TEMPLATE_ID;

  if (discountTemplateId) {
    const payload = {
      template_id: discountTemplateId,
      sender: senderId,
      short_url: "0",
      recipients: [
        {
          mobiles: normalizedPhone,
          name: params.approverName || "Approver",
          patient_name: params.patientName,
          episode_id: String(params.episodeId),
          discount_percent: String(params.discountPercent),
          discount_amount: formattedAmount,
          requested_by: params.requestedBy,
          hospital_name: displayName,
        },
      ],
    };

    console.log(`[sms] Sending discount approval SMS (template flow) to ${normalizedPhone}`);

    const response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData: any;
    try { responseData = JSON.parse(responseText); } catch { responseData = { message: responseText }; }

    if (!response.ok || responseData.type === "error") {
      console.error(`[sms] Discount approval SMS (template) failed: ${responseText}`);
      throw new Error(`SMS send failed: ${responseData.message || response.statusText}`);
    }

    console.log(`[sms] Discount approval SMS sent to ${normalizedPhone}, requestId=${responseData.request_id || "N/A"}`);
    return { success: true, message: "SMS sent successfully", requestId: responseData.request_id };
  }

  // Fallback: plain transactional SMS via MSG91 v2 sendhttp
  const messageText = `Discount Approval Required (${displayName}): ${params.requestedBy} requested ${params.discountPercent}% (${formattedAmount}) discount for ${params.patientName} (Episode #${params.episodeId}). Login to CRM to review.`;

  const params91 = new URLSearchParams({
    authkey: authKey,
    mobiles: normalizedPhone,
    message: messageText,
    sender: senderId,
    route: "4",
    country: "91",
  });

  console.log(`[sms] Sending discount approval SMS (transactional) to ${normalizedPhone}`);

  const response = await fetch(`https://api.msg91.com/api/sendhttp.php?${params91.toString()}`, {
    method: "GET",
  });

  const responseText = await response.text();

  if (!response.ok || responseText.startsWith("error")) {
    console.error(`[sms] Discount approval SMS (transactional) failed: ${responseText}`);
    throw new Error(`SMS send failed: ${responseText}`);
  }

  console.log(`[sms] Discount approval SMS sent to ${normalizedPhone}, response=${responseText.substring(0, 80)}`);
  return { success: true, message: "SMS sent successfully" };
}
