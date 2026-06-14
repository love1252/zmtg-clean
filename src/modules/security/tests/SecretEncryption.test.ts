import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  decryptSecret,
  encryptSecret,
  getSecretEncryptionStatus,
  type EncryptedSecretEnvelope,
} from '@/modules/security/server/secretEncryption';

const envKey = 'ZMTG_SECRET_ENCRYPTION_KEY';

function validMasterKey() {
  return randomBytes(32).toString('base64');
}

function configureValidMasterKey() {
  const masterKey = validMasterKey();
  vi.stubEnv(envKey, masterKey);
  return masterKey;
}

function expectLowSensitiveError(action: () => unknown, sensitiveValues: string[]) {
  const plaintext = 'plain-runtime-key-for-test';

    expect(action).toThrow(/encryption_/);

  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).not.toContain(plaintext);
    sensitiveValues.forEach((value) => expect(message).not.toContain(value));
    expect(message).not.toMatch(/stack|\/Users|DATABASE_URL|apiKey|secret/i);
  }
}

describe('server secret encryption foundation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('env 缺失时 status configured=false 且 encrypt/decrypt 不静默成功', () => {
    vi.stubEnv(envKey, undefined);

    expect(getSecretEncryptionStatus()).toEqual({
      configured: false,
      algorithm: 'AES-256-GCM',
      keyVersion: 'v1',
      missingKeys: [envKey],
    });

    expect(() => encryptSecret('plain-runtime-key-for-test')).toThrow(/encryption_/);
    expect(() =>
      decryptSecret({
        algorithm: 'AES-256-GCM',
        keyVersion: 'v1',
        iv: 'invalid',
        authTag: 'invalid',
        ciphertext: 'invalid',
      }),
    ).toThrow(/encryption_/);
  });

  it('env 配置正确时 status configured=true 且 algorithm/keyVersion 稳定', () => {
    configureValidMasterKey();

    expect(getSecretEncryptionStatus()).toEqual({
      configured: true,
      algorithm: 'AES-256-GCM',
      keyVersion: 'v1',
      missingKeys: [],
    });
  });

  it('拒绝非法 base64 或非 32 字节 master key，错误低敏', () => {
    vi.stubEnv(envKey, 'not-base64');
    expect(getSecretEncryptionStatus()).toMatchObject({ configured: false });
    expect(() => encryptSecret('plain-runtime-key-for-test')).toThrow(/encryption_/);

    vi.stubEnv(envKey, Buffer.from('too-short', 'utf8').toString('base64'));
    expect(getSecretEncryptionStatus()).toMatchObject({ configured: false });
    expect(() => encryptSecret('plain-runtime-key-for-test')).toThrow(/encryption_/);
  });

  it('encrypt 不返回明文，同一明文两次加密结果不同，decrypt 能还原原文', () => {
    configureValidMasterKey();
    const plaintext = 'plain-runtime-key-for-test';

    const first = encryptSecret(plaintext);
    const second = encryptSecret(plaintext);

    expect(first).toMatchObject({
      algorithm: 'AES-256-GCM',
      keyVersion: 'v1',
    });
    expect(first.ciphertext).not.toContain(plaintext);
    expect(first.authTag).not.toContain(plaintext);
    expect(first.iv).not.toContain(plaintext);
    expect(first).not.toEqual(second);
    expect(decryptSecret(first)).toBe(plaintext);
    expect(decryptSecret(second)).toBe(plaintext);
  });

  it('篡改 ciphertext / iv / authTag 必须解密失败且不暴露敏感信息', () => {
    const masterKey = configureValidMasterKey();
    const envelope = encryptSecret('plain-runtime-key-for-test');

    const tamperedCiphertext: EncryptedSecretEnvelope = {
      ...envelope,
      ciphertext: Buffer.from('tampered-ciphertext', 'utf8').toString('base64'),
    };
    const tamperedIv: EncryptedSecretEnvelope = {
      ...envelope,
      iv: randomBytes(12).toString('base64'),
    };
    const tamperedAuthTag: EncryptedSecretEnvelope = {
      ...envelope,
      authTag: randomBytes(16).toString('base64'),
    };

    expectLowSensitiveError(() => decryptSecret(tamperedCiphertext), [masterKey]);
    expectLowSensitiveError(() => decryptSecret(tamperedIv), [masterKey]);
    expectLowSensitiveError(() => decryptSecret(tamperedAuthTag), [masterKey]);
  });
});
