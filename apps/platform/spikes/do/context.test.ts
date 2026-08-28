import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createExecutionContext, env } from 'cloudflare:test'
import { expect, test } from 'vitest'

const cloudflareContextSymbol = Symbol.for('__cloudflare-context__')

function json(response: Promise<Response>): Promise<{ count: number }> {
  return response.then((r) => r.json()) as Promise<{ count: number }>
}

test('getCloudflareContext() exposes the Durable Object binding', async () => {
  const globals = globalThis as unknown as Record<symbol, unknown>
  globals[cloudflareContextSymbol] = {
    env,
    cf: undefined,
    ctx: createExecutionContext(),
  }

  const context = getCloudflareContext()
  expect(context.ctx).toBeDefined()

  const counter = context.env.COUNTER
  expect(counter).toBeDefined()

  const id = counter!.idFromName('via-opennext-context')
  const first = await json(counter!.get(id).fetch('https://spike/increment'))
  const second = await json(counter!.get(id).fetch('https://spike/increment'))
  expect([first.count, second.count]).toEqual([1, 2])
})

test('getCloudflareContext() throws when no context was initialized', () => {
  const globals = globalThis as unknown as Record<symbol, unknown>
  const previous = globals[cloudflareContextSymbol]
  delete globals[cloudflareContextSymbol]
  expect(() => getCloudflareContext()).toThrow()
  globals[cloudflareContextSymbol] = previous
})
