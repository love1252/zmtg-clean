import type {
  V1KnowledgeBaseDemoReadonlyFacade,
  V1KnowledgeBaseDemoReadonlyFacadeResultStatus,
} from './v1-knowledge-base-demo-readonly-facade';

export type V1KnowledgeBaseDemoReadonlyApiContractMapperInput = {
  requestId?: string;
  facade: V1KnowledgeBaseDemoReadonlyFacade;
};

export type V1KnowledgeBaseDemoReadonlyApiContractCategory = {
  categoryId: 'platform-knowledge-base' | 'institution-knowledge-base';
  label: string;
  summary: string;
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractFolder = {
  folderId: 'catalog-summary' | 'visibility-summary';
  label: string;
  summary: string;
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractKnowledgeItem = {
  itemId: 'publish-status-summary' | 'version-summary' | 'audit-summary';
  title: string;
  summary: string;
  status: V1KnowledgeBaseDemoReadonlyFacadeResultStatus;
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractTaskRecord = {
  recordId:
    | 'demo-readonly-facade-disabled'
    | 'demo-readonly-facade-denied'
    | 'demo-readonly-facade-empty'
    | 'demo-readonly-facade-source-missing'
    | 'demo-readonly-facade-partial'
    | 'demo-readonly-facade-stale'
    | 'demo-readonly-facade-ready';
  status: 'skipped' | 'blocked' | 'empty' | 'partial' | 'stale' | 'ready';
  title: '知识库 demo readonly facade';
  failureReason: string;
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractSearchPreviewResult = {
  previewId: 'platform-knowledge-base-preview' | 'institution-knowledge-base-preview';
  title: string;
  snippet: string;
  sourceKind: 'demo' | 'seed';
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractSearchPreview = {
  mode: 'mock_demo_preview';
  query: '知识库 demo 只读预览';
  resultCount: number;
  results: V1KnowledgeBaseDemoReadonlyApiContractSearchPreviewResult[];
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractFacadeSnapshot = {
  status: V1KnowledgeBaseDemoReadonlyFacadeResultStatus;
  facadeStatus: V1KnowledgeBaseDemoReadonlyFacade['facadeStatus'];
  governanceSummary: string;
  demoSourceSummary: string;
  readonly: true;
};

export type V1KnowledgeBaseDemoReadonlyApiContractResponse = {
  requestId: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  status: V1KnowledgeBaseDemoReadonlyFacadeResultStatus;
  summary: {
    title: '知识库 demo readonly API 契约';
    statusText: string;
    description: string;
  };
  categories: V1KnowledgeBaseDemoReadonlyApiContractCategory[];
  folders: V1KnowledgeBaseDemoReadonlyApiContractFolder[];
  knowledgeItems: V1KnowledgeBaseDemoReadonlyApiContractKnowledgeItem[];
  taskRecords: V1KnowledgeBaseDemoReadonlyApiContractTaskRecord[];
  searchPreview: V1KnowledgeBaseDemoReadonlyApiContractSearchPreview;
  facade: V1KnowledgeBaseDemoReadonlyApiContractFacadeSnapshot;
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
  readonly: true;
};

export const v1KnowledgeBaseDemoReadonlyApiContractFields = [
  'requestId',
  'tenantId',
  'institutionId',
  'workspaceId',
  'status',
  'summary',
  'title',
  'statusText',
  'description',
  'categories',
  'categoryId',
  'label',
  'readonly',
  'folders',
  'folderId',
  'knowledgeItems',
  'itemId',
  'taskRecords',
  'recordId',
  'failureReason',
  'searchPreview',
  'mode',
  'query',
  'resultCount',
  'results',
  'previewId',
  'snippet',
  'sourceKind',
  'facade',
  'facadeStatus',
  'governanceSummary',
  'demoSourceSummary',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

const notAvailable = 'not_available';
const defaultRequestId = 'demo-readonly-api-contract-request';

function summaryDescription(facade: V1KnowledgeBaseDemoReadonlyFacade): string {
  if (facade.emptyCopy !== undefined) {
    return facade.emptyCopy;
  }

  if (facade.exceptionCopy !== undefined) {
    return facade.exceptionCopy;
  }

  if (facade.staleCopy !== undefined) {
    return facade.staleCopy;
  }

  return '知识库 demo readonly facade 可用于只读 API / UI 演示';
}

function categoriesForFacade(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractCategory[] {
  if (facade.platformKnowledgeBase === notAvailable || facade.institutionKnowledgeBase === notAvailable) {
    return [];
  }

  return [
    {
      categoryId: 'platform-knowledge-base',
      label: '平台知识库',
      summary: facade.platformKnowledgeBase,
      readonly: true,
    },
    {
      categoryId: 'institution-knowledge-base',
      label: '机构知识库',
      summary: facade.institutionKnowledgeBase,
      readonly: true,
    },
  ];
}

function foldersForFacade(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractFolder[] {
  if (facade.catalogSummary === notAvailable || facade.visibilitySummary === notAvailable) {
    return [];
  }

  return [
    {
      folderId: 'catalog-summary',
      label: '目录总览',
      summary: facade.catalogSummary,
      readonly: true,
    },
    {
      folderId: 'visibility-summary',
      label: '可见范围',
      summary: facade.visibilitySummary,
      readonly: true,
    },
  ];
}

function knowledgeItemsForFacade(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractKnowledgeItem[] {
  if (
    facade.publishStatusSummary === notAvailable ||
    facade.versionSummary === notAvailable ||
    facade.auditSummary === notAvailable
  ) {
    return [];
  }

  return [
    {
      itemId: 'publish-status-summary',
      title: '发布状态总览',
      summary: facade.publishStatusSummary,
      status: facade.status,
      readonly: true,
    },
    {
      itemId: 'version-summary',
      title: '版本总览',
      summary: facade.versionSummary,
      status: facade.status,
      readonly: true,
    },
    {
      itemId: 'audit-summary',
      title: '审计总览',
      summary: facade.auditSummary,
      status: facade.status,
      readonly: true,
    },
  ];
}

function failureReasonForFacade(facade: V1KnowledgeBaseDemoReadonlyFacade): string {
  if (facade.facadeStatus === 'disabled') {
    return '只读能力暂未开启';
  }

  if (facade.facadeStatus === 'denied') {
    return '当前账号没有访问权限';
  }

  if (facade.facadeStatus === 'empty') {
    return '暂无可展示知识库 demo readonly facade';
  }

  if (facade.facadeStatus === 'source_missing') {
    return '知识库 demo 来源不完整，请复核 demo seed 配置';
  }

  if (facade.facadeStatus === 'partial') {
    return '知识库 demo 来源部分不完整，仅展示可用只读总览';
  }

  if (facade.facadeStatus === 'stale') {
    return '知识库 demo readonly facade 可能已过期';
  }

  return notAvailable;
}

function taskRecordForFacade(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractTaskRecord {
  if (facade.facadeStatus === 'disabled') {
    return {
      recordId: 'demo-readonly-facade-disabled',
      status: 'skipped',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  if (facade.facadeStatus === 'denied') {
    return {
      recordId: 'demo-readonly-facade-denied',
      status: 'blocked',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  if (facade.facadeStatus === 'empty') {
    return {
      recordId: 'demo-readonly-facade-empty',
      status: 'empty',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  if (facade.facadeStatus === 'source_missing') {
    return {
      recordId: 'demo-readonly-facade-source-missing',
      status: 'blocked',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  if (facade.facadeStatus === 'partial') {
    return {
      recordId: 'demo-readonly-facade-partial',
      status: 'partial',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  if (facade.facadeStatus === 'stale') {
    return {
      recordId: 'demo-readonly-facade-stale',
      status: 'stale',
      title: '知识库 demo readonly facade',
      failureReason: failureReasonForFacade(facade),
      readonly: true,
    };
  }

  return {
    recordId: 'demo-readonly-facade-ready',
    status: 'ready',
    title: '知识库 demo readonly facade',
    failureReason: notAvailable,
    readonly: true,
  };
}

function hasVisibleItems(summary: string): boolean {
  return !summary.includes(':0 / published:0 / draft:0 / archived:0 / disabled:0');
}

function searchPreviewResults(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractSearchPreviewResult[] {
  if (facade.platformKnowledgeBase === notAvailable || facade.institutionKnowledgeBase === notAvailable) {
    return [];
  }

  const results: V1KnowledgeBaseDemoReadonlyApiContractSearchPreviewResult[] = [];

  if (hasVisibleItems(facade.platformKnowledgeBase)) {
    results.push({
      previewId: 'platform-knowledge-base-preview',
      title: '平台知识库 demo 预览',
      snippet: facade.platformKnowledgeBase,
      sourceKind: 'demo',
      readonly: true,
    });
  }

  if (hasVisibleItems(facade.institutionKnowledgeBase)) {
    results.push({
      previewId: 'institution-knowledge-base-preview',
      title: '机构知识库 seed 预览',
      snippet: facade.institutionKnowledgeBase,
      sourceKind: 'seed',
      readonly: true,
    });
  }

  return results;
}

function searchPreviewForFacade(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractSearchPreview {
  const results = searchPreviewResults(facade);

  return {
    mode: 'mock_demo_preview',
    query: '知识库 demo 只读预览',
    resultCount: results.length,
    results,
    readonly: true,
  };
}

function facadeSnapshot(
  facade: V1KnowledgeBaseDemoReadonlyFacade,
): V1KnowledgeBaseDemoReadonlyApiContractFacadeSnapshot {
  return {
    status: facade.status,
    facadeStatus: facade.facadeStatus,
    governanceSummary: facade.governanceSummary,
    demoSourceSummary: facade.demoSourceSummary,
    readonly: true,
  };
}

export function buildV1KnowledgeBaseDemoReadonlyApiContractResponse(
  input: V1KnowledgeBaseDemoReadonlyApiContractMapperInput,
): V1KnowledgeBaseDemoReadonlyApiContractResponse {
  const { facade } = input;

  return {
    requestId: input.requestId ?? defaultRequestId,
    tenantId: facade.tenantId,
    institutionId: facade.institutionId,
    workspaceId: facade.workspaceId,
    status: facade.status,
    summary: {
      title: '知识库 demo readonly API 契约',
      statusText: `${facade.facadeStatus} / ${facade.resultCode}`,
      description: summaryDescription(facade),
    },
    categories: categoriesForFacade(facade),
    folders: foldersForFacade(facade),
    knowledgeItems: knowledgeItemsForFacade(facade),
    taskRecords: [taskRecordForFacade(facade)],
    searchPreview: searchPreviewForFacade(facade),
    facade: facadeSnapshot(facade),
    riskFlags: [...facade.riskFlags],
    recommendedReadonlyActions: [...facade.recommendedReadonlyActions],
    readonly: true,
  };
}
