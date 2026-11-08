/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Self-contained server for the AWS container image (Dockerfile).
  output: 'standalone',
};

export default nextConfig;
