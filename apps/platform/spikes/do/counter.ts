type WorkerWebSocket = WebSocket & { accept(): void }

export class CounterDO implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/increment') return this.increment()
    if (pathname === '/value') return this.value()
    if (pathname === '/echo') return this.echo(request)
    return new Response('routes: /increment /value /echo\n', { status: 404 })
  }

  async currentValue(): Promise<number> {
    return (await this.state.storage.get<number>('count')) ?? 0
  }

  private async increment(): Promise<Response> {
    const next = (await this.currentValue()) + 1
    await this.state.storage.put('count', next)
    return Response.json({ count: next })
  }

  private async value(): Promise<Response> {
    return Response.json({ count: await this.currentValue() })
  }

  private echo(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('websocket upgrade required', { status: 426 })
    }
    const pair = new WebSocketPair()
    const server = pair[1] as WorkerWebSocket
    server.accept()
    server.addEventListener('message', (event) => {
      server.send((event as MessageEvent).data as string)
    })
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit)
  }
}
