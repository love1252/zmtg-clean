import type { PlatformKnowledgePageInfo } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

export type InstitutionKnowledgeVisibility = 'owned' | 'platform_authorized';

export type InstitutionKnowledgeItemDto = {
  knowledgeId: string;
  title: string;
  category: string;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  descriptionPreview: string;
  chunkCount: number;
  visibility: InstitutionKnowledgeVisibility;
  updatedAt: string;
  createdAt: string;
};

export type InstitutionKnowledgeItemsParams = {
  tenantId: string;
  institutionId: string;
  keyword?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type InstitutionKnowledgeListResponse = {
  requestId: 'institution-knowledge-management-items';
  readonly: true;
  dataSource: 'repository';
  records: InstitutionKnowledgeItemDto[];
  pageInfo: PlatformKnowledgePageInfo;
  emptyState: {
    title: string;
    description: string;
  };
};
