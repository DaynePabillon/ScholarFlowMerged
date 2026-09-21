/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/scholar/dashboard', destination: '/dashboard', permanent: true },
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  },
  images: {
    domains: ['lh3.googleusercontent.com'], // For Google profile pictures
  },
  // Skip heavy lint/typecheck during production build (Render free tier has 512MB RAM)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // pdfjs-dist references an optional Node-only 'canvas' dependency used only for
    // server-side rasterizing. We extract PDF *text* in the browser (Rev 5), so this
    // must not be bundled — alias it off to avoid "Module not found: canvas".
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    }
    return config
  },
}

module.exports = nextConfig
