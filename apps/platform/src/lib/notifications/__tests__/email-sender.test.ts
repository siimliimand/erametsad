import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

import {
  sendEmail,
  setEmailBindingForTests,
  marketingEmailHeaders,
  type EmailSenderBinding,
} from '../email-sender'

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn()
  const createTransport = vi.fn(() => ({ sendMail }))
  return { sendMailMock: sendMail, createTransportMock: createTransport }
})

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}))

const fetchMock = vi.fn()

const ENV_KEYS = [
  'CLOUDFLARE_EMAIL_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
] as const

const savedEnv: Record<string, string | undefined> = {}

function apiResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeBinding(send: EmailSenderBinding['send']): EmailSenderBinding {
  return { send }
}

const baseMessage = {
  subject: 'Oksjon on lõppenud',
  html: '<p>Oksjon lõppes.</p>',
}

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
})

beforeEach(() => {
  vi.clearAllMocks()
  // The module treats every variable by truthiness, so '' reads as unset.
  for (const key of ENV_KEYS) process.env[key] = ''
  process.env.SMTP_HOST = '127.0.0.1'
  process.env.SMTP_PORT = '1025'
  setEmailBindingForTests(null)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  setEmailBindingForTests(null)
  vi.unstubAllGlobals()
  for (const key of ENV_KEYS) process.env[key] = savedEnv[key] ?? ''
})

describe('sendEmail transport chain', () => {
  it('sends through the EMAIL binding when available', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'binding-1' })
    setEmailBindingForTests(makeBinding(send))

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result).toEqual({
      success: true,
      transport: 'email-binding',
      messageId: 'binding-1',
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('normalizes a single recipient and applies the default sender', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    setEmailBindingForTests(makeBinding(send))

    await sendEmail({ to: ' user@example.ee ', ...baseMessage })

    expect(send).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
    })
  })

  it('falls back to the REST API when the binding send rejects', async () => {
    setEmailBindingForTests(
      makeBinding(vi.fn().mockRejectedValue(new Error('binding failed'))),
    )
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(200, {
        success: true,
        result: {
          delivered: ['user@example.ee'],
          queued: [],
          permanent_bounces: [],
          message_id: 'api-1',
        },
      }),
    )

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result).toEqual({
      success: true,
      transport: 'cloudflare-api',
      messageId: 'api-1',
    })
  })

  it('calls the Cloudflare send endpoint with bearer auth and the message body', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(200, {
        success: true,
        result: { delivered: ['user@example.ee'], queued: [], message_id: 'api-1' },
      }),
    )

    const result = await sendEmail({ to: ['user@example.ee'], ...baseMessage })

    expect(result.transport).toBe('cloudflare-api')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc-1/email/sending/send',
    )
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-1')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
    })
  })

  it('falls back to SMTP when the API responds with an error status', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(429, {
        success: false,
        errors: [{ code: 1420, message: 'daily limit exceeded' }],
      }),
    )
    sendMailMock.mockResolvedValue({ messageId: '<smtp-1@mailpit>' })

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result).toEqual({
      success: true,
      transport: 'smtp',
      messageId: '<smtp-1@mailpit>',
    })
  })

  it('returns the last transport failure when nothing succeeds', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(apiResponse(500, {}))
    process.env.SMTP_HOST = ''

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result.success).toBe(false)
    expect(result.transport).toBe('cloudflare-api')
    expect(result.error?.code).toBe('E_HTTP_500')
  })

  it('sends through SMTP when only SMTP is configured (next dev Mailpit)', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<smtp-1@mailpit>' })

    const result = await sendEmail({ to: ['user@example.ee'], ...baseMessage })

    expect(result).toEqual({
      success: true,
      transport: 'smtp',
      messageId: '<smtp-1@mailpit>',
    })
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
    })
  })

  it('honors a custom from address', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<smtp-2@mailpit>' })

    await sendEmail({
      to: 'user@example.ee',
      from: 'teavitus@erametsad.ww0.dev',
      ...baseMessage,
    })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'teavitus@erametsad.ww0.dev' }),
    )
  })

  it('surfaces the error code of a failing SMTP transport', async () => {
    sendMailMock.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1025'), {
        code: 'ECONNREFUSED',
      }),
    )

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result.success).toBe(false)
    expect(result.transport).toBe('smtp')
    expect(result.error?.code).toBe('ECONNREFUSED')
    expect(result.error?.message).toBe('connect ECONNREFUSED 127.0.0.1:1025')
  })

  it('treats a queued-only API response as success', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(200, {
        success: true,
        result: { delivered: [], queued: ['user@example.ee'], message_id: 'q-1' },
      }),
    )

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result).toEqual({
      success: true,
      transport: 'cloudflare-api',
      messageId: 'q-1',
    })
  })

  it('falls through to SMTP when every API recipient permanently bounces', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(200, {
        success: true,
        result: {
          delivered: [],
          queued: [],
          permanent_bounces: ['user@example.ee'],
          message_id: 'b-1',
        },
      }),
    )
    sendMailMock.mockResolvedValue({ messageId: '<smtp-3@mailpit>' })

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result.success).toBe(true)
    expect(result.transport).toBe('smtp')
  })

  it('returns E_NO_TRANSPORT when no transport prerequisites are met', async () => {
    process.env.SMTP_HOST = ''

    const result = await sendEmail({ to: 'user@example.ee', ...baseMessage })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E_NO_TRANSPORT')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('rejects invalid recipient input', async () => {
    await expect(sendEmail({ to: [], ...baseMessage })).rejects.toThrow(TypeError)
    await expect(sendEmail({ to: '  ', ...baseMessage })).rejects.toThrow(TypeError)
  })

  it('rejects a non-string header value', async () => {
    await expect(
      sendEmail({ to: 'user@example.ee', headers: { 'X-Empty': '' }, ...baseMessage }),
    ).rejects.toThrow(TypeError)
  })
})

describe('marketingEmailHeaders', () => {
  it('returns the GDPR unsubscribe header pair', () => {
    expect(marketingEmailHeaders()).toEqual({
      'List-Unsubscribe': '<mailto:unsubscribe@erametsad.ww0.dev?subject=unsubscribe>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })
})

describe('custom headers propagation', () => {
  const headers = marketingEmailHeaders()

  it('passes headers through the EMAIL binding', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    setEmailBindingForTests(makeBinding(send))

    await sendEmail({ to: 'user@example.ee', headers, ...baseMessage })

    expect(send).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
      headers,
    })
  })

  it('includes headers in the REST API body', async () => {
    process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'
    fetchMock.mockResolvedValueOnce(
      apiResponse(200, { success: true, result: { delivered: ['user@example.ee'] } }),
    )

    await sendEmail({ to: 'user@example.ee', headers, ...baseMessage })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
      headers,
    })
  })

  it('passes headers through SMTP', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<smtp-1@mailpit>' })

    await sendEmail({ to: 'user@example.ee', headers, ...baseMessage })

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ww0.dev',
      to: ['user@example.ee'],
      subject: baseMessage.subject,
      html: baseMessage.html,
      headers,
    })
  })
})
