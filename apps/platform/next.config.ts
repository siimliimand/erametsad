import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { withPayload } from '@payloadcms/next/withPayload'
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
  // withPayload externalizes the payload entry packages but not the
  // transitive @next/env. Bundled, its ncc build fails to resolve node
  // builtins ("Can't resolve 'crypto'") during server compilation.
  serverExternalPackages: ['@next/env'],
}

export default async () => {
  // DISABLE_OPENNEXT_DEV=1 runs plain Node dev (API-level verification,
  // e.g. OpenSpec smoke tests). The OpenNext workerd dev proxy bundles
  // server deps and breaks node builtins in transitive payload deps.
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_OPENNEXT_DEV !== '1') {
    await initOpenNextCloudflareForDev()
  }
  return withPayload(nextConfig)
}