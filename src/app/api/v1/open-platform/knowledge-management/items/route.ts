import { NextResponse } from 'next/server';
import { createDatabaseUrlErrorMessage, getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  listPlatformKnowledgeItemsService,
  listPlatformKnowledgeOverviewItemsService,
} from '@/modules/open-platform/server/platform-knowledge-management-service';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeItemsResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    const tenantId = params.get('tenantId');
    const repository = createPlatformKnowledgeManagementRepository(getDatabase());

    if (!tenantId?.trim()) {
      return NextResponse.json(
        await listPlatformKnowledgeOverviewItemsService({
          repository,
          params: {
            tenantId,
            institutionId: params.get('institutionId'),
            status: params.get('status'),
            category: params.get('category'),
            trainingStatus: params.get('trainingStatus'),
            page: params.get('page'),
            pageSize: params.get('pageSize'),
            keyword: params.get('keyword'),
          },
        }),
        { status: 200 },
      );
    }

    return NextResponse.json(
      await listPlatformKnowledgeItemsService({
        repository,
        params: {
          tenantId,
          institutionId: params.get('institutionId'),
          status: params.get('status'),
          category: params.get('category'),
          trainingStatus: params.get('trainingStatus'),
          page: params.get('page'),
          pageSize: params.get('pageSize'),
          keyword: params.get('keyword'),
        },
      }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === createDatabaseUrlErrorMessage()) {
      return NextResponse.json(getMockItemsResponse(params), { status: 200 });
    }

    return NextResponse.json(
      buildReadonlyApiError('知识库条目暂时无法查询'),
      { status: 400 },
    );
  }
}

function getMockItemsResponse(params: URLSearchParams) {
  return getPlatformKnowledgeItemsResponse({
    tenantId: params.get('tenantId'),
    keyword: params.get('keyword'),
    category: params.get('category'),
    trainingStatus: params.get('trainingStatus'),
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  });
}
