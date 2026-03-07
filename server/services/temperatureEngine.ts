import { db, pool } from "../db";
import { leads, temperatureLogs, activities } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const TEMPERATURE_LEVELS = ["Cold", "Warm", "Warm+", "Warm++", "Hot", "Very Hot"] as const;
type Temperature = typeof TEMPERATURE_LEVELS[number] | "Dormant";

const TEMPERATURE_ORDER: Record<string, number> = {
  "Cold": 0,
  "Warm": 1,
  "Warm+": 2,
  "Warm++": 3,
  "Hot": 4,
  "Very Hot": 5,
};

const EVENT_TEMPERATURE_MAP: Record<string, Temperature> = {
  "Appointment Booked": "Warm",
  "Consultation Done": "Warm+",
  "Estimate Shared": "Warm++",
  "Insurance Approved": "Hot",
  "Advance Received": "Very Hot",
};

function getTemperatureIndex(temp: string): number {
  return TEMPERATURE_ORDER[temp] ?? 0;
}

function downgradeTemperature(current: string): Temperature {
  const idx = getTemperatureIndex(current);
  if (idx <= 0) return "Cold";
  return TEMPERATURE_LEVELS[idx - 1];
}

export async function computeAndUpdateTemperature(
  leadId: number,
  tenantId: number,
  triggerEvent: string,
  changedBy: string,
  referenceId?: number,
  referenceType?: string,
): Promise<{ previousTemperature: string; newTemperature: string }> {
  const [lead] = await db.select().from(leads).where(
    and(eq(leads.id, leadId), eq(leads.tenantId, tenantId))
  );
  if (!lead) throw new Error("Lead not found");

  const previousTemperature = lead.leadTemperature || "Cold";
  let newTemperature: Temperature;

  if (triggerEvent === "Reschedule 2+" || triggerEvent === "No Show") {
    newTemperature = downgradeTemperature(previousTemperature);
  } else if (triggerEvent === "Dormant") {
    newTemperature = "Dormant";
  } else if (EVENT_TEMPERATURE_MAP[triggerEvent]) {
    const targetTemp = EVENT_TEMPERATURE_MAP[triggerEvent];
    const targetIdx = getTemperatureIndex(targetTemp);
    const currentIdx = getTemperatureIndex(previousTemperature);
    newTemperature = targetIdx > currentIdx ? targetTemp : previousTemperature as Temperature;
  } else {
    return { previousTemperature, newTemperature: previousTemperature };
  }

  if (newTemperature === previousTemperature) {
    return { previousTemperature, newTemperature: previousTemperature };
  }

  await db.update(leads).set({
    leadTemperature: newTemperature,
    temperatureLastUpdatedAt: new Date(),
    lastActivityAt: new Date(),
  }).where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

  await db.insert(temperatureLogs).values({
    tenantId,
    leadId,
    previousTemperature,
    newTemperature,
    triggerEvent,
    referenceId: referenceId || null,
    referenceType: referenceType || null,
    changedBy,
  });

  await db.insert(activities).values({
    tenantId,
    leadId,
    type: "temperature_change",
    description: `Temperature changed from ${previousTemperature} to ${newTemperature} (${triggerEvent})`,
    createdBy: changedBy,
    metadata: { previousTemperature, newTemperature, triggerEvent, referenceId, referenceType },
  });

  return { previousTemperature, newTemperature };
}

export async function checkDormantLeads(tenantId: number, dormantDays: number = 7): Promise<number> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - dormantDays);

  const result = await pool.query(
    `SELECT id FROM leads
     WHERE tenant_id = $1
     AND lead_temperature != 'Dormant'
     AND status NOT IN ('Closed Won', 'Closed Lost', 'Unqualified', 'Nurture',
                         'Appointment Booked', 'Reminder Running', 'Consultation Done')
     AND NOT EXISTS (
       SELECT 1 FROM appointments a
       WHERE a.lead_id = leads.id AND a.tenant_id = $1
       AND a.status IN ('Scheduled', 'Confirmed')
       AND a.appointment_date >= CURRENT_DATE
     )
     AND (last_activity_at IS NULL OR last_activity_at < $2)
     AND (last_contact_at IS NULL OR last_contact_at < $2)
     AND created_at < $2`,
    [tenantId, thresholdDate]
  );

  let count = 0;
  for (const row of result.rows) {
    try {
      await computeAndUpdateTemperature(row.id, tenantId, "Dormant", "system");
      count++;
    } catch {}
  }
  return count;
}
