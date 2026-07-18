import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sideEffects = vi.hoisted(() => ({
  getAccessContext: vi.fn(() => {
    throw new Error('session must not be read');
  }),
  getDatabase: vi.fn(() => {
    throw new Error('database must not be opened');
  }),
  createPlatformRepository: vi.fn(() => {
    throw new Error('platform repository must not be created');
  }),
  createInstitutionRepository: vi.fn(() => {
    throw new Error('institution repository must not be created');
  }),
  createStorage: vi.fn(() => {
    throw new Error('storage must not be created');
  }),
  uploadService: vi.fn(() => {
    throw new Error('upload service must not run');
  }),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: sideEffects.getAccessContext,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: sideEffects.getDatabase,
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => ({
  createPlatformKnowledgeManagementRepository: sideEffects.createPlatformRepository,
}));

vi.mock('@/modules/institution/server/institution-knowledge-write-repository', () => ({
  createInstitutionKnowledgeWriteRepository: sideEffects.createInstitutionRepository,
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-file-storage', () => ({
  createLocalPlatformKnowledgeFileStorage: sideEffects.createStorage,
}));

vi.mock('@/modules/institution/server/institution-knowledge-upload-service', () => ({
  uploadAndParseInstitutionKnowledgeFileService: sideEffects.uploadService,
}));

import { POST as knowledgeUploadPost } from '@/app/api/institution/knowledge-management/upload/route';

const expectedBody = Object.freeze({
  code: 'capability_disabled',
  error: '机构知识库上传能力暂未启用。',
});

beforeEach(() => {
  vi.clearAllMocks();
});

function expectNoUploadSideEffects() {
  expect(sideEffects.getAccessContext).not.toHaveBeenCalled();
  expect(sideEffects.getDatabase).not.toHaveBeenCalled();
  expect(sideEffects.createPlatformRepository).not.toHaveBeenCalled();
  expect(sideEffects.createInstitutionRepository).not.toHaveBeenCalled();
  expect(sideEffects.createStorage).not.toHaveBeenCalled();
  expect(sideEffects.uploadService).not.toHaveBeenCalled();
}

describe('机构知识库上传 API capability-off route', () => {
  it('对不可读取的 Request 和 route params 仍固定返回无缓存 503', async () => {
    const hostileRequest = new Proxy({} as Request, {
      get() {
        throw new Error('request must not be inspected');
      },
      ownKeys() {
        throw new Error('request keys must not be inspected');
      },
    });
    const hostileRouteContext = new Proxy({}, {
      get() {
        throw new Error('route params must not be inspected');
      },
    });

    const response = await (
      knowledgeUploadPost as unknown as (
        request: Request,
        context: unknown,
      ) => Response | Promise<Response>
    )(hostileRequest, hostileRouteContext);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(expectedBody);
    expectNoUploadSideEffects();
  });

  it('不读取 formData、arrayBuffer、headers、URL 或 body，也不产生文件和记录', async () => {
    const formData = vi.fn(() => {
      throw new Error('formData must not be read');
    });
    const arrayBuffer = vi.fn(() => {
      throw new Error('arrayBuffer must not be read');
    });
    const json = vi.fn(() => {
      throw new Error('body must not be read');
    });
    const request = {
      formData,
      arrayBuffer,
      json,
      headers: new Proxy({}, {
        get() {
          throw new Error('headers must not be read');
        },
      }),
      url: 'http://localhost/api/institution/knowledge-management/upload?filename=private-record.pdf',
      body: 'raw-private-treatment-record',
    } as unknown as Request;

    const response = await knowledgeUploadPost(request);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual(expectedBody);
    expect(JSON.stringify(body)).not.toMatch(
      /private-record|treatment|filename|storage|database|session|provider|token|secret/iu,
    );
    expect(formData).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expectNoUploadSideEffects();
  });

  it('源码不保留旧认证、数据库、repository、storage 或上传服务链路', () => {
    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/knowledge-management/upload/route.ts',
      ),
      'utf8',
    );

    for (const forbidden of [
      'getDemoAccessContextFromRequest',
      'getDatabase',
      'createPlatformKnowledgeManagementRepository',
      'createInstitutionKnowledgeWriteRepository',
      'createLocalPlatformKnowledgeFileStorage',
      'uploadAndParseInstitutionKnowledgeFileService',
      '_request.formData(',
      '_request.arrayBuffer(',
      '_request.json(',
    ]) {
      expect(implementation).not.toContain(forbidden);
    }
  });
});
