import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  listSupportedVendors,
  isSupportedVendor,
  getSupportedVendorConfig,
  type SupportedVendor,
} from '@/modules/open-platform/domain/vendor-catalog';

describe('vendor catalog', () => {
  it('should return all 5 supported vendors', () => {
    const vendors = listSupportedVendors();
    expect(vendors).toHaveLength(5);
    // All 5 vendors are returned exactly once
    expect(vendors.sort().join(',')).toBe('chatglm,deepseek,doubao,kimi,qwen');
  });

  it('should accept valid vendor names', () => {
    const valid: SupportedVendor[] = ['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi'];
    for (const v of valid) {
      expect(isSupportedVendor(v)).toBe(true);
    }
  });

  it('should reject invalid vendor names', () => {
    expect(isSupportedVendor('openai_compatible')).toBe(false);
    expect(isSupportedVendor('openai')).toBe(false);
    expect(isSupportedVendor('')).toBe(false);
    expect(isSupportedVendor(null)).toBe(false);
    expect(isSupportedVendor(undefined)).toBe(false);
    expect(isSupportedVendor(123)).toBe(false);
    expect(isSupportedVendor('unknown_vendor')).toBe(false);
  });

  it('should return correct config for each vendor', () => {
    const doubao = getSupportedVendorConfig('doubao');
    expect(doubao.vendor).toBe('doubao');
    expect(doubao.displayName).toBe('豆包 (Volcengine)');
    expect(doubao.defaultBaseUrl).toBe('https://ark.cn-beijing.volces.com/api/v3');
    expect(doubao.defaultModel).toBe('doubao-seed-1-8-251228');

    const deepseek = getSupportedVendorConfig('deepseek');
    expect(deepseek.vendor).toBe('deepseek');
    expect(deepseek.defaultBaseUrl).toBe('https://api.deepseek.com/v1');

    const qwen = getSupportedVendorConfig('qwen');
    expect(qwen.vendor).toBe('qwen');
    expect(qwen.defaultBaseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');

    const chatglm = getSupportedVendorConfig('chatglm');
    expect(chatglm.vendor).toBe('chatglm');
    expect(chatglm.defaultBaseUrl).toBe('https://open.bigmodel.cn/api/paas/v4');

    const kimi = getSupportedVendorConfig('kimi');
    expect(kimi.vendor).toBe('kimi');
    expect(kimi.defaultBaseUrl).toBe('https://api.moonshot.ai/v1');
  });

  it('should not mutate when listing vendors', () => {
    const first = listSupportedVendors();
    const second = listSupportedVendors();
    expect(first).toEqual(['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi']);
    expect(second).toEqual(['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi']);
    first.sort();
    expect(first).not.toEqual(second); // second is still original order
  });

  it('should not include openai_compatible in vendor list', () => {
    const vendors = listSupportedVendors();
    expect(vendors).not.toContain('openai_compatible');
  });

  it('derives the SupportedVendor type from the runtime catalog keys', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/open-platform/domain/vendor-catalog.ts'), 'utf8');

    expect(source).toContain('export type SupportedVendor = keyof typeof SUPPORTED_VENDOR_CONFIGS');
    expect(source).not.toContain("export type SupportedVendor = 'doubao'");
  });
});
