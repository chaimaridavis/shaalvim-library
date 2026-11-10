import type { NextConfig } from "next";

// Every page depends on who is signed in, so pages are rendered fresh on each
// visit. That is why Cache Components is left off.
const nextConfig: NextConfig = {
  images: {
    // Book covers come from the catalogs, which can take seconds per picture.
    // Vercel fetches each one once, shrinks it and keeps a copy for a month.
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org", pathname: "/b/**" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
    ],
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
