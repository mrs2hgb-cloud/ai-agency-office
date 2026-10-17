import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, for the Docker image. Runs as
  // one long-lived Node process, which the in-memory approval store relies on.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
