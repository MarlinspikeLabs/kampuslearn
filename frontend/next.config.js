/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds within the development VPS's 1 GB RAM budget.
  experimental: { cpus: 1 },
  images: {
    domains: ['192.168.40.4', 'localhost'],
  },
};

module.exports = nextConfig;
