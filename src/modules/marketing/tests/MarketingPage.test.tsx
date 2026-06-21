import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cloneHomepageBrandConfig, defaultHomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import { getPublishedHomepageBrandConfigService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository } from '@/app/api/v1/open-platform/homepage-brand/_shared';
import Page from '@/app/(marketing)/page';

const repository = { id: 'homepage-brand-shared-repository' };

vi.mock('@/app/api/v1/open-platform/homepage-brand/_shared', () => ({
  getHomepageBrandRepository: vi.fn(() => repository),
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({ id: 'primary-db' })),
}));

vi.mock('@/modules/open-platform/server/homepage-brand-repository', () => ({
  createHomepageBrandRepository: vi.fn(() => ({ id: 'primary-repository' })),
}));

vi.mock('@/modules/open-platform/server/homepage-brand-service', () => ({
  getPublishedHomepageBrandConfigService: vi.fn(),
}));

vi.mock('@/modules/marketing/components/MarketingHome', () => ({
  MarketingHome: ({ config }: { config: typeof defaultHomepageBrandConfig }) => (
    <main>
      <span>{config.footer.icpNumber}</span>
      <span>{config.footer.wechatQrUrl}</span>
    </main>
  ),
}));

describe('官网首页入口', () => {
  beforeEach(() => {
    vi.mocked(getHomepageBrandRepository).mockClear();
    vi.mocked(getPublishedHomepageBrandConfigService).mockReset();
  });

  it('读取与首页品牌后台一致的发布配置来源', async () => {
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.footer.icpNumber = '沪ICP备2023031593号-1';
    config.footer.wechatQrUrl = '/uploads/homepage-brand/share_image/homepage-brand-asset-a.jpg';
    vi.mocked(getPublishedHomepageBrandConfigService).mockResolvedValueOnce(config);

    render((await Page()) as ReactElement);

    expect(getHomepageBrandRepository).toHaveBeenCalledTimes(1);
    expect(getPublishedHomepageBrandConfigService).toHaveBeenCalledWith({ repository });
    expect(screen.getByText('沪ICP备2023031593号-1')).toBeInTheDocument();
    expect(screen.getByText('/uploads/homepage-brand/share_image/homepage-brand-asset-a.jpg')).toBeInTheDocument();
  });
});
