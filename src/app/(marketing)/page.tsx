import type { Metadata } from 'next';
import { MarketingHome } from '@/modules/marketing/components/MarketingHome';
import { defaultHomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import { getHomepageBrandRepository } from '@/app/api/v1/open-platform/homepage-brand/_shared';
import { getPublishedHomepageBrandConfigService } from '@/modules/open-platform/server/homepage-brand-service';

async function loadPublishedHomepageBrandConfig() {
  try {
    return await getPublishedHomepageBrandConfigService({
      repository: getHomepageBrandRepository(),
    });
  } catch {
    return defaultHomepageBrandConfig;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await loadPublishedHomepageBrandConfig();
  const keywords = config.metadata.seoKeywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    title: config.metadata.seoTitle || config.metadata.title,
    description: config.metadata.seoDescription || config.metadata.description,
    keywords,
    openGraph: {
      title: config.metadata.shareTitle || config.metadata.seoTitle || config.metadata.title,
      description: config.metadata.shareDescription || config.metadata.seoDescription || config.metadata.description,
      images: [config.assets.shareImageUrl],
    },
  };
}

export default async function Page() {
  const config = await loadPublishedHomepageBrandConfig();

  return <MarketingHome config={config} />;
}
