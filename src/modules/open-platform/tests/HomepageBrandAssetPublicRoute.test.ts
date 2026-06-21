import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as publicAssetRoute from '@/app/uploads/homepage-brand/[kind]/[filename]/route';
import { createLocalHomepageBrandAssetStorage } from '@/modules/open-platform/server/homepage-brand-asset-storage';

const storage = {
  save: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/modules/open-platform/server/homepage-brand-asset-storage', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/homepage-brand-asset-storage')
  >('@/modules/open-platform/server/homepage-brand-asset-storage');

  return {
    ...actual,
    createLocalHomepageBrandAssetStorage: vi.fn(() => storage),
  };
});

describe('首页与品牌公开素材访问 route', () => {
  beforeEach(() => {
    Object.values(storage).forEach((mock) => mock.mockClear());
    vi.mocked(createLocalHomepageBrandAssetStorage).mockClear();
  });

  it('读取本地上传的首页品牌图片并返回可展示响应', async () => {
    const content = new TextEncoder().encode('jpeg bytes');
    storage.read.mockResolvedValueOnce(content);

    const response = await publicAssetRoute.GET(
      new Request('http://localhost/uploads/homepage-brand/share_image/homepage-brand-asset-a.jpg'),
      { params: Promise.resolve({ kind: 'share_image', filename: 'homepage-brand-asset-a.jpg' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(storage.read).toHaveBeenCalledWith({
      storageKey: 'homepage-brand/share_image/homepage-brand-asset-a.jpg',
    });
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(content));
  });
});
