import { PlatformLoginClient } from '@/modules/auth/components/ConfiguredLoginPages';
import { defaultHomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import { createHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-repository';
import { getPublishedHomepageBrandConfigService } from '@/modules/open-platform/server/homepage-brand-service';
import { getDatabase } from '@/server/db/client';

async function loadPublishedHomepageBrandConfig() {
  try {
    return await getPublishedHomepageBrandConfigService({
      repository: createHomepageBrandRepository(getDatabase()),
    });
  } catch {
    return defaultHomepageBrandConfig;
  }
}

export default async function PlatformLoginPage() {
  const config = await loadPublishedHomepageBrandConfig();

  return <PlatformLoginClient config={config} />;
}
