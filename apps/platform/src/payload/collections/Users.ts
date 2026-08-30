// Isikukood encryption hooks of the former Payload users collection. The
// Payload bootstrap was removed (OpenSpec option-b task 2.12); these hooks
// stay because src/lib/__tests__/encryption.test.ts exercises them as the
// contract for isikukood envelope handling.
import { decrypt, encrypt, hash } from '../../lib/crypto'

type UsersDoc = Record<string, unknown>

export const Users = {
  slug: 'users',
  hooks: {
    beforeChange: [
      ({ data }: { data: UsersDoc }) => {
        const raw = data.isikukood as string | undefined
        if (!raw) return data

        const result = encrypt(raw)
        return {
          ...data,
          isikukoodEncrypted: result.encrypted,
          isikukoodIv: result.iv,
          isikukoodAuthTag: result.authTag,
          isikukoodHash: hash(raw),
          isikukood: undefined,
        }
      },
    ],
    afterRead: [
      ({ doc }: { doc: UsersDoc }) => {
        const encrypted = doc.isikukoodEncrypted as string | undefined
        const iv = doc.isikukoodIv as string | undefined
        const authTag = doc.isikukoodAuthTag as string | undefined
        if (!encrypted || !iv) return doc

        try {
          return {
            ...doc,
            isikukood: decrypt(encrypted, iv, authTag ?? ''),
          }
        } catch {
          return {
            ...doc,
            isikukood: undefined,
          }
        }
      },
    ],
  },
}
