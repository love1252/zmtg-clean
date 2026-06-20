import { NextResponse } from 'next/server';
import { createDatabaseUrlErrorMessage, getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { listPlatformKnowledgeOverviewFilesService } from '@/modules/open-platform/server/platform-knowledge-management-service';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeFilesResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    return NextResponse.json(
      await listPlatformKnowledgeOverviewFilesService({
        repository: createPlatformKnowledgeManagementRepository(getDatabase()),
        params: {
          tenantId: params.get('tenantId'),
          keyword: params.get('keyword'),
          status: params.get('status'),
          page: params.get('page'),
          pageSize: params.get('pageSize'),
        },
      }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === createDatabaseUrlErrorMessage()) {
      return NextResponse.json(
        getPlatformKnowledgeFilesResponse({
          tenantId: params.get('tenantId'),
          keyword: params.get('keyword'),
          status: params.get('status'),
          page: params.get('page'),
          pageSize: params.get('pageSize'),
        }),
        { status: 200 },
      );
    }

    return NextResponse.json(
      buildReadonlyApiError(error instanceof Error ? error.message : '知识库文件查询参数不正确'),
      { status: 400 },
    );
  }
}
