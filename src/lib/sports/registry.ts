import type { SportConfig } from "./types";
import type { SportType } from "@/types";
import { golfConfig } from "./golf";
import { footballConfig } from "./football";

/**
 * Sport config registry. Maps SportType to its adapter.
 *
 * To add a new sport:
 * 1. Create src/lib/sports/{sport}.ts implementing SportConfig
 * 2. Add it to this map
 * 3. Add the sport type to SportType in src/types/index.ts
 * That's it. All pages and components use getSportConfig() automatically.
 */
const SPORT_CONFIGS: Record<string, SportConfig> = {
  golf: golfConfig,
  football: footballConfig,
};

/**
 * Get the sport config for a party. Defaults to golf for backward compatibility
 * (existing parties without a sportType field).
 */
export function getSportConfig(sportType?: SportType): SportConfig {
  return SPORT_CONFIGS[sportType || "golf"] || golfConfig;
}

/** Get all registered sport configs */
export function getAllSportConfigs(): SportConfig[] {
  return Object.values(SPORT_CONFIGS);
}

// Re-export types for convenience
export type { SportConfig } from "./types";
