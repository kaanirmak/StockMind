import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.105', 'localhost', '127.0.0.1'],
  // Enable gzip/brotli compression to reduce Fast Origin Transfer bandwidth
  compress: true,
  // Remove X-Powered-By header (minor security + bandwidth improvement)
  poweredByHeader: false,
};

export default nextConfig;
