import type { IsikukoodCodec } from './hooks'
import { decrypt, encrypt, hash } from '../../crypto'

/**
 * Isikukood codec backed by the existing Node crypto module
 * (`src/lib/crypto.ts`, `ISIKUKOOD_ENCRYPTION_KEY`). This is the same module
 * the Payload users hook used, so stored values and `isikukoodHash` values
 * stay compatible. Node-only: use it in `next dev`, seed scripts, and vitest;
 * pass a Web Crypto implementation on Workers once task 5.2 lands.
 */
export const nodeIsikukoodCodec: IsikukoodCodec = { encrypt, decrypt, hash }
