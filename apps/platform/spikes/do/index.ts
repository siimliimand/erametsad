export { CounterDO } from './counter'
import type { CounterDO } from './counter'

interface Env {
  COUNTER: DurableObjectNamespace<CounterDO>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/counter/')) {
      return new Response('routes: /counter/increment /counter/value /counter/echo\n', {
        status: 404,
      })
    }
    const stub = env.COUNTER.get(env.COUNTER.idFromName('default'))
    const target = new URL(request.url)
    target.pathname = pathname.replace(/^\/counter/, '') || '/value'
    return stub.fetch(new Request(target, request))
  },
}
