import { env, runInDurableObject } from 'cloudflare:test'
import { expect, test } from 'vitest'
import { CounterDO } from './counter'

type UpgradedResponse = Response & { webSocket?: WebSocket }
type ServerSideWebSocket = WebSocket & { accept(): void }

function json(response: Promise<Response>): Promise<{ count: number }> {
  return response.then((r) => r.json()) as Promise<{ count: number }>
}

test('counter increments and persists across stub instances', async () => {
  const id = env.COUNTER.idFromName('persist')
  const first = await json(env.COUNTER.get(id).fetch('https://spike/increment'))
  const second = await json(env.COUNTER.get(id).fetch('https://spike/increment'))
  const value = await json(env.COUNTER.get(id).fetch('https://spike/value'))
  expect([first.count, second.count, value.count]).toEqual([1, 2, 2])
})

test('object names isolate state', async () => {
  await json(env.COUNTER.get(env.COUNTER.idFromName('isolate-a')).fetch('https://spike/increment'))
  await json(env.COUNTER.get(env.COUNTER.idFromName('isolate-a')).fetch('https://spike/increment'))
  const b = await json(env.COUNTER.get(env.COUNTER.idFromName('isolate-b')).fetch('https://spike/value'))
  expect(b.count).toBe(0)
})

test('runInDurableObject reaches the live instance', async () => {
  const stub = env.COUNTER.get(env.COUNTER.idFromName('inspect'))
  await json(stub.fetch('https://spike/increment'))
  const stored = await runInDurableObject(stub, (instance: CounterDO) => instance.currentValue())
  expect(stored).toBe(1)
})

test('websocket echo round-trips a message', async () => {
  const response = (await env.COUNTER
    .get(env.COUNTER.idFromName('echo'))
    .fetch('https://spike/echo', {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    })) as UpgradedResponse

  expect(response.status).toBe(101)
  const ws = response.webSocket as ServerSideWebSocket | undefined
  expect(ws).toBeDefined()
  ws!.accept()

  const received = new Promise<unknown>((resolve) => {
    ws!.addEventListener('message', (event) => resolve((event as MessageEvent).data))
  })
  ws!.send('tere')
  expect(await received).toBe('tere')
  ws!.close()
})
