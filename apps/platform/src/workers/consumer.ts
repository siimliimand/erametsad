// Queue-consumer Worker entry. This is a SEPARATE Worker from the OpenNext
// app shim (src/do/index.ts): wrangler cannot statically detect the `queue`
// export through the shim's re-export chain, so consumer registration failed
// on main-worker deploys (code 11001). Deploy with:
//   pnpm exec wrangler deploy -c src/workers/wrangler.jsonc
import { queue } from './queue-consumer'
import type { QueueConsumerEnv, QueueExecutionContext, QueueMessageBatch } from './types'

export default {
  async queue(
    batch: QueueMessageBatch,
    env: QueueConsumerEnv,
    ctx: QueueExecutionContext,
  ): Promise<void> {
    return queue(batch, env, ctx)
  },
}
