import {
  type PlatformKnowledgeFilesParams,
  type PlatformKnowledgeItemsParams,
  type PlatformKnowledgeItemDto,
  type PlatformKnowledgeFileDto,
  type PlatformKnowledgeListResponse,
  type PlatformKnowledgeOverviewResponse,
  type PlatformKnowledgeTenantDto,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export const OPEN_PLATFORM_KNOWLEDGE_FILE_PAGE_SIZE = 6;
export const OPEN_PLATFORM_KNOWLEDGE_ITEM_PAGE_SIZE = 50;

export type OpenPlatformKnowledgeManagementView = PlatformKnowledgeOverviewResponse & {
  scopeName: string;
  allTenantStats: PlatformKnowledgeTenantDto;
};

export type OpenPlatformKnowledgeManagementFiles = PlatformKnowledgeListResponse<PlatformKnowledgeFileDto>;
export type OpenPlatformKnowledgeManagementItems = PlatformKnowledgeListResponse<PlatformKnowledgeItemDto>;

export type OpenPlatformKnowledgeManagementViewParams = {
  tenantId?: string | null;
};

async function fetchKnowledgeJson<TPayload>(path: string): Promise<TPayload> {
  const response = await fetch(path, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new Error('知识库运营数据暂时无法加载');
  }

  return payload as TPayload;
}

function buildKnowledgeQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function loadOpenPlatformKnowledgeManagementView(
  params: OpenPlatformKnowledgeManagementViewParams = {},
): Promise<OpenPlatformKnowledgeManagementView> {
  const overview = await fetchKnowledgeJson<PlatformKnowledgeOverviewResponse>(
    `/api/v1/open-platform/knowledge-management${buildKnowledgeQuery({
      tenantId: params.tenantId,
    })}`,
  );

  return {
    ...overview,
    scopeName: overview.scope.scopeName,
    allTenantStats: {
      tenantId: 'all',
      tenantName: '全部机构',
      status: 'active',
      knowledgeCount: overview.allTotals.knowledgeCount,
      folderCount: overview.allTotals.folderCount,
      hitCount: overview.allTotals.hitCount,
      trainedCount: overview.allTotals.trainedCount,
      failedTrainingCount: overview.allTotals.failedTrainingCount,
      zeroHitCount: overview.allTotals.zeroHitCount,
      chunkCount: overview.allTotals.chunkCount,
      averageHitCount: overview.allTotals.averageHitCount,
      hitCoverageRate: overview.allTotals.hitCoverageRate,
      trainingCoverageRate: overview.allTotals.trainingCoverageRate,
      importSuccessRate: overview.allTotals.importSuccessRate,
    },
  };
}

export async function loadOpenPlatformKnowledgeManagementFiles(
  params: PlatformKnowledgeFilesParams = {},
): Promise<OpenPlatformKnowledgeManagementFiles> {
  return fetchKnowledgeJson<OpenPlatformKnowledgeManagementFiles>(
    `/api/v1/open-platform/knowledge-management/files${buildKnowledgeQuery({
      ...params,
      pageSize: params.pageSize ?? OPEN_PLATFORM_KNOWLEDGE_FILE_PAGE_SIZE,
    })}`,
  );
}

export async function loadOpenPlatformKnowledgeManagementItems(
  params: PlatformKnowledgeItemsParams = {},
): Promise<OpenPlatformKnowledgeManagementItems> {
  return fetchKnowledgeJson<OpenPlatformKnowledgeManagementItems>(
    `/api/v1/open-platform/knowledge-management/items${buildKnowledgeQuery({
      ...params,
      pageSize: params.pageSize ?? OPEN_PLATFORM_KNOWLEDGE_ITEM_PAGE_SIZE,
    })}`,
  );
}

export function getOpenPlatformKnowledgeManagementErrorMessage(_error: unknown) {
  return '知识库运营数据暂时无法加载';
}
