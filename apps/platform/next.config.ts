import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
}

export default async () => {
  // DISABLE_OPENNEXT_DEV=1 runs plain Node dev (API-level verification,
  // e.g. OpenSpec smoke tests) without the OpenNext workerd dev proxy.
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_OPENNEXT_DEV !== '1') {
    await initOpenNextCloudflareForDev()
  }
  return nextConfig
}
