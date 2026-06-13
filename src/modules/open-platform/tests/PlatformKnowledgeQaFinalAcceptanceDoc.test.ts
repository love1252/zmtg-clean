import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('知识库 QA 最终验收缺口清单文档', () => {
  it('存在并明确 mock/local QA 与上线前缺口边界', () => {
    const docPath = join(
      process.cwd(),
      'docs/product/test-plans/v1-knowledge-base-qa-final-acceptance-gap-list-01.md',
    );
    const content = readFileSync(docPath, 'utf8');

    expect(content).toContain('当前已完成能力');
    expect(content).toContain('mock/local QA');
    expect(content).toContain('未接真实第三方 AI');
    expect(content).toContain('未做 OCR');
    expect(content).toContain('未做 runtime ingestion');
    expect(content).toContain('后续上线前缺口');
    expect(content).not.toMatch(/已接入真实第三方 AI|已完成训练|已完成 OCR|已进入 runtime ingestion/);
  });

  it('最终验收清单 02 存在并明确审计查询与用量限制治理边界', () => {
    const docPath = join(
      process.cwd(),
      'docs/product/test-plans/v1-knowledge-base-final-acceptance-gap-list-02.md',
    );
    const content = readFileSync(docPath, 'utf8');

    expect(content).toContain('完整内部闭环');
    expect(content).toContain('mock/local QA');
    expect(content).toContain('未接真实第三方 AI');
    expect(content).toContain('未做 OCR');
    expect(content).toContain('未做 runtime ingestion');
    expect(content).toContain('审计写入与审计查询');
    expect(content).toContain('用量限制底座');
    expect(content).toContain('上线前仍需补齐');
    expect(content).not.toMatch(/已接入真实第三方 AI|已完成训练|已完成 OCR|已进入 runtime ingestion|已接入计费系统/);
  });
});
