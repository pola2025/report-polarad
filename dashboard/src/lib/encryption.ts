/**
 * Token Encryption Utility - AES-256-CBC 암호화
 *
 * Meta Access Token을 암호화하여 DB에 저장
 * 환경변수 TOKEN_ENCRYPTION_KEY에 32바이트(64자 hex) 키 필요
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // AES block size

/**
 * 암호화 키 가져오기
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY

  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set')
  }

  if (key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(key, 'hex')
}

/**
 * 텍스트 암호화
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) {
    return null
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

/**
 * 암호문 복호화
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) {
    return null
  }

  const key = getEncryptionKey()
  const parts = encryptedText.split(':')

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * 암호화 키 유효성 검사
 */
export function validateKey(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}
