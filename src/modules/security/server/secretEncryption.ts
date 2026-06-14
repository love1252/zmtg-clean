// Server runtime secret encryption module. It depends on node:crypto and must not be imported by client components.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type SecretEncryptionAlgorithm = 'AES-256-GCM';
export type SecretEncryptionKeyVersion = 'v1';

export type EncryptedSecretEnvelope = {
  algorithm: SecretEncryptionAlgorithm;
  keyVersion: SecretEncryptionKeyVersion;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type SecretEncryptionStatus = {
  configured: boolean;
  algorithm: SecretEncryptionAlgorithm;
  keyVersion: SecretEncryptionKeyVersion;
  missingKeys: string[];
};

const algorithm: SecretEncryptionAlgorithm = 'AES-256-GCM';
const keyVersion: SecretEncryptionKeyVersion = 'v1';
const envKey = 'ZMTG_SECRET_ENCRYPTION_KEY';
const nodeCipherAlgorithm = 'aes-256-gcm';
const masterKeyBytes = 32;
const ivBytes = 12;
const authTagBytes = 16;

class SecretEncryptionError extends Error {
  constructor(code: 'server_only' | 'not_configured' | 'invalid_envelope' | 'decrypt_failed') {
    super(`encryption_${code}`);
    this.name = 'SecretEncryptionError';
  }
}

function assertServerRuntime() {
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new SecretEncryptionError('server_only');
  }
}

function readMasterKey() {
  const encoded = process.env[envKey]?.trim();
  if (!encoded) throw new SecretEncryptionError('not_configured');

  let decoded: Buffer;
  try {
    decoded = Buffer.from(encoded, 'base64');
  } catch {
    throw new SecretEncryptionError('not_configured');
  }

  if (decoded.length !== masterKeyBytes || decoded.toString('base64') !== encoded) {
    throw new SecretEncryptionError('not_configured');
  }

  return decoded;
}

function decodeEnvelopeField(value: unknown, expectedBytes?: number) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SecretEncryptionError('invalid_envelope');
  }

  const normalized = value.trim();
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.toString('base64') !== normalized) {
    throw new SecretEncryptionError('invalid_envelope');
  }
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) {
    throw new SecretEncryptionError('invalid_envelope');
  }

  return decoded;
}

function assertSupportedEnvelope(envelope: EncryptedSecretEnvelope) {
  if (envelope.algorithm !== algorithm || envelope.keyVersion !== keyVersion) {
    throw new SecretEncryptionError('invalid_envelope');
  }
}

export function getSecretEncryptionStatus(): SecretEncryptionStatus {
  assertServerRuntime();

  try {
    readMasterKey();
    return {
      configured: true,
      algorithm,
      keyVersion,
      missingKeys: [],
    };
  } catch {
    return {
      configured: false,
      algorithm,
      keyVersion,
      missingKeys: [envKey],
    };
  }
}

export function encryptSecret(plaintext: string): EncryptedSecretEnvelope {
  assertServerRuntime();

  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new SecretEncryptionError('invalid_envelope');
  }

  const key = readMasterKey();
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv(nodeCipherAlgorithm, key, iv, { authTagLength: authTagBytes });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm,
    keyVersion,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptSecret(envelope: EncryptedSecretEnvelope): string {
  assertServerRuntime();

  try {
    assertSupportedEnvelope(envelope);
    const key = readMasterKey();
    const iv = decodeEnvelopeField(envelope.iv, ivBytes);
    const authTag = decodeEnvelopeField(envelope.authTag, authTagBytes);
    const ciphertext = decodeEnvelopeField(envelope.ciphertext);
    const decipher = createDecipheriv(nodeCipherAlgorithm, key, iv, {
      authTagLength: authTagBytes,
    });

    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof SecretEncryptionError) throw error;
    throw new SecretEncryptionError('decrypt_failed');
  }
}
