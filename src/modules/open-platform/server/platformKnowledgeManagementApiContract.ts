import type {
  CategoryStats,
  ImportJob,
  KnowledgeFileItem,
  KnowledgeItem,
  PlatformKnowledgeTotals,
  TenantKnowledgeStats,
  TopQuestion,
} from '@/modules/open-platform/mock/platformKnowledge';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
export const PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID = '__library__';

const zeroTotals: PlatformKnowledgeTotals = {
  tenantCount: 0,
  knowledgeCount: 0,
  categoryCount: 0,
  folderCount: 0,
  hitCount: 0,
  chunkCount: 0,
  averageHitCount: 0,
  trainedCount: 0,
  failedTrainingCount: 0,
  zeroHitCount: 0,
  importJobCount: 0,
  failedImportJobCount: 0,
  hitCoverageRate: 0,
  trainingCoverageRate: 0,
  importSuccessRate: 0,
  pendingOptimizationCount: 0,
  sourceFileCount: 0,
  totalFileSizeKb: 0,
  parsedFileCount: 0,
  failedFileCount: 0,
};

const unconnectedEmptyState = {
  title: '暂无真实知识库运营数据',
  description: '当前未接入知识库数据库或暂无知识库记录，请在真实数据写入后查看。',
};

export type PlatformKnowledgeOverviewResponse = {
  requestId: string;
  readonly: true;
  dataSource: 'unconnected' | 'repository';
  scope: {
    tenantId: string | null;
    scopeName: string;
  };
  allTotals: PlatformKnowledgeTotals;
  totals: PlatformKnowledgeTotals;
  tenants: PlatformKnowledgeTenantDto[];
  categoryStats: CategoryStats[];
  directories: PlatformKnowledgeDirectoryDto[];
  topQuestions: PlatformKnowledgeTopQuestionDto[];
  importJobs: PlatformKnowledgeImportJobDto[];
};

export type PlatformKnowledgeOverviewParams = {
  tenantId?: string | null;
};

export type PlatformKnowledgeDirectoryDto = {
  directoryId: string;
  parentId: string | null;
  kind: 'virtual_root' | 'knowledge_library' | 'folder';
  name: string;
  depth: number;
  sortOrder: number;
  knowledgeCount: number;
  fileCount: number;
  canRename: boolean;
  canCreateChild: boolean;
  canArchive: boolean;
  archiveBlockedReason: string | null;
  status: 'active' | 'archived';
};

export type PlatformKnowledgeDirectoryMutationStatus =
  | 'created'
  | 'renamed'
  | 'archived'
  | 'reordered'
  | 'blocked'
  | 'not_found'
  | 'validation_failed'
  | 'not_supported_without_directory_store';

export type PlatformKnowledgeDirectoryMutationResponse = {
  requestId: string;
  readonly: false;
  status: PlatformKnowledgeDirectoryMutationStatus;
  message: string;
  directory?: PlatformKnowledgeDirectoryDto;
  affected?: {
    sources: number;
    documents: number;
    chunks: number;
    jobs: number;
  };
};

export type ParsedPlatformKnowledgeDirectoryId =
  | { ok: true; kind: 'knowledge_library'; libraryName: string }
  | { ok: true; kind: 'folder'; libraryName: string; folderName: string }
  | { ok: false };

export type PlatformKnowledgeDirectorySourceDto = {
  tenantId: string;
  sourceLabel: string;
  workspaceId: string;
  status: string;
  updatedAt?: string | Date | null;
};

export type PlatformKnowledgeTenantDto = Omit<TenantKnowledgeStats, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgeFileDto = Omit<KnowledgeFileItem, 'tenantName' | 'isDownloadable'> & {
  tenantName: string;
  knowledgeId?: string;
  ocrStatus?: 'pending' | 'succeeded' | 'failed' | 'unsupported' | 'ocr_required';
  failureReasonCode?: string | null;
  chunkCount?: number;
};

