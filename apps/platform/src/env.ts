import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEON_DATABASE_URL: z.string().url().optional(),
  DB_TYPE: z.enum(["local", "neon"]).optional(),
  REDIS_URL: z.string(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().email(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  PAYLOAD_SECRET: z.string().min(32),
  PAYLOAD_PREVIEW_SECRET: z.string().min(16),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data