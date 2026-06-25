import { describe, expect, it } from 'vitest';
import {
  hashPasswordScrypt,
  isScryptPasswordHash,
  verifyPasswordScrypt,
} from '@/modules/auth/server/password-hash';

describe('scrypt 密码哈希', () => {
  it('生成带盐 scrypt 哈希，结果不等于明文且每次不同', async () => {
    const first = await hashPasswordScrypt('Init#2026-Strong');
    const second = await hashPasswordScrypt('Init#2026-Strong');

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(second).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(first).not.toBe('Init#2026-Strong');
    expect(first).not.toBe(second);
    expect(isScryptPasswordHash(first)).toBe(true);
  });

  it('只接受正确密码，错误密码和非法哈希都返回 false', async () => {
    const hash = await hashPasswordScrypt('Init#2026-Strong');

    await expect(verifyPasswordScrypt('Init#2026-Strong', hash)).resolves.toBe(true);
    await expect(verifyPasswordScrypt('wrong-password', hash)).resolves.toBe(false);
    await expect(verifyPasswordScrypt('Init#2026-Strong', 'plain-text-password')).resolves.toBe(false);
    await expect(verifyPasswordScrypt('Init#2026-Strong', 'scrypt$bad$params')).resolves.toBe(false);
  });
});
