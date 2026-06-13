import { NextResponse } from 'next/server';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeFilesResponse,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;

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
  } catch (error) {
    return NextResponse.json(
      buildReadonlyApiError(error instanceof Error ? error.message : '知识库文件查询参数不正确'),
      { status: 400 },
    );
  }
}
