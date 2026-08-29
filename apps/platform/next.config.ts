import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
    // Media uploads (5 MiB cap) travel through the upload server action,
    // above the 1 MB default.
    serverActions: { bodySizeLimit: '6mb' },
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
