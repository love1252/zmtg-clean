'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Download, FileText, RefreshCw, Search } from 'lucide-react';
import type {
  InstitutionKnowledgeItemDto,
  InstitutionKnowledgeListResponse,
} from '@/modules/institution/domain/institution-knowledge-management';
import {
  listInstitutionKnowledgeItems,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import { getKnowledgeBaseControlledTrialReadiness } from '@/modules/knowledge-base/domain/v1-knowledge-base-controlled-trial-readiness';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { cn } from '@/shared/utils/cn';

type LoadStatus = 'loading' | 'success' | 'error';
type InstitutionKnowledgeFileRecord = {
  fileId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'active' | 'archived';
  fileType: string;
  sizeLabel: string;
  parseStatus: 'pending' | 'processing' | 'succeeded' | 'failed';
  safeFailureMessage: string | null;
  chunkCount: number;
};
type InstitutionKnowledgeChunkRecord = {
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  charCount: number;
};
type InstitutionKnowledgeSearchResultRecord = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  matchReason: string;
};
type InstitutionKnowledgeVectorSearchResultRecord = InstitutionKnowledgeSearchResultRecord & {
  score: number;
};
type InstitutionKnowledgeQaResponseRecord = {
  answer: string;
  citations: InstitutionKnowledgeVectorSearchResultRecord[];
  retrievalMode: 'keyword' | 'vector' | 'hybrid';
  auditId: string;
  safeStatus: 'answered' | 'no_citation';
};
type InstitutionKnowledgeQaAuditRecord = {
  auditId: string;
  tenantId: string;
  institutionId: string | null;
  actorScope: 'platform' | 'institution';
  actorUserId: string;
  question: string;
  answerPreview: string;
  retrievalMode: 'keyword' | 'vector' | 'hybrid';
  citationCount: number;
  safeStatus: string;
  safeFailureMessage: string | null;
  createdAt: string;
};

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

const parseStatusLabels: Record<InstitutionKnowledgeFileRecord['parseStatus'], string> = {
  pending: '待解析',
  processing: '解析中',
  succeeded: '解析成功',
  failed: '解析失败',
};

const qaRetrievalModeLabels: Record<InstitutionKnowledgeQaAuditRecord['retrievalMode'], string> = {
  hybrid: '混合检索',
  keyword: '关键词',
  vector: '语义',
};

