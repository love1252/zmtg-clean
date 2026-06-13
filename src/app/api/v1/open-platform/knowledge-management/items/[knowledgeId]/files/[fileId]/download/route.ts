import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { downloadPlatformKnowledgeFileService } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

type DownloadRouteContext = {
  params: Promise<{ knowledgeId: string; fileId: string }> | { knowledgeId: string; fileId: string };
};

async function readParams(context: DownloadRouteContext) {
  return Promise.resolve(context.params);
}

export async function GET(request: Request, context: DownloadRouteContext) {
  try {
    const params = await readParams(context);
    const searchParams = new URL(request.url).searchParams;
    const result = await downloadPlatformKnowledgeFileService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      storage: createLocalPlatformKnowledgeFileStorage(),
      input: {
        tenantId: searchParams.get('tenantId'),
        knowledgeId: params.knowledgeId,
        fileId: params.fileId,
      },
    });
    if (result.status !== 'ready') {
      return NextResponse.json(result, { status: result.status === 'not_found' ? 404 : 400 });
    }

    return new Response(result.content.slice().buffer, {
      status: 200,
      headers: {
        'content-type': result.mimeType,
        'content-length': String(result.sizeBytes),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库文件暂时无法处理'),
      { status: 400 },
    );
  }
}
