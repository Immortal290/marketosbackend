/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.pollinations.ai" }],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
