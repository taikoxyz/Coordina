import type { NextConfig } from 'next'

const optimize = process.env.OPTIMIZE === '1'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://localhost:8080'}/api/:path*`,
      },
    ]
  },
  webpack(config) {
    if (!optimize) {
      config.optimization.minimize = false
    }
    return config
  },
}

export default nextConfig
