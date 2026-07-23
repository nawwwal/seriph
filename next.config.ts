import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Tasks uses runtime module loading that Turbopack must leave to Node.
  // Firebase Admin must stay bundled: its Auth dependency now mixes CJS with
  // ESM, which Vercel's external-module loader cannot execute.
  serverExternalPackages: ["@google-cloud/tasks"],
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  // Shell chrome uses Framer Motion (see lib/motion/catalogDetailStoryboard.ts).
  // View Transitions experimental flag intentionally off.
};

export default nextConfig;
