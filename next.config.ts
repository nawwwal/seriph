import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server SDKs use runtime module loading that Turbopack must leave to Node.
  // Bundling it makes the bundler emit a CJS require() of jose and crash with
  // ERR_REQUIRE_ESM. Marking it external lets Node load it natively (Node 22
  // supports require(ESM)), which is the supported way to use these SDKs.
  serverExternalPackages: ["firebase-admin", "@google-cloud/tasks"],
  // Shell chrome uses Framer Motion (see lib/motion/catalogDetailStoryboard.ts).
  // View Transitions experimental flag intentionally off.
};

export default nextConfig;
