import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  allowedDevOrigins: [
    '*.e2b.dev',
    '*.e2b.app',
    '*.preview-blink.com',
    '*.sites.blink.new',
    '*.blink.new',
  ],
}

export default nextConfig
