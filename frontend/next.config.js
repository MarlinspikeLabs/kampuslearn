/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['192.168.40.4', 'localhost'],
  },
};

module.exports = nextConfig;
