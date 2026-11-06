/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Self-contained server for the AWS container image (Dockerfile); ignored by Vercel.
  output: 'standalone',
};

export default nextConfig;