export type PlatformKnowledgeItemDto = Omit<KnowledgeItem, 'tenantName' | 'summaryPreview'> & {
  tenantName: string;
  descriptionPreview: string;
  institutionId?: string;
  workspaceId?: string;
  version?: string;
  sourceKind?: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status?: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus?: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  visibleInstitutionIds?: string[];
  createdAt?: string;
};

export type PlatformKnowledgeTopQuestionDto = Omit<TopQuestion, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgeImportJobDto = Omit<ImportJob, 'tenantName'> & {
  tenantName: string;
};

export type PlatformKnowledgePageInfo = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type PlatformKnowledgeFilesParams = {
  tenantId?: string | null;
  keyword?: string | null;
  status?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type PlatformKnowledgeItemsParams = {
  tenantId?: string | null;
  institutionId?: string | null;
  keyword?: string | null;
  category?: string | null;
  status?: string | null;
  trainingStatus?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type PlatformKnowledgeListResponse<TRecord> = {
  requestId: string;
  readonly: true;
  dataSource: 'unconnected' | 'repository';
  records: TRecord[];
  pageInfo: PlatformKnowledgePageInfo;
  emptyState: {
    title: string;
    description: string;
  };
};

export type PlatformKnowledgeReadonlyApiError = {
  error: {
    code: 'readonly_contract_error';
    message: string;
  };
};

type PageParamsResult =
  | { ok: true; page: number; pageSize: number }
  | { ok: false; error: PlatformKnowledgeReadonlyApiError };

export function getPlatformKnowledgeOverviewResponse(
  params: PlatformKnowledgeOverviewParams = {},
): PlatformKnowledgeOverviewResponse {
  const tenantId = normalizeOptionalString(params.tenantId) ?? null;

  return {
    requestId: 'open-platform-knowledge-management-overview',
    readonly: true,
    dataSource: 'unconnected',
    scope: {
      tenantId,
      scopeName: tenantId ? '已选择机构' : '全部机构',
    },
    allTotals: { ...zeroTotals },
    totals: { ...zeroTotals },
    tenants: [],
    categoryStats: [],
    directories: buildPlatformKnowledgeDirectories({
      items: [],
      files: [],
    }),
    topQuestions: [],
    importJobs: [],
  };
}

export function getPlatformKnowledgeFilesResponse(
  params: PlatformKnowledgeFilesParams = {},
): PlatformKnowledgeListResponse<PlatformKnowledgeFileDto> {
  const pageParams = normalizePageParams(params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  return buildListResponse({
    requestId: 'open-platform-knowledge-management-files',
    records: [],
    page: pageParams.page,
    pageSize: pageParams.pageSize,
    emptyState: unconnectedEmptyState,
  });
}

export function getPlatformKnowledgeItemsResponse(
  params: PlatformKnowledgeItemsParams = {},
): PlatformKnowledgeListResponse<PlatformKnowledgeItemDto> {
  const pageParams = normalizePageParams(params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  return buildListResponse({
    requestId: 'open-platform-knowledge-management-items',
    records: [],
    page: pageParams.page,
    pageSize: pageParams.pageSize,
    emptyState: unconnectedEmptyState,
  });
}

export function normalizePageParams(params: Pick<PlatformKnowledgeFilesParams, 'page' | 'pageSize'> = {}): PageParamsResult {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE) ?? DEFAULT_PAGE;
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize === null || parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { ok: true, page, pageSize };
}

export function buildReadonlyApiError(message: string): PlatformKnowledgeReadonlyApiError {
  return {
    error: {
      code: 'readonly_contract_error',
      message,
    },
  };
}

export function buildPlatformKnowledgeDirectories({
  items,
  files = [],
  sources = [],
}: {
  items: Array<Pick<KnowledgeItem, 'category' | 'folder'>>;
  files?: Array<Pick<KnowledgeFileItem, 'category' | 'folder'>>;
  sources?: PlatformKnowledgeDirectorySourceDto[];
}): PlatformKnowledgeDirectoryDto[] {
  const sourceSortRankByDirectoryKey = new Map<string, number>();
  const sourceSortRanksByLibrary = new Map<string, number[]>();
  const categoryBuckets = new Map<string, {
    knowledgeCount: number;
    fileCount: number;
    folders: Map<string, { knowledgeCount: number; fileCount: number }>;
  }>();

  function ensureCategory(category: string) {
    const name = normalizeDirectoryName(category);
    const current = categoryBuckets.get(name);
    if (current) return current;

    const created: {
      knowledgeCount: number;
      fileCount: number;
      folders: Map<string, { knowledgeCount: number; fileCount: number }>;
    } = {
      knowledgeCount: 0,
      fileCount: 0,
      folders: new Map<string, { knowledgeCount: number; fileCount: number }>(),
    };
    categoryBuckets.set(name, created);
    return created;
  }

  function ensureFolder(category: string, folder: string) {
    const categoryBucket = ensureCategory(category);
    const name = normalizeDirectoryName(folder);
    const current = categoryBucket.folders.get(name);
    if (current) return current;

    const created = { knowledgeCount: 0, fileCount: 0 };
    categoryBucket.folders.set(name, created);
    return created;
  }

  items.forEach((item) => {
    const category = ensureCategory(item.category);
    const folder = ensureFolder(item.category, item.folder);
    category.knowledgeCount += 1;
    folder.knowledgeCount += 1;
  });

  files.forEach((file) => {
    const category = ensureCategory(file.category);
    const folder = ensureFolder(file.category, file.folder);
    category.fileCount += 1;
    folder.fileCount += 1;
  });
  sources
    .filter((source) => source.status !== 'disabled')
    .forEach((source) => {
      const categoryName = normalizeDirectoryName(source.sourceLabel);
      const workspaceName = normalizeDirectoryName(source.workspaceId);
      const sourceRank = parseSourceSortRank(source.updatedAt);
      if (sourceRank !== null) {
        const libraryRanks = sourceSortRanksByLibrary.get(categoryName) ?? [];
        libraryRanks.push(sourceRank);
        sourceSortRanksByLibrary.set(categoryName, libraryRanks);
        if (source.workspaceId === PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID) {
          sourceSortRankByDirectoryKey.set(directorySortKey('knowledge_library', categoryName), sourceRank);
        } else {
          sourceSortRankByDirectoryKey.set(directorySortKey('folder', categoryName, workspaceName), sourceRank);
        }
      }
      ensureCategory(source.sourceLabel);
      if (source.workspaceId !== PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID) {
        ensureFolder(source.sourceLabel, source.workspaceId);
      }
    });
  sourceSortRanksByLibrary.forEach((ranks, categoryName) => {
    if (!sourceSortRankByDirectoryKey.has(directorySortKey('knowledge_library', categoryName))) {
      sourceSortRankByDirectoryKey.set(directorySortKey('knowledge_library', categoryName), Math.min(...ranks));
    }
  });

  const directories: PlatformKnowledgeDirectoryDto[] = [
    {
      directoryId: 'directory:all-knowledge',
      parentId: null,
      kind: 'virtual_root',
      name: '全部知识库',
      depth: 0,
      sortOrder: 0,
      knowledgeCount: items.length,
      fileCount: files.length,
      canRename: false,
      canCreateChild: true,
      canArchive: false,
      archiveBlockedReason: '虚拟根目录不可归档',
      status: 'active',
    },
  ];

  Array.from(categoryBuckets.entries())
    .sort(([left], [right]) =>
      compareDirectorySortRank(
        sourceSortRankByDirectoryKey.get(directorySortKey('knowledge_library', left)),
        sourceSortRankByDirectoryKey.get(directorySortKey('knowledge_library', right)),
      ) || left.localeCompare(right, 'zh-CN'),
    )
    .forEach(([categoryName, category], categoryIndex) => {
      const categoryId = buildDirectoryId('library', categoryName);
      const occupiedCount = category.knowledgeCount + category.fileCount + category.folders.size;

      directories.push({
        directoryId: categoryId,
        parentId: null,
        kind: 'knowledge_library',
        name: categoryName,
        depth: 0,
        sortOrder: (categoryIndex + 1) * 100,
        knowledgeCount: category.knowledgeCount,
        fileCount: category.fileCount,
        canRename: true,
        canCreateChild: true,
        canArchive: occupiedCount === 0,
        archiveBlockedReason: occupiedCount > 0 ? '目录下仍有知识条目或文件' : null,
        status: 'active',
      });

      Array.from(category.folders.entries())
        .sort(([left], [right]) =>
          compareDirectorySortRank(
            sourceSortRankByDirectoryKey.get(directorySortKey('folder', categoryName, left)),
            sourceSortRankByDirectoryKey.get(directorySortKey('folder', categoryName, right)),
          ) || left.localeCompare(right, 'zh-CN'),
        )
        .forEach(([folderName, folder], folderIndex) => {
          const folderOccupiedCount = folder.knowledgeCount + folder.fileCount;

          directories.push({
            directoryId: buildDirectoryId('folder', categoryName, folderName),
            parentId: categoryId,
            kind: 'folder',
            name: folderName,
            depth: 1,
            sortOrder: (categoryIndex + 1) * 100 + folderIndex + 1,
            knowledgeCount: folder.knowledgeCount,
            fileCount: folder.fileCount,
            canRename: true,
            canCreateChild: false,
            canArchive: folderOccupiedCount === 0,
            archiveBlockedReason: folderOccupiedCount > 0 ? '目录下仍有知识条目或文件' : null,
            status: 'active',
          });
        });
    });

  return directories;
}

function parseSourceSortRank(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

function directorySortKey(kind: 'knowledge_library' | 'folder', libraryName: string, folderName = '') {
  return kind === 'knowledge_library'
    ? `library:${libraryName}`
    : `folder:${libraryName}:${folderName}`;
}

function compareDirectorySortRank(left: number | undefined, right: number | undefined) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;

  return left - right;
}

function normalizeDirectoryName(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : '未分类';
}

function buildDirectoryId(prefix: 'library' | 'folder', ...parts: string[]) {
  return `directory:${prefix}:${parts.map((part) => encodeURIComponent(part)).join(':')}`;
}

export function parsePlatformKnowledgeDirectoryId(directoryId: string): ParsedPlatformKnowledgeDirectoryId {
  const parts = directoryId.split(':');

  if (parts[0] !== 'directory') return { ok: false };
  if (parts[1] === 'library' && parts.length === 3) {
    return {
      ok: true,
      kind: 'knowledge_library',
      libraryName: decodeDirectoryPart(parts[2]),
    };
  }
  if (parts[1] === 'folder' && parts.length === 4) {
    return {
      ok: true,
      kind: 'folder',
      libraryName: decodeDirectoryPart(parts[2]),
      folderName: decodeDirectoryPart(parts[3]),
    };
  }

  return { ok: false };
}

function decodeDirectoryPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildListResponse<TRecord>({
  requestId,
  records,
  page,
  pageSize,
  emptyState,
}: {
  requestId: string;
  records: TRecord[];
  page: number;
  pageSize: number;
  emptyState: PlatformKnowledgeListResponse<TRecord>['emptyState'];
}): PlatformKnowledgeListResponse<TRecord> {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId,
    readonly: true,
    dataSource: 'unconnected',
    records: records.slice(start, start + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      total,
      pageCount,
      hasPreviousPage: page > 1 && total > 0,
      hasNextPage: page < pageCount,
    },
    emptyState,
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(value: string | number | null | undefined, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return parsed;
}
