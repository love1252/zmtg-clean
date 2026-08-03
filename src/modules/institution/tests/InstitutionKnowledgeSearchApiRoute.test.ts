import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));
import { GET as searchGet } from '@/app/api/institution/knowledge-management/search/route';

const disabledPayload = {
  status: 'capability_disabled',
  code: 'institution_knowledge_search_capability_disabled',
  message: '机构知识库检索暂未启用。',
};

describe('机构端知识库关键词检索 API route', () => {
  it('普通请求返回固定低敏 capability disabled', async () => {
    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(disabledPayload);
  });
});
