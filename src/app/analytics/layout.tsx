import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description: "View site analytics and usage stats for BirdieBets",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
