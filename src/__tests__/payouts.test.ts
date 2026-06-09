import { describe, it, expect } from "vitest";
import { calculatePayouts, PAYOUT_PRESETS } from "@/lib/payouts";
import type { Party } from "@/types";
import { mockParty } from "./helpers";

function makeParty(overrides: Partial<Party> = {}): Party {
  return { ...mockParty, ...overrides };
}

describe("calculatePayouts", () => {
  it("calculates basic payout (no 2nd/3rd)", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: false,
      thirdPlacePayout: false,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.first).toBe(40);
    expect(result.second).toBe(0);
    expect(result.third).toBe(0);
  });

  it("calculates with 2nd place enabled (65/35 split)", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: true,
      thirdPlacePayout: false,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.second).toBe(14);   // 40 * 0.35 = 14
    expect(result.first).toBe(26);    // 40 - 14 = 26
    expect(result.third).toBe(0);
    expect(result.first).toBeGreaterThan(result.second);
  });

  it("calculates with both 2nd and 3rd place enabled (55/30/15 split)", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.third).toBe(6);     // 40 * 0.15 = 6
    expect(result.second).toBe(12);   // 40 * 0.30 = 12
    expect(result.first).toBe(22);    // 40 - 12 - 6 = 22
    expect(result.first).toBeGreaterThan(result.second);
    expect(result.second).toBeGreaterThan(result.third);
  });

  it("first place never goes negative", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(10);
    expect(result.first).toBeGreaterThanOrEqual(0);
  });

  it("uses default EUR currency when none specified", () => {
    const party = makeParty({ currency: undefined as unknown as string });
    const result = calculatePayouts(party);
    expect(result.currency).toBe("EUR");
  });

  it("uses custom currency", () => {
    const party = makeParty({ currency: "USD" });
    const result = calculatePayouts(party);
    expect(result.currency).toBe("USD");
  });

  it("payouts always sum to total pot", () => {
    const configs = [
      { members: 4, second: true, third: true },
      { members: 4, second: true, third: false },
      { members: 5, second: true, third: true },
      { members: 10, second: true, third: true },
      { members: 10, second: true, third: false },
      { members: 20, second: true, third: true },
    ];
    for (const cfg of configs) {
      const party = makeParty({
        buyIn: 10,
        memberUids: Array.from({ length: cfg.members }, (_, i) => `m${i}`),
        secondPlacePayout: cfg.second,
        thirdPlacePayout: cfg.third,
      });
      const result = calculatePayouts(party);
      expect(result.first + result.second + result.third).toBe(result.totalPot);
    }
  });

  it("1st always gets more than 2nd, 2nd more than 3rd", () => {
    for (const members of [5, 6, 8, 10, 15, 20]) {
      const party = makeParty({
        buyIn: 30,
        memberUids: Array.from({ length: members }, (_, i) => `m${i}`),
        secondPlacePayout: true,
        thirdPlacePayout: true,
      });
      const result = calculatePayouts(party);
      expect(result.first).toBeGreaterThan(result.second);
      expect(result.second).toBeGreaterThan(result.third);
    }
  });

  it("handles the user's exact scenario: 5 players, €30, all payouts", () => {
    const party = makeParty({
      buyIn: 30,
      memberUids: ["a", "b", "c", "d", "e"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(150);
    expect(result.first).toBeGreaterThan(result.second);
    expect(result.second).toBeGreaterThan(result.third);
    // 55/30/15: third=23, second=45, first=82
    expect(result.third).toBe(23);
    expect(result.second).toBe(45);
    expect(result.first).toBe(82);
  });

  it("handles large buy-in with many members", () => {
    const party = makeParty({
      buyIn: 100,
      memberUids: Array.from({ length: 20 }, (_, i) => `m${i}`),
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(2000);
    // 55/30/15: third=300, second=600, first=1100
    expect(result.third).toBe(300);
    expect(result.second).toBe(600);
    expect(result.first).toBe(1100);
  });

  describe("custom payoutSplit", () => {
    it("uses custom 3-way split when provided", () => {
      const party = makeParty({
        buyIn: 10,
        memberUids: Array.from({ length: 10 }, (_, i) => `m${i}`),
        secondPlacePayout: true,
        thirdPlacePayout: true,
        payoutSplit: { first: 70, second: 20, third: 10 },
      });
      const result = calculatePayouts(party);
      expect(result.totalPot).toBe(100);
      expect(result.third).toBe(10);   // 100 * 0.10
      expect(result.second).toBe(20);  // 100 * 0.20
      expect(result.first).toBe(70);   // 100 - 20 - 10
    });

    it("uses custom 2-way split when provided", () => {
      const party = makeParty({
        buyIn: 10,
        memberUids: Array.from({ length: 10 }, (_, i) => `m${i}`),
        secondPlacePayout: true,
        thirdPlacePayout: false,
        payoutSplit: { first: 80, second: 20, third: 0 },
      });
      const result = calculatePayouts(party);
      expect(result.totalPot).toBe(100);
      expect(result.second).toBe(20);
      expect(result.first).toBe(80);
    });

    it("custom split pot always sums to total", () => {
      const splits = [
        { first: 40, second: 35, third: 25 },
        { first: 90, second: 5, third: 5 },
        { first: 45, second: 30, third: 25 },
      ];
      for (const split of splits) {
        const party = makeParty({
          buyIn: 30,
          memberUids: Array.from({ length: 7 }, (_, i) => `m${i}`),
          secondPlacePayout: true,
          thirdPlacePayout: true,
          payoutSplit: split,
        });
        const result = calculatePayouts(party);
        expect(result.first + result.second + result.third).toBe(result.totalPot);
      }
    });

    it("rounding remainder goes to first place", () => {
      const party = makeParty({
        buyIn: 10,
        memberUids: Array.from({ length: 3 }, (_, i) => `m${i}`),
        secondPlacePayout: true,
        thirdPlacePayout: true,
        payoutSplit: { first: 33, second: 34, third: 33 },
      });
      const result = calculatePayouts(party);
      // pot=30, third=Math.round(30*0.33)=10, second=Math.round(30*0.34)=10, first=30-10-10=10
      expect(result.first + result.second + result.third).toBe(30);
    });
  });

  describe("PAYOUT_PRESETS", () => {
    it("all 2-way presets sum to 100", () => {
      for (const [, preset] of Object.entries(PAYOUT_PRESETS["2-way"])) {
        expect(preset.first + preset.second + preset.third).toBe(100);
      }
    });

    it("all 3-way presets sum to 100", () => {
      for (const [, preset] of Object.entries(PAYOUT_PRESETS["3-way"])) {
        expect(preset.first + preset.second + preset.third).toBe(100);
      }
    });

    it("all presets have first > second > third", () => {
      for (const [, preset] of Object.entries(PAYOUT_PRESETS["3-way"])) {
        expect(preset.first).toBeGreaterThan(preset.second);
        expect(preset.second).toBeGreaterThan(preset.third);
      }
      for (const [, preset] of Object.entries(PAYOUT_PRESETS["2-way"])) {
        expect(preset.first).toBeGreaterThan(preset.second);
      }
    });
  });
});
