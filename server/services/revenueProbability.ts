import { db, pool } from "../db";
import { episodes, revenueProbabilityConfig } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_PROBABILITY_MAP: Record<string, number> = {
  "Consultation Done": 30,
  "Estimate Shared": 45,
  "Insurance Approved": 70,
  "Surgery Scheduled": 85,
  "Advance Received": 95,
  "Treatment Planning": 40,
  "Surgery Done": 90,
  "In Treatment": 90,
  "Post Care": 95,
  "Follow Up": 50,
  "Completed": 100,
};

export async function computeRevenueProbability(
  episodeId: number,
  tenantId: number,
): Promise<{ probability: number; expectedRevenue: number }> {
  const [episode] = await db.select().from(episodes).where(
    and(eq(episodes.id, episodeId), eq(episodes.tenantId, tenantId))
  );
  if (!episode) throw new Error("Episode not found");

  const configs = await db.select().from(revenueProbabilityConfig).where(
    and(eq(revenueProbabilityConfig.tenantId, tenantId), eq(revenueProbabilityConfig.status, "Active"))
  );

  const configMap: Record<string, number> = {};
  for (const c of configs) {
    configMap[c.stageName] = c.probability;
  }

  let baseProbability = configMap[episode.status] ?? DEFAULT_PROBABILITY_MAP[episode.status] ?? 30;

  if (episode.estimateShared) {
    const estimateProb = configMap["Estimate Shared"] ?? DEFAULT_PROBABILITY_MAP["Estimate Shared"] ?? 45;
    baseProbability = Math.max(baseProbability, estimateProb);
  }

  if (episode.insuranceApplicable && episode.preauthStatusId) {
    const result = await pool.query(
      `SELECT name FROM preauth_statuses WHERE id = $1 AND tenant_id = $2`,
      [episode.preauthStatusId, tenantId]
    );
    const statusName = result.rows[0]?.name || "";
    if (statusName.toLowerCase().includes("approved")) {
      const insuranceProb = configMap["Insurance Approved"] ?? DEFAULT_PROBABILITY_MAP["Insurance Approved"] ?? 70;
      baseProbability = Math.max(baseProbability, insuranceProb);
    }
  }

  if (episode.advanceReceivedAmount && episode.advanceReceivedAmount > 0) {
    const advanceProb = configMap["Advance Received"] ?? DEFAULT_PROBABILITY_MAP["Advance Received"] ?? 95;
    baseProbability = Math.max(baseProbability, advanceProb);
  }

  const estimatedCost = episode.finalEstimatedAmount || episode.estimatedCost || 0;
  const expectedRevenue = baseProbability > 0 ? estimatedCost : 0;

  await db.update(episodes).set({
    revenueProbability: baseProbability,
    expectedRevenueAmount: expectedRevenue,
  }).where(and(eq(episodes.id, episodeId), eq(episodes.tenantId, tenantId)));

  return { probability: baseProbability, expectedRevenue };
}

export async function seedDefaultProbabilityConfig(tenantId: number): Promise<void> {
  const existing = await db.select().from(revenueProbabilityConfig).where(
    eq(revenueProbabilityConfig.tenantId, tenantId)
  );
  if (existing.length > 0) return;

  const defaults = Object.entries(DEFAULT_PROBABILITY_MAP);
  for (let i = 0; i < defaults.length; i++) {
    const [stage, prob] = defaults[i];
    await db.insert(revenueProbabilityConfig).values({
      tenantId,
      stageName: stage,
      probability: prob,
      displayOrder: i,
      status: "Active",
    });
  }
}
