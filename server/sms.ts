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

export async function sendPasswordResetSMS(
  phone: string,
  userName: string,
  resetLink: string,
  hospitalName: string = "Hospital CRM"
): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !senderId || !templateId) {
    throw new Error("MSG91 is not configured. Missing MSG91_AUTH_KEY, MSG91_SENDER_ID, or MSG91_TEMPLATE_ID.");
  }

  let normalizedPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");
  if (!normalizedPhone.startsWith("91")) {
    normalizedPhone = `91${normalizedPhone}`;
  }

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
