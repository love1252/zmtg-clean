import { NextResponse } from 'next/server';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import {
  createAndRunGenerateEmbeddingsJob,
  createAndRunParseFileJob,
  createAndRunRebuildEmbeddingsJob,
  createAndRunRebuildKnowledgeIndexJob,
  listInstitutionKnowledgeIndexingJobs,
  type KnowledgeIndexingJobType,
} from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const allowedJobTypes = new Set<KnowledgeIndexingJobType>([
  'parse_file',
  'generate_embeddings',
  'rebuild_embeddings',
  'rebuild_knowledge_index',
]);

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function requireInstitutionAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return {
      ok: false as const,
      response: NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 }),
    };
  }
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return { ok: false as const, response: forbiddenResponse() };
  }

  return { ok: true as const, accessContext };
}

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return Object.prototype.toString.call(body) === '[object Object]'
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'forbidden') return 403;
  if (status === 'not_found') return 404;
  if (status === 'failed') return 503;
  return 200;
}

function errorPayloadForStatus(status: string, message?: string) {
  if (status === 'forbidden') return { code: 'forbidden', error: '没有访问权限' };
  if (status === 'not_found') return { code: 'not_found', error: '记录不存在' };
  if (status === 'validation_failed') return { code: 'validation_error', error: message ?? '请求参数不正确' };
  return { code: 'service_unavailable', error: '知识库索引任务暂时不可用' };
}

export async function GET(request: Request) {
  const access = requireInstitutionAccess(request);
  if (!access.ok) return access.response;

  try {
    const url = new URL(request.url);
    const result = await listInstitutionKnowledgeIndexingJobs({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input: {
        tenantId: access.accessContext.tenantId,
        institutionId: access.accessContext.institutionId,
        limit: parseLimit(url.searchParams.get('limit')),
      },
    });
    if (result.status !== 'succeeded') {
      return NextResponse.json(errorPayloadForStatus(result.status, 'message' in result ? result.message : undefined), {
        status: statusCodeForResult(result.status),
      });
    }

    return NextResponse.json({ records: result.records }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库索引任务暂时不可用' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const access = requireInstitutionAccess(request);
  if (!access.ok) return access.response;

  try {
    const body = await readBody(request);
    const jobType = typeof body.jobType === 'string' && allowedJobTypes.has(body.jobType as KnowledgeIndexingJobType)
      ? body.jobType as KnowledgeIndexingJobType
      : null;
    if (!jobType) {
      return NextResponse.json({ code: 'validation_error', error: '索引任务类型不正确' }, { status: 400 });
    }

    const repository = createPlatformKnowledgeManagementRepository(getDatabase());
    const taskInput = {
      tenantId: access.accessContext.tenantId,
      institutionId: access.accessContext.institutionId,
      actorUserId: access.accessContext.userId,
      knowledgeId: typeof body.knowledgeId === 'string' ? body.knowledgeId : null,
      fileId: typeof body.fileId === 'string' ? body.fileId : null,
    };
    const result = jobType === 'parse_file'
      ? await createAndRunParseFileJob({
        repository,
        storage: createLocalPlatformKnowledgeFileStorage(),
        input: taskInput,
      })
      : jobType === 'generate_embeddings'
        ? await createAndRunGenerateEmbeddingsJob({ repository, input: taskInput })
        : jobType === 'rebuild_embeddings'
          ? await createAndRunRebuildEmbeddingsJob({ repository, input: taskInput })
          : await createAndRunRebuildKnowledgeIndexJob({
            repository,
            storage: createLocalPlatformKnowledgeFileStorage(),
            input: {
              tenantId: taskInput.tenantId,
              institutionId: taskInput.institutionId,
              actorUserId: taskInput.actorUserId,
              knowledgeId: taskInput.knowledgeId,
            },
          });

    if (!('job' in result)) {
      return NextResponse.json(errorPayloadForStatus(result.status, 'message' in result ? result.message : undefined), {
        status: statusCodeForResult(result.status),
      });
    }
    return NextResponse.json(result.job, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识库索引任务暂时不可用' },
      { status: 503 },
    );
  }
}
