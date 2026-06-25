/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
 
  // ponytail: persistent filesystem cache causes PackFileCacheStrategy corruption
  // on Windows when the dev server is killed abruptly (Ctrl+C, crash, taskkill).
  // Without it, webpack still caches in-memory per session — hot reloads are
  // unaffected. The only cost is ~3-5s slower first compile on cold start.
  // Upgrade path: remove this when Next.js on Windows handles abrupt shutdown
  // without corrupting .next/cache/webpack/.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
