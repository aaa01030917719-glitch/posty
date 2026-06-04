import 'server-only'

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const TOKEN_FORMAT_VERSION = 'v1'

type EncryptedTokenEnvelope = {
  version: typeof TOKEN_FORMAT_VERSION
  iv: string
  authTag: string
  ciphertext: string
}

function getEncryptionKey() {
  const encodedKey = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY

  if (!encodedKey) {
    throw new Error('Instagram token encryption configuration is unavailable')
  }

  const key = Buffer.from(encodedKey, 'base64')

  if (key.length !== 32) {
    throw new Error('Instagram token encryption key must be a base64-encoded 32-byte key')
  }

  return key
}

export function encryptInstagramAccessToken(accessToken: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(accessToken, 'utf8'),
    cipher.final(),
  ])
  const envelope: EncryptedTokenEnvelope = {
    version: TOKEN_FORMAT_VERSION,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }

  return {
    ciphertext: JSON.stringify(envelope),
    keyVersion: TOKEN_FORMAT_VERSION,
  }
}

export function decryptInstagramAccessToken(serializedEnvelope: string) {
  const envelope = JSON.parse(serializedEnvelope) as Partial<EncryptedTokenEnvelope>

  if (
    envelope.version !== TOKEN_FORMAT_VERSION ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.authTag !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('Instagram access token envelope is invalid')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(envelope.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
