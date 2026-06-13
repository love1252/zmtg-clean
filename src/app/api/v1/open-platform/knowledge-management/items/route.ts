import { NextResponse } from 'next/server';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeItemsResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;

    return NextResponse.json(
      getPlatformKnowledgeItemsResponse({
        tenantId: params.get('tenantId'),
        keyword: params.get('keyword'),
        category: params.get('category'),
        trainingStatus: params.get('trainingStatus'),
        page: params.get('page'),
        pageSize: params.get('pageSize'),
      }),
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      buildReadonlyApiError(error instanceof Error ? error.message : '知识库条目查询参数不正确'),
      { status: 400 },
    );
  }
}
