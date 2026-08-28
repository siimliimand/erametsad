import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { withPayload } from '@payloadcms/next/withPayload'
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
}

export default async () => {
  if (process.env.NODE_ENV === 'development') {
    await initOpenNextCloudflareForDev()
  }
  return withPayload(nextConfig)
}