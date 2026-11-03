import type { NextConfig } from "next";

/** Traced paths are absolute, so exclude patterns must be too. */
const root = process.cwd().replace(/\\/g, "/");

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module: keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // `npm run package` copies this self-contained server into a zip.
  output: "standalone",
  /**
   * Never trace local state or previous package output into the standalone
   * build. Without this, Next embeds `data/app.db` (the live database, with
   * attempts) and any stale `dist/` folder sitting in the project root.
   */
  outputFileTracingExcludes: {
    "*": [`${root}/data/**/*`, `${root}/dist/**/*`],
  },
};

export default nextConfig;
