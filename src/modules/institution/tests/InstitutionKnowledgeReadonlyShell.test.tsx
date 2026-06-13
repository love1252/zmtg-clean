import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionKnowledgeReadonlyShell } from '@/modules/institution/components/InstitutionKnowledgeReadonlyShell';
import { listInstitutionKnowledgeItems } from '@/modules/institution/client/tenant-business-client';

vi.mock('@/modules/institution/client/tenant-business-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/client/tenant-business-client')
  >('@/modules/institution/client/tenant-business-client');

  return {
    ...actual,
    listInstitutionKnowledgeItems: vi.fn(),
  };
});

const pageInfo = {
  page: 1,
  pageSize: 10,
  total: 1,
  pageCount: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

describe('机构端知识库只读列表 UI', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({
            requestId: 'institution-knowledge-keyword-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-ui-a',
                knowledgeTitle: '授权可见术后护理',
                fileId: 'institution-file-a',
                fileName: '机构文件.pdf',
                chunkId: 'institution-search-chunk-a',
                chunkIndex: 0,
                textPreview: '机构端冷敷引用片段',
                matchReason: '片段包含关键词“冷敷”',
              },
            ],
            pageInfo: pageInfo,
            emptyState: {
              title: '暂无匹配片段',
              description: '当前范围没有命中关键词的已解析知识片段。',
            },
          });
        }
        if (url.includes('/parse/chunks')) {
          return Response.json({
            readonly: true,
            records: [
              {
                chunkId: 'institution-chunk-a',
                tenantId: 'tenant-a',
                knowledgeId: 'knowledge-ui-a',
                fileId: 'institution-file-a',
                chunkIndex: 0,
                textPreview: '机构端授权可见解析片段',
                charCount: 12,
                createdAt: '2026-06-13T08:00:00.000Z',
                updatedAt: '2026-06-13T08:00:00.000Z',
              },
            ],
          });
        }
        if (url.includes('/download')) {
          return new Response('file bytes', {
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('机构文件.pdf')}`,
            },
          });
        }

        return Response.json({
          records: [
            {
              fileId: 'institution-file-a',
              tenantId: 'tenant-a',
              knowledgeId: 'knowledge-ui-a',
              originalFilename: '机构文件.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'd'.repeat(64),
              status: 'active',
              uploadedByUserId: 'platform-user',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: null,
              fileType: 'PDF',
              sizeLabel: '10 B',
              parseStatus: 'succeeded',
              safeFailureMessage: null,
              chunkCount: 1,
            },
          ],
          pageInfo: pageInfo,
        });
      }),
    );
    vi.mocked(listInstitutionKnowledgeItems).mockReset();
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
      ok: true,
      records: [
        {
          knowledgeId: 'knowledge-ui-a',
          title: '授权可见术后护理',
          category: '术后护理',
          status: 'ready',
          readonlyStatus: 'readonly',
          sourceKind: 'demo',
          descriptionPreview: '低敏摘要，不包含正文。',
          chunkCount: 3,
          visibility: 'platform_authorized',
          updatedAt: '2026-06-13T08:00:00.000Z',
          createdAt: '2026-06-13T08:00:00.000Z',
        },
      ],
      pageInfo,
    });
  });

  it('展示 loading、低敏记录、搜索、刷新和分页状态', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(screen.getByText('正在加载机构知识库...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    expect(screen.getByText('低敏摘要，不包含正文。')).toBeInTheDocument();
    expect(screen.getByText('分块 3')).toBeInTheDocument();
    expect(screen.getByText('平台授权')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));
    expect(await screen.findByText('机构文件.pdf')).toBeInTheDocument();
    expect(screen.getByText('解析成功 · 1 片段')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看解析片段' }));
    expect(await screen.findByText('机构端授权可见解析片段')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/parse/chunks',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(screen.getByRole('button', { name: '下载文件' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/download',
      expect.objectContaining({ method: 'GET' }),
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText('搜索机构知识库'), {
        target: { value: '护理' },
      });
      fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    });

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    expect(listInstitutionKnowledgeItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '护理', page: 1 }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    });
    expect(listInstitutionKnowledgeItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '护理', page: 1 }),
    );
  });

  it('机构端新增检索片段区域，只读展示授权引用片段', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索关键词'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('机构端冷敷引用片段')).toBeInTheDocument();
    expect(screen.getByText('片段包含关键词“冷敷”')).toBeInTheDocument();
    expect(screen.getByText('授权可见术后护理 · 机构文件.pdf · 片段 1')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(searchSection.textContent).not.toContain('embedding');
    expect(searchSection.textContent).not.toContain('训练');
    expect(searchSection.textContent).not.toContain('问答');
  });

  it('展示 empty 和 error 状态，并且不出现上传下载导出解析训练等 CTA', async () => {
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: true,
      records: [],
      pageInfo: { ...pageInfo, total: 0, pageCount: 0 },
    });

    const { rerender } = render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByText('暂无授权可见知识库')).toBeInTheDocument();

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '知识库只读数据暂时不可用',
        status: 503,
      },
    });

    rerender(<InstitutionKnowledgeReadonlyShell />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    });

    expect(await screen.findByText('知识库只读数据暂时不可用')).toBeInTheDocument();

    const shell = screen.getByLabelText('机构知识库只读列表');
    ['上传', '导出', '解析', '训练', '归档', '删除'].forEach((label) => {
      expect(within(shell).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
  });
});
