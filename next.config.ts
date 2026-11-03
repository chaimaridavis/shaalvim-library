import type { NextConfig } from "next";

// Every page depends on who is signed in, so pages are rendered fresh on each
// visit. That is why Cache Components is left off.
const nextConfig: NextConfig = {};

export default nextConfig;
