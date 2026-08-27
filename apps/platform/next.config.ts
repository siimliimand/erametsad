import { withPayload } from '@payloadcms/next'
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
}

export default withPayload(nextConfig)