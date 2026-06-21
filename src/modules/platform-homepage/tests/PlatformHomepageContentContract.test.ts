import { describe, expect, it } from 'vitest';
import {
  createPlatformHomepageDraft,
  generateNextPlatformHomepageMetadata,
  getDefaultPublishedPlatformHomepageContent,
  platformHomepageContentArrayLimits,
  validatePlatformHomepageDraftContent,
  type PlatformHomepageContent,
} from '../domain/homepage-content';

function cloneDefaultContent(): PlatformHomepageContent {
  return getDefaultPublishedPlatformHomepageContent();
}

describe('平台首页 CMS 内容合同', () => {
  it('默认 published 内容覆盖 Header、Hero、Stats、Features、Clients、Plans、Footer、SEO', () => {
    const content = getDefaultPublishedPlatformHomepageContent();

    expect(content.status).toBe('published');
    expect(content.contentId).toBe('platform-homepage-default');
    expect(content.version).toBe(1);
    expect(content.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(content.updatedBy).toBeTruthy();
    expect(content.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(content.publishedBy).toBeTruthy();
    expect(content.changeSummary).toBeTruthy();

    expect(content.header.navigation.length).toBeGreaterThan(0);
    expect(content.hero.title).toContain('智美天工');
    expect(content.hero.primaryAction.href).toBe('/open-platform');
    expect(content.stats.length).toBeGreaterThanOrEqual(platformHomepageContentArrayLimits.stats.min);
    expect(content.features.length).toBeGreaterThanOrEqual(
      platformHomepageContentArrayLimits.features.min,
    );
    expect(content.clients.length).toBeGreaterThanOrEqual(
      platformHomepageContentArrayLimits.clients.min,
    );
    expect(content.plans.length).toBeGreaterThanOrEqual(platformHomepageContentArrayLimits.plans.min);
    expect(content.footer.sections.length).toBeGreaterThan(0);
    expect(content.seo.title).toContain('智美天工');
    expect(content.seo.description.length).toBeGreaterThan(0);
    expect(content.seo.keywords.length).toBeGreaterThan(0);
  });

  it('创建 draft 副本时与 published 状态和对象引用分离', () => {
    const published = cloneDefaultContent();
    const draft = createPlatformHomepageDraft(published, {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '调整首页首屏文案',
    });

    expect(published.status).toBe('published');
    expect(draft.status).toBe('draft');
    expect(draft.version).toBe(published.version + 1);
    expect(draft.updatedAt).toBe('2026-06-13T08:00:00.000Z');
    expect(draft.updatedBy).toBe('platform-editor-001');
    expect(draft.publishedAt).toBeNull();
    expect(draft.publishedBy).toBeNull();
    expect(draft.changeSummary).toBe('调整首页首屏文案');

    draft.hero.title = '草稿标题';
    expect(published.hero.title).not.toBe('草稿标题');
  });

  it('生成下一版本 metadata 时递增 version 并保留发布治理字段语义', () => {
    const published = cloneDefaultContent();

    expect(
      generateNextPlatformHomepageMetadata(published, {
        actorId: 'platform-editor-002',
        now: '2026-06-13T09:00:00.000Z',
        status: 'draft',
        changeSummary: '准备下一版首页',
      }),
    ).toEqual({
      contentId: 'platform-homepage-default',
      version: 2,
      status: 'draft',
      updatedAt: '2026-06-13T09:00:00.000Z',
      updatedBy: 'platform-editor-002',
      publishedAt: null,
      publishedBy: null,
      changeSummary: '准备下一版首页',
    });
  });

  it('拒绝 javascript、data 和空字符串危险链接，并规范化可接受链接空白', () => {
    const draft = createPlatformHomepageDraft(cloneDefaultContent(), {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '校验链接',
    });
    draft.header.navigation[0].href = ' javascript:alert(1) ';
    draft.hero.primaryAction.href = '   ';
    draft.hero.secondaryAction.href = ' https://example.com/demo ';
    draft.footer.sections[0].links[0].href = 'data:text/plain;base64,SGVsbG8=';

    const result = validatePlatformHomepageDraftContent(draft);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['unsafe_url', 'empty_url']),
    );
    expect(result.normalizedContent?.hero.secondaryAction.href).toBe('https://example.com/demo');
  });

  it('拒绝 Base64 图片字段', () => {
    const draft = createPlatformHomepageDraft(cloneDefaultContent(), {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '校验图片',
    });
    draft.hero.image.imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

    const result = validatePlatformHomepageDraftContent(draft);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: '$.hero.image.imageUrl',
        code: 'base64_image',
      }),
    );
  });

  it('拒绝 Stats、Features、Clients、Plans 数组长度异常', () => {
    const draft = createPlatformHomepageDraft(cloneDefaultContent(), {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '校验数组长度',
    });
    draft.stats = [];
    draft.features = new Array(platformHomepageContentArrayLimits.features.max + 1).fill(
      draft.features[0],
    );
    draft.clients = [];
    draft.plans = new Array(platformHomepageContentArrayLimits.plans.max + 1).fill(
      draft.plans[0],
    );

    const result = validatePlatformHomepageDraftContent(draft);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '$.stats', code: 'array_length' }),
        expect.objectContaining({ path: '$.features', code: 'array_length' }),
        expect.objectContaining({ path: '$.clients', code: 'array_length' }),
        expect.objectContaining({ path: '$.plans', code: 'array_length' }),
      ]),
    );
  });

  it('拒绝 SEO title、description、keywords 长度异常', () => {
    const draft = createPlatformHomepageDraft(cloneDefaultContent(), {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '校验 SEO',
    });
    draft.seo.title = '标'.repeat(81);
    draft.seo.description = '描'.repeat(181);
    draft.seo.keywords = new Array(11).fill('关键词');

    const result = validatePlatformHomepageDraftContent(draft);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '$.seo.title', code: 'text_too_long' }),
        expect.objectContaining({ path: '$.seo.description', code: 'text_too_long' }),
        expect.objectContaining({ path: '$.seo.keywords', code: 'array_length' }),
      ]),
    );
  });

  it('拒绝乱码中文文案并且默认内容不包含知识库敏感字段', () => {
    const draft = createPlatformHomepageDraft(cloneDefaultContent(), {
      actorId: 'platform-editor-001',
      now: '2026-06-13T08:00:00.000Z',
      changeSummary: '校验乱码',
    });
    draft.hero.subtitle = 'æ™ºç¾Žå¤©å·¥';

    const result = validatePlatformHomepageDraftContent(draft);
    const serializedDefault = JSON.stringify(getDefaultPublishedPlatformHomepageContent());

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: '$.hero.subtitle',
        code: 'invalid_utf8_text',
      }),
    );
    expect(serializedDefault).not.toContain('uploadUrl');
    expect(serializedDefault).not.toContain('downloadUrl');
    expect(serializedDefault).not.toContain('fileContent');
    expect(serializedDefault).not.toContain('embedding');
    expect(serializedDefault).not.toContain('chunkText');
  });
});
