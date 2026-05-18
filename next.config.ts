import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  /* config options here */
};

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default analyzer(nextConfig);
