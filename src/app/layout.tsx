import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: {
    default: "PintPicks",
    template: "%s | PintPicks",
  },
  description: "Pick your players, track the action, compete with friends",
  openGraph: {
    title: "PintPicks",
    description: "Pick your players, track the action, compete with friends",
    type: "website",
    siteName: "PintPicks",
  },
  twitter: {
    card: "summary",
    title: "PintPicks",
    description: "Pick your players, track the action, compete with friends",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <OfflineIndicator />
      </body>
    </html>
  );
}
