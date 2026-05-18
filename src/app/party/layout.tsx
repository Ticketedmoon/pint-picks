import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Party",
  description: "Track your golf tournament picks and compete on the leaderboard",
};

export default function PartyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
