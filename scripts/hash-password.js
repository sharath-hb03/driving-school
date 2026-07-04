// scripts/hash-password.js
// Usage: node scripts/hash-password.js <password>
// Outputs the PBKDF2-SHA256 hash for use in the seed SQL file.

import { createHash, pbkdf2 } from 'node:crypto'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'

const pbkdf2Async = promisify(pbkdf2)

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>')
  process.exit(1)
}

const salt = randomBytes(16)
const key = await pbkdf2Async(password, salt, 100000, 32, 'sha256')
const saltHex = salt.toString('hex')
const keyHex = key.toString('hex')
console.log(`${saltHex}:${keyHex}`)
console.log('\nPaste the line above as the password_hash in migrations/0002_seed.sql')
