import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to BirdieBets to track your golf tournament picks",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
