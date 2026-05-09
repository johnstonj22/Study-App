import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Next's workspace root to this project so a stray lockfile in the
  // user's home directory doesn't get picked up.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
