import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, input: { n: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: input.n,
        r: input.r,
        p: input.p,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function encodeBase64Url(value: Buffer) {
  return value.toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

function parseScryptPasswordHash(value: string) {
  const parts = value.split('$');
  if (parts.length !== 6) return null;

  const [algorithm, nValue, rValue, pValue, saltValue, hashValue] = parts;
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (algorithm !== SCRYPT_ALGORITHM) return null;
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (n <= 1 || r <= 0 || p <= 0 || !saltValue || !hashValue) return null;

  try {
    const salt = decodeBase64Url(saltValue);
    const hash = decodeBase64Url(hashValue);
    if (salt.length === 0 || hash.length !== SCRYPT_KEY_LENGTH) return null;
    return { n, r, p, salt, hash };
  } catch {
    return null;
  }
}

export async function hashPasswordScrypt(password: string) {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = await scryptAsync(password, salt, {
    n: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    SCRYPT_ALGORITHM,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    encodeBase64Url(salt),
    encodeBase64Url(hash),
  ].join('$');
}

export function isScryptPasswordHash(value: string) {
  return parseScryptPasswordHash(value) !== null;
}

export async function verifyPasswordScrypt(password: string, passwordHash: string) {
  const parsed = parseScryptPasswordHash(passwordHash);
  if (!parsed) return false;

  const hash = await scryptAsync(password, parsed.salt, {
    n: parsed.n,
    r: parsed.r,
    p: parsed.p,
  });

  if (hash.length !== parsed.hash.length) return false;
  return timingSafeEqual(hash, parsed.hash);
}
