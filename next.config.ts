import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * @libsql/client resolves a platform-specific native binding at runtime.
   * Keeping it external stops the bundler from rewriting those requires.
   */
  serverExternalPackages: ["@libsql/client"],
  // `npm run package` copies this self-contained server into a zip.
  output: "standalone",
  /**
   * Files read from disk at runtime, plus the libSQL driver and its optional
   * native binding. Next does not trace optional dependencies of an external
   * package, and Vercel needs the Linux binding inside the function bundle.
   * Paths are relative to the project root; absolute includes make Next create
   * a literal `C:\…` folder inside `.next/standalone`.
   */
  outputFileTracingIncludes: {
    "/*": [
      "./drizzle/**/*",
      "./content/**/*",
      "./node_modules/@libsql/**/*",
      "./node_modules/libsql/**/*",
      "./node_modules/@neon-rs/**/*",
      "./node_modules/detect-libc/**/*",
      "./node_modules/isomorphic-ws/**/*",
      "./node_modules/js-base64/**/*",
      "./node_modules/promise-limit/**/*",
    ],
  },
  /**
   * Never trace local state or previous package output into the standalone
   * build. The app resolves its data folder at runtime (see lib/db/index.ts),
   * so nothing should reference it, but this keeps a stray `data/` or `dist/`
   * folder out if tracing ever picks one up. Keep the patterns relative; Next
   * resolves them against the project root.
   *
   * Do not use `"**"` as the key here: Next 15 treats it as a global ignore
   * and drops most of the server trace.
   */
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./dist/**/*"],
  },
};

export default nextConfig;