const controlledTrialReadiness = getKnowledgeBaseControlledTrialReadiness();

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
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);
  const [filesByKnowledgeId, setFilesByKnowledgeId] = useState<Record<string, InstitutionKnowledgeFileRecord[]>>({});
  const [chunksByFileId, setChunksByFileId] = useState<Record<string, InstitutionKnowledgeChunkRecord[]>>({});
  const [expandedChunkFileId, setExpandedChunkFileId] = useState<string | null>(null);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [chunkSearchInput, setChunkSearchInput] = useState('');
  const [chunkSearchResults, setChunkSearchResults] = useState<InstitutionKnowledgeSearchResultRecord[]>([]);
  const [chunkSearchMessage, setChunkSearchMessage] = useState('请输入关键词检索已解析片段');
  const [isChunkSearching, setIsChunkSearching] = useState(false);
  const [vectorSearchInput, setVectorSearchInput] = useState('');
  const [vectorSearchResults, setVectorSearchResults] = useState<InstitutionKnowledgeVectorSearchResultRecord[]>([]);
  const [vectorSearchMessage, setVectorSearchMessage] = useState('请输入内容进行语义检索');
  const [isVectorSearching, setIsVectorSearching] = useState(false);
  const [qaQuestionInput, setQaQuestionInput] = useState('');
  const [qaRetrievalMode, setQaRetrievalMode] = useState<'keyword' | 'vector' | 'hybrid'>('hybrid');
  const [qaResponse, setQaResponse] = useState<InstitutionKnowledgeQaResponseRecord | null>(null);
  const [qaMessage, setQaMessage] = useState('请输入问题发起知识库问答');
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [qaAuditRecords, setQaAuditRecords] = useState<InstitutionKnowledgeQaAuditRecord[]>([]);
  const [qaAuditMessage, setQaAuditMessage] = useState('点击刷新查看问答审计');
  const [isQaAuditLoading, setIsQaAuditLoading] = useState(false);
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

  async function loadKnowledgeFiles(knowledgeId: string) {
    setExpandedKnowledgeId(knowledgeId);
    setFileMessage(null);
    try {
      const response = await fetch(
        `/api/institution/knowledge-management/items/${encodeURIComponent(knowledgeId)}/files`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setFileMessage('知识库文件暂时不可用');
        return;
      }
      setFilesByKnowledgeId((current) => ({
        ...current,
        [knowledgeId]: payload.records as InstitutionKnowledgeFileRecord[],
      }));
    } catch {
      setFileMessage('知识库文件暂时不可用');
    }
  }

  async function downloadKnowledgeFile(knowledgeId: string, file: InstitutionKnowledgeFileRecord) {
    setFileMessage(null);
    try {
      const response = await fetch(
        `/api/institution/knowledge-management/items/${encodeURIComponent(knowledgeId)}/files/${encodeURIComponent(file.fileId)}/download`,
        { method: 'GET' },
      );
      if (!response.ok) {
        setFileMessage('文件暂时无法下载');
        return;
      }
      const blob = await response.blob();
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.originalFilename;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      setFileMessage('文件下载已准备');
    } catch {
      setFileMessage('文件暂时无法下载');
    }
  }

  async function loadFileChunks(knowledgeId: string, file: InstitutionKnowledgeFileRecord) {
    setExpandedChunkFileId(file.fileId);
    setFileMessage(null);
    try {
      const response = await fetch(
        `/api/institution/knowledge-management/items/${encodeURIComponent(knowledgeId)}/files/${encodeURIComponent(file.fileId)}/parse/chunks`,
        { method: 'GET' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setFileMessage('解析片段暂时不可用');
        return;
      }
      setChunksByFileId((current) => ({
        ...current,
        [file.fileId]: payload.records as InstitutionKnowledgeChunkRecord[],
      }));
    } catch {
      setFileMessage('解析片段暂时不可用');
    }
  }

  async function searchChunks(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = chunkSearchInput.trim();
    if (!keyword) {
      setChunkSearchResults([]);
      setChunkSearchMessage('请输入关键词后再检索知识片段');
      return;
    }

    setIsChunkSearching(true);
    setChunkSearchMessage('正在检索片段...');
    try {
      const params = new URLSearchParams({ keyword });
      const response = await fetch(`/api/institution/knowledge-management/search?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setChunkSearchResults([]);
        setChunkSearchMessage('知识库片段检索暂时不可用');
        return;
      }

      const records = payload.records as InstitutionKnowledgeSearchResultRecord[];
      setChunkSearchResults(records);
      setChunkSearchMessage(records.length > 0 ? `已命中 ${records.length} 个引用片段` : '暂无匹配片段');
    } catch {
      setChunkSearchResults([]);
      setChunkSearchMessage('知识库片段检索暂时不可用');
    } finally {
      setIsChunkSearching(false);
    }
  }

  async function searchVectorChunks(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = vectorSearchInput.trim();
    if (!query) {
      setVectorSearchResults([]);
      setVectorSearchMessage('请输入语义检索内容');
      return;
    }

    setIsVectorSearching(true);
    setVectorSearchMessage('正在检索相似片段...');
    try {
      const params = new URLSearchParams({ query });
      const response = await fetch(`/api/institution/knowledge-management/vector-search?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setVectorSearchResults([]);
        setVectorSearchMessage('知识库向量检索暂时不可用');
        return;
      }

      const records = payload.records as InstitutionKnowledgeVectorSearchResultRecord[];
      setVectorSearchResults(records);
      setVectorSearchMessage(records.length > 0 ? `已命中 ${records.length} 个相似片段` : '暂无相似片段');
    } catch {
      setVectorSearchResults([]);
      setVectorSearchMessage('知识库向量检索暂时不可用');
    } finally {
      setIsVectorSearching(false);
    }
  }

  async function askKnowledgeBase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = qaQuestionInput.trim();
    if (!question) {
      setQaResponse(null);
      setQaMessage('请输入知识库问答问题');
      return;
    }

    setIsQaLoading(true);
    setQaMessage('正在基于引用片段生成回答...');
    try {
      const response = await fetch('/api/institution/knowledge-management/qa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          retrievalMode: qaRetrievalMode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload.answer !== 'string' || !Array.isArray(payload.citations)) {
        setQaResponse(null);
        setQaMessage(
          payload && typeof payload.message === 'string'
            ? payload.message
            : '知识库问答暂时不可用',
        );
        return;
      }

      const nextResponse = payload as InstitutionKnowledgeQaResponseRecord;
      setQaResponse(nextResponse);
      setQaMessage(
        nextResponse.safeStatus === 'no_citation'
          ? '当前范围暂无可引用片段'
          : `已生成回答，引用 ${nextResponse.citations.length} 个片段`,
      );
    } catch {
      setQaResponse(null);
      setQaMessage('知识库问答暂时不可用');
    } finally {
      setIsQaLoading(false);
    }
  }

  async function loadQaAudits() {
    setIsQaAuditLoading(true);
    setQaAuditMessage('正在读取问答审计...');
    try {
      const response = await fetch('/api/institution/knowledge-management/qa/audits', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setQaAuditRecords([]);
        setQaAuditMessage('问答审计暂时不可用');
        return;
      }

      const records = payload.records as InstitutionKnowledgeQaAuditRecord[];
      setQaAuditRecords(records);
      setQaAuditMessage(records.length > 0 ? `已读取 ${records.length} 条问答审计` : '暂无问答审计记录');
    } catch {
      setQaAuditRecords([]);
      setQaAuditMessage('问答审计暂时不可用');
    } finally {
      setIsQaAuditLoading(false);
    }
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

      <section
        aria-label="机构端知识库只读试用说明"
        className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-cyan-700">{controlledTrialReadiness.status}</div>
            <h2 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">只读试用说明</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {controlledTrialReadiness.institution.notice}
            </p>
          </div>
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700">
            只读链路
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
            <h3 className="text-xs font-semibold text-slate-700">可只读试用</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {controlledTrialReadiness.institution.allowedCapabilities.map((capability) => (
                <span
                  key={capability.id}
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                >
                  {capability.label}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
            <h3 className="text-xs font-semibold text-slate-700">禁止操作</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {controlledTrialReadiness.institution.forbiddenActions.map((action) => (
                <span
                  key={action.id}
                  className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                >
                  {action.label}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-white/80 p-3">
            <h3 className="text-xs font-semibold text-slate-700">仍未开放</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {controlledTrialReadiness.blockedCapabilities
                .filter((capability) =>
                  ['ocr', 'scannedPdf', 'realAi', 'vectorStore', 'runtimeIngestion', 'workerQueue'].includes(
                    capability.id,
                  ),
                )
                .map((capability) => (
                  <span
                    key={capability.id}
                    className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                  >
                    {capability.label}
                  </span>
                ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {controlledTrialReadiness.lowSensitiveBoundaries[0]}
        </p>
      </section>

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

      {status === 'success' ? (
        <section
          aria-label="机构端知识片段检索"
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">检索片段</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">按关键词查看本机构可见知识库的引用片段。</p>
            </div>
            <form onSubmit={searchChunks} className="flex w-full flex-col gap-2 sm:flex-row lg:w-[460px]">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="输入片段检索关键词"
                  value={chunkSearchInput}
                  onChange={(event) => setChunkSearchInput(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-400"
                  placeholder="输入关键词"
                />
              </label>
              <button
                type="submit"
                disabled={isChunkSearching}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChunkSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                检索片段
              </button>
            </form>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            {chunkSearchMessage}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {chunkSearchResults.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                暂无匹配片段
              </div>
            ) : (
              chunkSearchResults.map((result) => (
                <article key={result.chunkId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold text-slate-500">
                    {result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{result.textPreview}</p>
                  <div className="mt-2 text-xs font-semibold text-cyan-700">{result.matchReason}</div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {status === 'success' ? (
        <section
          aria-label="机构端语义检索"
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">语义检索</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">按 mock embedding 相似度查看本机构可见引用片段。</p>
            </div>
            <form onSubmit={searchVectorChunks} className="flex w-full flex-col gap-2 sm:flex-row lg:w-[460px]">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="输入语义检索内容"
                  value={vectorSearchInput}
                  onChange={(event) => setVectorSearchInput(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-400"
                  placeholder="输入检索内容"
                />
              </label>
              <button
                type="submit"
                disabled={isVectorSearching}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVectorSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                语义检索
              </button>
            </form>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            {vectorSearchMessage}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {vectorSearchResults.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                暂无相似片段
              </div>
            ) : (
              vectorSearchResults.map((result) => (
                <article key={result.chunkId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <span>{result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}</span>
                    <span className="text-cyan-700">相似度 {result.score.toFixed(3)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{result.textPreview}</p>
                  <div className="mt-2 text-xs font-semibold text-cyan-700">{result.matchReason}</div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {status === 'success' ? (
        <section
          aria-label="机构端知识库问答"
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识库问答</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">基于本机构授权可见引用片段生成低敏回答。</p>
            </div>
            <form onSubmit={askKnowledgeBase} className="flex w-full flex-col gap-2 lg:w-[620px]">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label="输入知识库问题"
                    value={qaQuestionInput}
                    onChange={(event) => setQaQuestionInput(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-400"
                    placeholder="输入问题"
                  />
                </label>
                <select
                  aria-label="选择问答检索模式"
                  value={qaRetrievalMode}
                  onChange={(event) => setQaRetrievalMode(event.target.value as 'keyword' | 'vector' | 'hybrid')}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="hybrid">混合检索</option>
                  <option value="keyword">关键词</option>
                  <option value="vector">语义</option>
                </select>
                <button
                  type="submit"
                  disabled={isQaLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQaLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                  发起问答
                </button>
              </div>
            </form>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            {qaMessage}
          </div>
          {!qaResponse ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
              暂无问答结果
            </div>
          ) : (
            <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-xs font-semibold text-slate-500">
                  {qaResponse.retrievalMode === 'hybrid' ? '混合检索' : qaResponse.retrievalMode === 'keyword' ? '关键词' : '语义'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{qaResponse.answer}</p>
                <div className="mt-2 text-xs font-semibold text-cyan-700">审计编号 {qaResponse.auditId}</div>
              </article>
              <div className="grid gap-3">
                {qaResponse.citations.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                    暂无引用来源
                  </div>
                ) : (
                  qaResponse.citations.map((citation) => (
                    <article key={citation.chunkId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                        <span>{citation.knowledgeTitle} · {citation.fileName} · 片段 {citation.chunkIndex + 1}</span>
                        <span className="text-cyan-700">分数 {citation.score.toFixed(3)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{citation.textPreview}</p>
                      <div className="mt-2 text-xs font-semibold text-cyan-700">{citation.matchReason}</div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {status === 'success' ? (
        <section
          aria-label="机构端问答审计"
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">问答审计</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">只读查看本机构知识库问答记录。</p>
            </div>
            <button
              type="button"
              onClick={loadQaAudits}
              disabled={isQaAuditLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isQaAuditLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新审计
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            {qaAuditMessage}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {qaAuditRecords.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                暂无问答审计
              </div>
            ) : (
              qaAuditRecords.map((record) => (
                <article key={record.auditId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <span>{qaRetrievalModeLabels[record.retrievalMode]} · 引用 {record.citationCount}</span>
                    <span>{formatDate(record.createdAt)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold tracking-normal text-slate-900">{record.question}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{record.answerPreview}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      {record.safeStatus}
                    </span>
                    {record.safeFailureMessage ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                        {record.safeFailureMessage}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
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

              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => loadKnowledgeFiles(item.knowledgeId)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
                >
                  <FileText className="h-4 w-4" />
                  查看文件
                </button>

                {expandedKnowledgeId === item.knowledgeId ? (
                  <div className="mt-3 space-y-2">
                    {fileMessage ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        {fileMessage}
                      </div>
                    ) : null}

                    {(filesByKnowledgeId[item.knowledgeId] ?? []).length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        暂无可下载文件
                      </div>
                    ) : (
                      (filesByKnowledgeId[item.knowledgeId] ?? []).map((file) => (
                        <div
                          key={file.fileId}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {file.originalFilename}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {file.fileType} · {file.sizeLabel}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {parseStatusLabels[file.parseStatus]} · {file.chunkCount} 片段
                            </div>
                            {file.safeFailureMessage ? (
                              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                                {file.safeFailureMessage}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadFileChunks(item.knowledgeId, file)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-700 transition hover:border-cyan-300"
                            >
                              <FileText className="h-4 w-4" />
                              查看解析片段
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadKnowledgeFile(item.knowledgeId, file)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                            >
                              <Download className="h-4 w-4" />
                              下载文件
                            </button>
                          </div>
                          {expandedChunkFileId === file.fileId ? (
                            <div className="sm:col-span-2">
                              {(chunksByFileId[file.fileId] ?? []).length === 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                                  暂无解析片段
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {(chunksByFileId[file.fileId] ?? []).map((chunk) => (
                                    <div key={chunk.chunkId} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                      <div className="text-xs font-semibold text-slate-500">
                                        片段 {chunk.chunkIndex + 1} · {chunk.charCount} 字
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{chunk.textPreview}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
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
