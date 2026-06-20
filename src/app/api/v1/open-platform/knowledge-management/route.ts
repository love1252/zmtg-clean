import { NextResponse } from 'next/server';
import { createDatabaseUrlErrorMessage, getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getPlatformKnowledgeOverviewService } from '@/modules/open-platform/server/platform-knowledge-management-service';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeOverviewResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    return NextResponse.json(
      await getPlatformKnowledgeOverviewService({
        repository: createPlatformKnowledgeManagementRepository(getDatabase()),
        params: {
          tenantId: params.get('tenantId'),
        },
      }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === createDatabaseUrlErrorMessage()) {
      return NextResponse.json(
        getPlatformKnowledgeOverviewResponse({ tenantId: params.get('tenantId') }),
        { status: 200 },
      );
    }

    return NextResponse.json(
      buildReadonlyApiError('知识库概览暂时无法查询'),
      { status: 400 },
    );
  }
}
