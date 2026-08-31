import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  upload: vi.fn(),
  read: vi.fn(),
  confirm: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-knowledge-upload-runtime', () => ({
  uploadCurrentInstitutionKnowledgeV1: runtime.upload,
  readCurrentInstitutionKnowledgeUploadV1: runtime.read,
  confirmCurrentInstitutionKnowledgeUploadV1: runtime.confirm,
  publishCurrentInstitutionKnowledgeUploadV1: runtime.publish,
}));

vi.mock('@/modules/security/server/mutation-request-security', () => ({
  validateSameOriginMutationRequest: vi.fn(() => ({ ok: true })),
}));

import {
  GET,
  PATCH,
  POST,
  PUT,
} from '@/app/api/institution/knowledge-management/upload/route';

const readyUpload = Object.freeze({
  kind: 'ready' as const,
  upload: Object.freeze({
    uploadId: 'ku-1',
    knowledgeId: 'kd-1',
    fileName: '护理.md',
    fileSize: 12,
    mimeType: 'text/markdown',
    parserType: 'markdown',
    warningCodes: Object.freeze([]),
    title: '护理',
    category: '机构上传',
    state: 'parsed' as const,
    revision: 1,
    sectionCount: 1,
    sections: Object.freeze([{ index: 0, preview: '术后护理', charCount: 4 }]),
    publishedVersion: null,
    publishedAt: null,
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  runtime.upload.mockResolvedValue(readyUpload);
  runtime.read.mockResolvedValue(readyUpload);
  runtime.confirm.mockResolvedValue({
    ...readyUpload,
    upload: { ...readyUpload.upload, state: 'confirmed', revision: 2 },
  });
  runtime.publish.mockResolvedValue({
    ...readyUpload,
    upload: {
      ...readyUpload.upload,
      state: 'published',
      revision: 3,
      publishedVersion: 1,
      publishedAt: '2026-08-31T00:00:00.000Z',
    },
  });
});

describe('机构知识库正式上传 API', () => {
  it('接收支持文件并返回解析预览', async () => {
    const content = new TextEncoder().encode('# 术后护理');
    const file = {
      name: '护理.md',
      type: 'text/markdown',
      size: content.byteLength,
      arrayBuffer: async () => content.buffer,
    };
    const form = new FormData();
    vi.spyOn(form, 'keys').mockReturnValue(['file'][Symbol.iterator]());
    vi.spyOn(form, 'get').mockReturnValue(file as unknown as FormDataEntryValue);
    const request = {
      headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }),
      formData: async () => form,
    } as unknown as Request;
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(runtime.upload).toHaveBeenCalledWith(expect.objectContaining({
      fileName: '护理.md',
      mimeType: 'text/markdown',
      content: expect.any(Uint8Array),
    }));
    await expect(response.json()).resolves.toEqual(readyUpload);
  });

  it('拒绝空文件或错误 multipart', async () => {
    const response = await POST(new Request(
      'http://localhost/api/institution/knowledge-management/upload',
      { method: 'POST', body: 'not-a-file' },
    ));
    expect(response.status).toBe(400);
    expect(runtime.upload).not.toHaveBeenCalled();
  });

  it('按 uploadId 读取服务端预览', async () => {
    const response = await GET(new Request(
      'http://localhost/api/institution/knowledge-management/upload?uploadId=ku-1',
    ));
    expect(response.status).toBe(200);
    expect(runtime.read).toHaveBeenCalledWith('ku-1');
  });

  it('确认标题与分类时传递乐观锁版本', async () => {
    const response = await PATCH(new Request(
      'http://localhost/api/institution/knowledge-management/upload',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: 'ku-1',
          expectedRevision: 1,
          title: '正式护理知识',
          category: '术后护理',
        }),
      },
    ));
    expect(response.status).toBe(200);
    expect(runtime.confirm).toHaveBeenCalledWith({
      uploadId: 'ku-1',
      expectedRevision: 1,
      title: '正式护理知识',
      category: '术后护理',
    });
  });

  it('发布确认草稿并返回正式版本', async () => {
    const response = await PUT(new Request(
      'http://localhost/api/institution/knowledge-management/upload',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadId: 'ku-1', expectedRevision: 2 }),
      },
    ));
    expect(response.status).toBe(200);
    expect(runtime.publish).toHaveBeenCalledWith({ uploadId: 'ku-1', expectedRevision: 2 });
    await expect(response.json()).resolves.toMatchObject({
      kind: 'ready',
      upload: { state: 'published', publishedVersion: 1 },
    });
  });

  it.each([
    [{ kind: 'forbidden', code: 'forbidden' }, 403],
    [{ kind: 'conflict', code: 'conflict' }, 409],
    [{ kind: 'unavailable', code: 'unavailable' }, 503],
  ] as const)('保留失败类型与 HTTP 状态 %#', async (result, status) => {
    runtime.read.mockResolvedValueOnce(result);
    const response = await GET(new Request(
      'http://localhost/api/institution/knowledge-management/upload?uploadId=ku-1',
    ));
    expect(response.status).toBe(status);
  });

  it('运行时异常时返回稳定的不可用状态，不泄露内部错误', async () => {
    runtime.read.mockRejectedValueOnce(new Error('database connection contains sensitive details'));
    const response = await GET(new Request(
      'http://localhost/api/institution/knowledge-management/upload?uploadId=ku-1',
    ));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_knowledge_upload_runtime_unavailable',
    });
  });
});
