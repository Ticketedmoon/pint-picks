import type { Party } from "@/types";

export interface Payouts {
  totalPot: number;
  first: number;
  second: number;
  third: number;
  currency: string;
}

/** Preset split configurations. Values are percentages that sum to 100. */
export const PAYOUT_PRESETS = {
  "2-way": {
    "winner-takes-more": { label: "Winner takes more", first: 65, second: 35, third: 0 },
    "balanced": { label: "Balanced", first: 55, second: 45, third: 0 },
    "winner-takes-most": { label: "Winner takes most", first: 75, second: 25, third: 0 },
  },
  "3-way": {
    "winner-takes-more": { label: "Winner takes more", first: 55, second: 30, third: 15 },
    "balanced": { label: "Balanced", first: 45, second: 30, third: 25 },
    "winner-takes-most": { label: "Winner takes most", first: 65, second: 25, third: 10 },
  },
} as const;

export type PayoutPresetKey = "winner-takes-more" | "balanced" | "winner-takes-most" | "custom";

/**
 * Calculate payouts for a party.
 *
 * Uses party.payoutSplit if set (custom percentages), otherwise falls back
 * to "winner-takes-more" defaults: 65/35 for 2-way, 55/30/15 for 3-way.
 *
 * All amounts are rounded to the nearest euro. Any rounding remainder
 * goes to 1st place so the pot always adds up exactly.
 */
export function calculatePayouts(party: Party): Payouts {
  const pot = party.buyIn * party.memberUids.length;

  let first: number;
  let second = 0;
  let third = 0;

  if (party.thirdPlacePayout && party.secondPlacePayout) {
    const split = party.payoutSplit || { first: 55, second: 30, third: 15 };
    third = Math.round(pot * split.third / 100);
    second = Math.round(pot * split.second / 100);
    first = pot - second - third;
  } else if (party.secondPlacePayout) {
    const split = party.payoutSplit || { first: 65, second: 35, third: 0 };
    second = Math.round(pot * split.second / 100);
    first = pot - second;
  } else {
    first = pot;
  }

  return {
    totalPot: pot,
    first: Math.max(first, 0),
    second,
    third,
    currency: party.currency || "EUR",
  };
}
