import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View and manage your golf betting parties",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
