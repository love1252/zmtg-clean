import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/product/2026-06-14-v1-knowledge-base-ai-provider-safety-adapter-plan-01.md';

describe('知识库 AI provider 安全适配层治理文档', () => {
  it('说明 provider 抽象、安全边界和真实 AI No-Go', () => {
    const content = readFileSync(docPath, 'utf8');

    [
      '本次只做 provider 抽象和安全适配层',
      '未接真实第三方 AI',
      '未读取真实密钥',
      '未调用外部网络',
      'provider 输入低敏化',
      'provider 输出安全清洗',
      '真实 AI 上线前置条件',
      'No-Go：真实 AI 生产上线',
      'Go：AI provider 安全适配层进入内部评审',
    ].forEach((fragment) => {
      expect(content).toContain(fragment);
    });

    expect(content).not.toMatch(/真实 AI 已可用|真实 AI 可用|已读取真实密钥|已调用外部网络/);
  });
});
