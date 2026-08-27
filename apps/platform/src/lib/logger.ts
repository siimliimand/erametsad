import { getRequestId } from './request-id'

const isDev = process.env.NODE_ENV === 'development'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  requestId?: string
  timestamp: string
  context?: Record<string, unknown>
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    requestId: getRequestId(),
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  }

  const output = isDev ? JSON.stringify(entry, null, 2) : JSON.stringify(entry)

  switch (level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
}