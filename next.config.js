/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ssh2 ships a native .node binary that webpack cannot bundle — keep it as
  // an external require so the Panel Hosting route can use it at runtime.
  serverComponentsExternalPackages: ['ssh2'],
  experimental: {
    serverComponentsExternalPackages: ['ssh2'],
  },
  async headers() {
    return [
      {
        // Global security headers
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // API surface: no caching (dynamic data)
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
