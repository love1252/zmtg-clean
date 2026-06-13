'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import type {
  InstitutionKnowledgeItemDto,
  InstitutionKnowledgeListResponse,
} from '@/modules/institution/domain/institution-knowledge-management';
import {
  listInstitutionKnowledgeItems,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { cn } from '@/shared/utils/cn';

type LoadStatus = 'loading' | 'success' | 'error';

const statusLabels: Record<InstitutionKnowledgeItemDto['status'], string> = {
  ready: '可用',
  pending: '处理中',
  empty: '空内容',
  failed: '失败',
  disabled: '已下架',
  denied: '已拒绝',
};

const sourceKindLabels: Record<InstitutionKnowledgeItemDto['sourceKind'], string> = {
  demo: '演示',
  mock: '模拟',
  seed: '种子',
};

function visibleErrorMessage(error: TenantBusinessClientError | null) {
  if (!error) return '知识库只读数据暂时不可用';
  if (error.kind === 'forbidden') return '当前账号没有访问机构知识库的权限';
  if (error.kind === 'unauthorized') return '请先登录后查看机构知识库';
  return error.message || '知识库只读数据暂时不可用';
}

function visibleErrorDescription(error: TenantBusinessClientError | null) {
  const message = visibleErrorMessage(error);
  return message === '知识库只读数据暂时不可用' ? '请稍后刷新重试。' : message;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function InstitutionKnowledgeReadonlyShell() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [records, setRecords] = useState<InstitutionKnowledgeItemDto[]>([]);
  const [pageInfo, setPageInfo] = useState<InstitutionKnowledgeListResponse['pageInfo']>({
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [error, setError] = useState<TenantBusinessClientError | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadKnowledgeItems() {
      setStatus('loading');
      setError(null);

      const result = await listInstitutionKnowledgeItems({
        keyword,
        page,
        pageSize: 10,
      });

      if (!isActive) return;

      if (!result.ok) {
        setRecords([]);
        setError(result.error);
        setStatus('error');
        return;
      }

      setRecords(result.records);
      setPageInfo(result.pageInfo);
      setStatus('success');
    }

    void loadKnowledgeItems();

    return () => {
      isActive = false;
    };
  }, [keyword, page, refreshKey]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setKeyword(keywordInput.trim());
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <section
      aria-label="机构知识库只读列表"
      className="space-y-5 rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-7"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">机构端只读</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            知识库
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            当前仅展示平台授权给本机构或明确归属本机构的低敏知识库摘要。
          </p>
        </div>

        <form onSubmit={submitSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:w-[520px]">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="搜索机构知识库"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-400"
              placeholder="搜索名称、分类或摘要"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Search className="h-4 w-4" />
            搜索
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </form>
      </div>

      {status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载机构知识库..." />
      ) : null}

      {status === 'error' ? (
        <InstitutionPageState
          kind="error"
          title="知识库只读数据暂时不可用"
          description={visibleErrorDescription(error)}
        />
      ) : null}

      {status === 'success' && records.length === 0 ? (
        <InstitutionPageState
          kind="empty"
          title="暂无授权可见知识库"
          description="当前机构暂未获得平台授权的知识库，或搜索条件没有匹配结果。"
        />
      ) : null}

      {status === 'success' && records.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((item) => (
            <article
              key={item.knowledgeId}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-normal text-slate-950">
                    {item.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                      {item.visibility === 'platform_authorized' ? '平台授权' : '本机构归属'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {item.category}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {sourceKindLabels[item.sourceKind]}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    item.status === 'ready'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {statusLabels[item.status]}
                </span>
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                {item.descriptionPreview}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  分块 {item.chunkCount}
                </span>
                <span>更新于 {formatDate(item.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          共 {pageInfo.total} 条，当前第 {pageInfo.page} / {Math.max(pageInfo.pageCount, 1)} 页
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!pageInfo.hasPreviousPage}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>
          <button
            type="button"
            disabled={!pageInfo.hasNextPage}
            onClick={() => setPage((current) => current + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
