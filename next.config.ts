import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin (server-only) pulls jwks-rsa → jose, which is ESM-only.
  // Bundling it makes the bundler emit a CJS require() of jose and crash with
  // ERR_REQUIRE_ESM. Marking it external lets Node load it natively (Node 22
  // supports require(ESM)), which is the supported way to use the Admin SDK.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
