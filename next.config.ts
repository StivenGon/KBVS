import type { NextConfig } from "next";

const envAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Accept common private-network hosts so dev works on Wi-Fi LAN even when the host IP changes.
  allowedDevOrigins: Array.from(
    new Set([
      "0.0.0.0",
      "127.0.0.1",
      "10.*.*.*",
      "172.*.*.*",
      "192.168.*.*",
      "*.local",
      ...envAllowedDevOrigins,
    ]),
  ),
};

export default nextConfig;
