import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createInstitutionKnowledgeWriteRepository } from '@/modules/institution/server/institution-knowledge-write-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import {
  uploadAndParseInstitutionKnowledgeFileService,
  type InstitutionKnowledgeUploadFileLike,
} from '@/modules/institution/server/institution-knowledge-upload-service';

export async function POST(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  let file: InstitutionKnowledgeUploadFileLike | null = null;
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const formFile = formData.get('file');
      if (formFile && typeof formFile === 'object' && 'name' in formFile && 'arrayBuffer' in formFile) {
        const f = formFile as unknown as { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
        file = {
          name: f.name,
          type: f.type,
          size: f.size,
          arrayBuffer: () => f.arrayBuffer(),
        };
      }
    }
  } catch {
    return NextResponse.json(
      { code: 'validation_error', error: '文件上传请求格式不正确' },
      { status: 400 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { code: 'validation_error', error: '请选择要上传的文件' },
      { status: 400 },
    );
  }

  try {
    const db = getDatabase();

    const repository = {
      ...createPlatformKnowledgeManagementRepository(db),
      ...createInstitutionKnowledgeWriteRepository(db),
    };
    const storage = createLocalPlatformKnowledgeFileStorage();

    const result = await uploadAndParseInstitutionKnowledgeFileService({
      database: db,
      repository: repository as unknown as Parameters<typeof uploadAndParseInstitutionKnowledgeFileService>[0]['repository'],
      storage,
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        uploadedByUserId: accessContext.userId,
        file,
      },
    });

    if (result.status === 'validation_failed') {
      return NextResponse.json(
        { code: 'validation_error', error: result.message ?? '文件验证失败' },
        { status: 400 },
      );
    }

    if (result.status === 'quota_exceeded') {
      return NextResponse.json(
        { code: result.code ?? 'quota_exceeded', error: result.message ?? '知识库文件额度已达到当前套餐上限，请联系平台管理员调整套餐' },
        { status: 409 },
      );
    }

    if (result.status === 'not_found') {
      return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'created',
      knowledgeId: result.knowledgeId,
      sourceId: result.sourceId,
      file: result.file,
      parse: result.parse,
      chunkCount: result.chunkCount,
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库文件上传暂时不可用' },
      { status: 503 },
    );
  }
}
