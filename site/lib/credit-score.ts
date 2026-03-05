import type { RegistryAgent } from "@/lib/registry";
import type { AgentReputation } from "@/lib/registry";

export type CreditTier = "new" | "bronze" | "silver" | "gold" | "platinum";

export interface CreditScore {
  score: number;
  tier: CreditTier;
  label: string;
  breakdown: {
    qualityScore: number;
    feedbackScore: number;
    longevityScore: number;
  };
  listingFeeBps: number;
  escrowFree: boolean;
  insurancePool: boolean;
}

const LONGEVITY_MAX: Record<string, number> = {
  sepolia: 7200 * 180,             // 1,296,000
  filecoinCalibration: 2880 * 180, // 518,400
};

export function computeCreditScore(
  agent: RegistryAgent & { reputation?: AgentReputation }
): CreditScore {
  const rep = agent.reputation;

  // Quality: 0–500 (averageScore is 0–100 scale)
  const qualityScore =
    rep && rep.averageScore !== null
      ? Math.round((rep.averageScore / 100) * 500)
      : 0;

  // Feedback volume: 0–300 (caps at 30 reviews)
  const feedbackScore = rep
    ? Math.round(Math.min(rep.totalFeedback, 30) / 30 * 300)
    : 0;

  // Longevity: 0–200
  const bn = Number(agent.blockNumber ?? "0");
  const maxBn = LONGEVITY_MAX[agent.networkId] ?? LONGEVITY_MAX.sepolia;
  const longevityScore =
    bn === 0 ? 0 : Math.round(Math.min(bn, maxBn) / maxBn * 200);

  const score = qualityScore + feedbackScore + longevityScore;

  let tier: CreditTier;
  let label: string;
  let listingFeeBps: number;
  let escrowFree: boolean;
  let insurancePool: boolean;

  if (score >= 850) {
    tier = "platinum"; label = "Platinum"; listingFeeBps = 50; escrowFree = true; insurancePool = true;
  } else if (score >= 650) {
    tier = "gold"; label = "Gold"; listingFeeBps = 100; escrowFree = true; insurancePool = false;
  } else if (score >= 400) {
    tier = "silver"; label = "Silver"; listingFeeBps = 250; escrowFree = false; insurancePool = false;
  } else if (score >= 100) {
    tier = "bronze"; label = "Bronze"; listingFeeBps = 350; escrowFree = false; insurancePool = false;
  } else {
    tier = "new"; label = "New"; listingFeeBps = 500; escrowFree = false; insurancePool = false;
  }

  return {
    score,
    tier,
    label,
    breakdown: { qualityScore, feedbackScore, longevityScore },
    listingFeeBps,
    escrowFree,
    insurancePool,
  };
}
