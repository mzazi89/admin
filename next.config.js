/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ssh2 ships a native .node binary that webpack cannot bundle — keep it as
  // an external require so the Panel Hosting route can use it at runtime.
  serverComponentsExternalPackages: ['ssh2'],
  experimental: {
    serverComponentsExternalPackages: ['ssh2'],
  },
  // data/bot-commands.json is read at runtime with fs.readFileSync(path.join(
  // process.cwd(), 'data', ...)) — by the Sync from seed route and by the
  // first-run importer in lib/database.js. A path assembled at runtime is
  // invisible to Next's file tracer, so a serverless build ships WITHOUT the file
  // and both readers do nothing at all. Locally it works, because cwd is the repo
  // — which is exactly why this is easy to miss. Listing it here forces it into
  // the function bundles. initializeDatabase() is called from many routes, so the
  // pattern covers all of them rather than just the sync route.
  outputFileTracingIncludes: {
    '/**/*': ['./data/bot-commands.json'],
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
