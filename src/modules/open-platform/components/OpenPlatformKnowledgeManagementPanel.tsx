'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  getOpenPlatformKnowledgeManagementErrorMessage,
  loadOpenPlatformKnowledgeManagementFiles,
  loadOpenPlatformKnowledgeManagementItems,
  loadOpenPlatformKnowledgeManagementView,
  OPEN_PLATFORM_KNOWLEDGE_FILE_PAGE_SIZE,
  OPEN_PLATFORM_KNOWLEDGE_ITEM_PAGE_SIZE,
  type OpenPlatformKnowledgeManagementFiles,
  type OpenPlatformKnowledgeManagementItems,
  type OpenPlatformKnowledgeManagementView,
} from '@/modules/open-platform/lib/platformKnowledgeManagementViewLoader';
import { cn } from '@/shared/utils/cn';

const ALL_TENANTS = 'all';

const sectionShell = 'rounded-[24px] border border-white/10 bg-white/[0.075] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl';
const innerCard = 'rounded-2xl border border-white/10 bg-[#071322]/72';

type KnowledgeFileParseStatus = OpenPlatformKnowledgeManagementFiles['records'][number]['parseStatus'];
type KnowledgeTrainingStatus = OpenPlatformKnowledgeManagementItems['records'][number]['trainingStatus'];
type ImportJobStatus = OpenPlatformKnowledgeManagementView['importJobs'][number]['status'];
type KnowledgeFileRecord = OpenPlatformKnowledgeManagementFiles['records'][number];
type KnowledgeItemRecord = OpenPlatformKnowledgeManagementItems['records'][number];
type ManagedKnowledgeFileRecord = {
  fileId: string;
  tenantId: string;
  knowledgeId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: 'active' | 'archived';
  uploadedByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  fileType: string;
  sizeLabel: string;
  parseStatus: 'pending' | 'processing' | 'succeeded' | 'failed';
  failureReasonCode: string | null;
  safeFailureMessage: string | null;
  textLength: number;
  chunkCount: number;
  parserVersion: string | null;
};
type ManagedKnowledgeChunkRecord = {
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  charCount: number;
};
type KnowledgeSearchResultRecord = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  matchReason: string;
};
type KnowledgeVectorSearchResultRecord = KnowledgeSearchResultRecord & {
  score: number;
};
type KnowledgeQaResponseRecord = {
  answer: string;
  citations: KnowledgeVectorSearchResultRecord[];
  retrievalMode: 'keyword' | 'vector' | 'hybrid';
  auditId: string;
  safeStatus: 'answered' | 'no_citation';
};
type KnowledgeQaAuditRecord = {
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
type KnowledgeBaseCapabilityRecord = {
  id: string;
  label: string;
  enabled: boolean;
  status: 'enabled' | 'disabled';
  summary: string;
  disabledReason: string | null;
  entryCondition: string | null;
};
type KnowledgeBaseCapabilityResponse = {
  requestId: 'knowledge-base-production-capabilities';
  readonly: true;
  capabilities: KnowledgeBaseCapabilityRecord[];
  qaQuotaPolicy: {
    tenantDailyLimit: number;
    institutionDailyLimit: number;
    usageLimitedMessage: string;
  };
};

const fileStatusLabels: Record<KnowledgeFileParseStatus, string> = {
  parsed: '已解析',
  failed: '解析失败',
  parsing: '解析中',
  pending: '待解析',
};

const fileStatusClasses: Record<KnowledgeFileParseStatus, string> = {
  parsed: 'border-emerald-300/20 bg-emerald-300/[0.10] text-emerald-100',
  failed: 'border-rose-300/20 bg-rose-300/[0.10] text-rose-100',
  parsing: 'border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100',
  pending: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100',
};

const trainingStatusLabels: Record<KnowledgeTrainingStatus, string> = {
  trained: '已完成',
  training: '处理中',
  pending: '待处理',
  failed: '处理异常',
};

const trainingStatusClasses: Record<KnowledgeTrainingStatus, string> = {
  trained: 'border-violet-300/20 bg-violet-300/[0.12] text-violet-100',
  training: 'border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100',
  pending: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100',
  failed: 'border-rose-300/20 bg-rose-300/[0.10] text-rose-100',
};

const importJobStatusLabels: Record<ImportJobStatus, string> = {
  completed: '已完成',
  running: '进行中',
  failed: '有失败',
  partial_failed: '部分失败',
};

const importJobStatusClasses: Record<ImportJobStatus, string> = {
  completed: 'border-violet-300/20 bg-violet-300/[0.12] text-violet-100',
  running: 'border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100',
  failed: 'border-rose-300/20 bg-rose-300/[0.10] text-rose-100',
  partial_failed: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100',
};

const managedParseStatusLabels: Record<ManagedKnowledgeFileRecord['parseStatus'], string> = {
  pending: '待解析',
  processing: '解析中',
  succeeded: '解析成功',
  failed: '解析失败',
};

const managedParseStatusClasses: Record<ManagedKnowledgeFileRecord['parseStatus'], string> = {
  pending: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100',
  processing: 'border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100',
  succeeded: 'border-emerald-300/20 bg-emerald-300/[0.10] text-emerald-100',
  failed: 'border-rose-300/20 bg-rose-300/[0.10] text-rose-100',
};

const qaRetrievalModeLabels: Record<KnowledgeQaAuditRecord['retrievalMode'], string> = {
  hybrid: '混合检索',
  keyword: '关键词',
  vector: '语义',
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatFileSize(kb: number) {
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB`;
  }

  return `${kb} KB`;
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

function EmptyState({ title, description }: { title?: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{title ?? '暂无匹配的知识库运营数据'}</div>
      <p className="mt-1 text-sm text-slate-400">{description ?? '请调整机构范围或文件名搜索条件后再查看。'}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(innerCard, 'p-4')}>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-white">{value}</div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', className)}>
      {children}
    </span>
  );
}

function KnowledgeFileCard({
  file,
  checked,
  onToggle,
}: {
  file: KnowledgeFileRecord;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.16)]">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`选择 ${file.fileName}`}
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-cyan-300"
        />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold tracking-normal text-white">{file.fileName}</h4>
          <p className="mt-1 truncate text-xs text-slate-400">{file.tenantName}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge className={fileStatusClasses[file.parseStatus]}>{fileStatusLabels[file.parseStatus]}</Badge>
        <span className="text-xs font-semibold text-slate-400">{file.fileType}</span>
        <span className="text-xs text-slate-500">·</span>
        <span className="text-xs font-semibold text-slate-400">{formatFileSize(file.fileSizeKb)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className="border-blue-300/20 bg-blue-300/[0.10] text-blue-100">{file.category}</Badge>
        <Badge className="border-violet-300/20 bg-violet-300/[0.12] text-violet-100">{file.folder}</Badge>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-400">
        <div className="flex items-center justify-between gap-3">
          <span>解析字符</span>
          <span className="font-semibold text-slate-200">{formatNumber(file.parsedChars)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>更新时间</span>
          <span className="font-semibold text-slate-200">{file.updatedAt}</span>
        </div>
      </div>

      {file.safeErrorMessage ? (
        <div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.08] px-3 py-2 text-xs leading-5 text-rose-100">
          {file.safeErrorMessage}
        </div>
      ) : null}
    </article>
  );
}

function KnowledgeTable({ items }: { items: KnowledgeItemRecord[] }) {
  if (items.length === 0) {
    return <EmptyState title="暂无知识条目" description="当前范围没有可展示的知识条目摘要。" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs font-semibold text-slate-400">
            <th className="border-b border-white/10 px-4 py-3">知识标题</th>
            <th className="border-b border-white/10 px-4 py-3">摘要预览</th>
            <th className="border-b border-white/10 px-4 py-3">机构</th>
            <th className="border-b border-white/10 px-4 py-3">分类 / 文件夹</th>
            <th className="border-b border-white/10 px-4 py-3">解析状态</th>
            <th className="border-b border-white/10 px-4 py-3">命中</th>
            <th className="border-b border-white/10 px-4 py-3">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.knowledgeId} className="align-top">
              <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{item.title}</td>
              <td className="max-w-[320px] border-b border-white/10 px-4 py-4 text-slate-400">
                <span className="line-clamp-2">{item.descriptionPreview}</span>
              </td>
              <td className="border-b border-white/10 px-4 py-4 text-slate-300">{item.tenantName}</td>
              <td className="border-b border-white/10 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-blue-300/20 bg-blue-300/[0.10] text-blue-100">{item.category}</Badge>
                  <Badge className="border-violet-300/20 bg-violet-300/[0.12] text-violet-100">{item.folder}</Badge>
                </div>
              </td>
              <td className="border-b border-white/10 px-4 py-4">
                <Badge className={trainingStatusClasses[item.trainingStatus]}>
                  {trainingStatusLabels[item.trainingStatus]} · {item.chunkCount} 片段
                </Badge>
              </td>
              <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{formatNumber(item.hitCount)}</td>
              <td className="border-b border-white/10 px-4 py-4 text-slate-400">{item.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fileManagementPath(input: { knowledgeId: string; tenantId: string }) {
  return `/api/v1/open-platform/knowledge-management/items/${encodeURIComponent(input.knowledgeId)}/files?tenantId=${encodeURIComponent(input.tenantId)}`;
}

function fileDownloadPath(input: { knowledgeId: string; tenantId: string; fileId: string }) {
  return `/api/v1/open-platform/knowledge-management/items/${encodeURIComponent(input.knowledgeId)}/files/${encodeURIComponent(input.fileId)}/download?tenantId=${encodeURIComponent(input.tenantId)}`;
}

function fileArchivePath(input: { knowledgeId: string; tenantId: string; fileId: string }) {
  return `/api/v1/open-platform/knowledge-management/items/${encodeURIComponent(input.knowledgeId)}/files/${encodeURIComponent(input.fileId)}?tenantId=${encodeURIComponent(input.tenantId)}`;
}

function fileParsePath(input: { knowledgeId: string; tenantId: string; fileId: string }) {
  return `/api/v1/open-platform/knowledge-management/items/${encodeURIComponent(input.knowledgeId)}/files/${encodeURIComponent(input.fileId)}/parse?tenantId=${encodeURIComponent(input.tenantId)}`;
}

function fileParseChunksPath(input: { knowledgeId: string; tenantId: string; fileId: string }) {
  return `/api/v1/open-platform/knowledge-management/items/${encodeURIComponent(input.knowledgeId)}/files/${encodeURIComponent(input.fileId)}/parse/chunks?tenantId=${encodeURIComponent(input.tenantId)}`;
}

function keywordSearchPath(input: { tenantId: string; keyword: string }) {
  const params = new URLSearchParams({
    tenantId: input.tenantId,
    keyword: input.keyword,
    page: '1',
    pageSize: '10',
  });

  return `/api/v1/open-platform/knowledge-management/search?${params.toString()}`;
}

function vectorEmbeddingPath() {
  return '/api/v1/open-platform/knowledge-management/embeddings';
}

function vectorSearchPath(input: { tenantId: string; query: string }) {
  const params = new URLSearchParams({
    tenantId: input.tenantId,
    query: input.query,
    page: '1',
    pageSize: '10',
  });

  return `/api/v1/open-platform/knowledge-management/vector-search?${params.toString()}`;
}

function knowledgeQaPath() {
  return '/api/v1/open-platform/knowledge-management/qa';
}

function qaAuditPath(input: { tenantId: string }) {
  const params = new URLSearchParams({
    tenantId: input.tenantId,
    page: '1',
    pageSize: '10',
  });

  return `/api/v1/open-platform/knowledge-management/qa/audits?${params.toString()}`;
}

function capabilitiesPath() {
  return '/api/v1/open-platform/knowledge-management/capabilities';
}

export function OpenPlatformKnowledgeManagementPanel() {
  const [selectedTenantId, setSelectedTenantId] = useState(ALL_TENANTS);
  const [fileSearch, setFileSearch] = useState('');
  const [filePage, setFilePage] = useState(1);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState('刚刚');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [view, setView] = useState<OpenPlatformKnowledgeManagementView | null>(null);
  const [filesResponse, setFilesResponse] = useState<OpenPlatformKnowledgeManagementFiles | null>(null);
  const [itemsResponse, setItemsResponse] = useState<OpenPlatformKnowledgeManagementItems | null>(null);
  const [managedKnowledgeId, setManagedKnowledgeId] = useState('');
  const [managedFiles, setManagedFiles] = useState<ManagedKnowledgeFileRecord[]>([]);
  const [managedChunksByFileId, setManagedChunksByFileId] = useState<Record<string, ManagedKnowledgeChunkRecord[]>>({});
  const [expandedParseFileId, setExpandedParseFileId] = useState<string | null>(null);
  const [managedFile, setManagedFile] = useState<File | null>(null);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);
  const [keywordSearchInput, setKeywordSearchInput] = useState('');
  const [keywordSearchResults, setKeywordSearchResults] = useState<KnowledgeSearchResultRecord[]>([]);
  const [keywordSearchMessage, setKeywordSearchMessage] = useState('请输入关键词检索已解析片段');
  const [isKeywordSearching, setIsKeywordSearching] = useState(false);
  const [embeddingMessage, setEmbeddingMessage] = useState('选择范围后可生成已解析片段的 mock embedding 索引');
  const [isEmbeddingLoading, setIsEmbeddingLoading] = useState(false);
  const [vectorSearchInput, setVectorSearchInput] = useState('');
  const [vectorSearchResults, setVectorSearchResults] = useState<KnowledgeVectorSearchResultRecord[]>([]);
  const [vectorSearchMessage, setVectorSearchMessage] = useState('请输入内容进行语义检索');
  const [isVectorSearching, setIsVectorSearching] = useState(false);
  const [qaQuestionInput, setQaQuestionInput] = useState('');
  const [qaRetrievalMode, setQaRetrievalMode] = useState<'keyword' | 'vector' | 'hybrid'>('hybrid');
  const [qaResponse, setQaResponse] = useState<KnowledgeQaResponseRecord | null>(null);
  const [qaMessage, setQaMessage] = useState('请输入问题发起知识库问答');
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [qaAuditRecords, setQaAuditRecords] = useState<KnowledgeQaAuditRecord[]>([]);
  const [qaAuditMessage, setQaAuditMessage] = useState('点击刷新查看问答审计');
  const [isQaAuditLoading, setIsQaAuditLoading] = useState(false);
  const [capabilityResponse, setCapabilityResponse] = useState<KnowledgeBaseCapabilityResponse | null>(null);
  const [capabilityMessage, setCapabilityMessage] = useState('正在读取生产能力状态...');
  const [isFileActionLoading, setIsFileActionLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshReasonRef = useRef<'auto' | 'sync'>('auto');
  const selectedTenantParam = selectedTenantId === ALL_TENANTS ? null : selectedTenantId;

  useEffect(() => {
    let isActive = true;
    const isManualSync = refreshReasonRef.current === 'sync';

    async function loadCapabilities() {
      const response = await fetch(capabilitiesPath(), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.capabilities)) {
        return null;
      }

      return payload as KnowledgeBaseCapabilityResponse;
    }

    Promise.all([
      loadOpenPlatformKnowledgeManagementView({ tenantId: selectedTenantParam }),
      loadOpenPlatformKnowledgeManagementFiles({
        tenantId: selectedTenantParam,
        keyword: fileSearch,
        page: filePage,
        pageSize: OPEN_PLATFORM_KNOWLEDGE_FILE_PAGE_SIZE,
      }),
      loadOpenPlatformKnowledgeManagementItems({
        tenantId: selectedTenantParam,
        page: 1,
        pageSize: OPEN_PLATFORM_KNOWLEDGE_ITEM_PAGE_SIZE,
      }),
      loadCapabilities(),
    ])
      .then(([nextView, nextFiles, nextItems, nextCapabilities]) => {
        if (!isActive) return;

        setView(nextView);
        setFilesResponse(nextFiles);
        setItemsResponse(nextItems);
        setCapabilityResponse(nextCapabilities);
        setCapabilityMessage(nextCapabilities ? '生产能力状态已加载' : '生产能力状态暂时无法加载');
        setErrorMessage(null);
        setSelectedFileIds((current) =>
          current.filter((fileId) => nextFiles.records.some((file) => file.fileId === fileId)),
        );
        if (isManualSync) {
          setLastSyncedAt(new Intl.DateTimeFormat('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date()));
        }
      })
      .catch((error: unknown) => {
        if (!isActive) return;

        setErrorMessage(getOpenPlatformKnowledgeManagementErrorMessage(error));
        setCapabilityResponse(null);
        setCapabilityMessage('生产能力状态暂时无法加载');
      })
      .finally(() => {
        if (!isActive) return;

        setIsLoading(false);
        setIsSyncing(false);
        refreshReasonRef.current = 'auto';
      });

    return () => {
      isActive = false;
    };
  }, [filePage, fileSearch, refreshVersion, selectedTenantParam]);

  const scopeName = view?.scopeName ?? '全部机构';
  const scopedFiles = filesResponse?.records ?? [];
  const scopedKnowledgeItems = itemsResponse?.records ?? [];
  const scopedJobs = view?.importJobs ?? [];
  const scopedTopQuestions = view?.topQuestions ?? [];
  const scopedCategories = view?.categoryStats ?? [];
  const filePageInfo = filesResponse?.pageInfo;
  const pageCount = Math.max(1, filePageInfo?.pageCount ?? 1);
  const safeFilePage = Math.min(filePageInfo?.page ?? filePage, pageCount);
  const totalFileCount = filePageInfo?.total ?? 0;
  const filePageSize = filePageInfo?.pageSize ?? OPEN_PLATFORM_KNOWLEDGE_FILE_PAGE_SIZE;
  const fileRangeStart = totalFileCount === 0 ? 0 : (safeFilePage - 1) * filePageSize + 1;
  const fileRangeEnd = Math.min(safeFilePage * filePageSize, totalFileCount);
  const maxCategoryHits = Math.max(1, ...scopedCategories.map((category) => category.hitCount));
  const parsedFileCount = view?.totals.parsedFileCount ?? 0;
  const failedFileCount = view?.totals.failedFileCount ?? 0;
  const zeroHitCount = view?.totals.zeroHitCount ?? 0;
  const effectiveManagedKnowledgeId = scopedKnowledgeItems.some(
    (item) => item.knowledgeId === managedKnowledgeId,
  )
    ? managedKnowledgeId
    : scopedKnowledgeItems[0]?.knowledgeId ?? '';
  const managedKnowledge = scopedKnowledgeItems.find(
    (item) => item.knowledgeId === effectiveManagedKnowledgeId,
  );

  useEffect(() => {
    let isActive = true;

    async function loadManagedFiles() {
      if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) {
        setManagedFiles([]);
        return;
      }

      setFileActionMessage(null);
      try {
        const response = await fetch(fileManagementPath({
          knowledgeId: managedKnowledge.knowledgeId,
          tenantId: managedKnowledge.tenantId,
        }), { cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (!isActive) return;

        if (!response.ok || !payload || !Array.isArray(payload.records)) {
          setManagedFiles([]);
          setFileActionMessage('知识库文件暂时无法加载');
          return;
        }

        setManagedFiles(payload.records as ManagedKnowledgeFileRecord[]);
      } catch {
        if (!isActive) return;
        setManagedFiles([]);
        setFileActionMessage('知识库文件暂时无法加载');
      }
    }

    void loadManagedFiles();

    return () => {
      isActive = false;
    };
  }, [managedKnowledge?.knowledgeId, managedKnowledge?.tenantId, refreshVersion]);

  function handleSelectTenant(tenantId: string) {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedTenantId(tenantId);
    setFilePage(1);
    setSelectedFileIds([]);
  }

  function handleFileSearchChange(value: string) {
    setIsLoading(true);
    setErrorMessage(null);
    setFileSearch(value);
    setFilePage(1);
    setSelectedFileIds([]);
  }

  function handleToggleFile(fileId: string) {
    setSelectedFileIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
    );
  }

  function handleSelectPage() {
    setSelectedFileIds(scopedFiles.map((file) => file.fileId));
  }

  function handlePreviousPage() {
    setIsLoading(true);
    setErrorMessage(null);
    setFilePage((current) => Math.max(1, current - 1));
  }

  function handleNextPage() {
    setIsLoading(true);
    setErrorMessage(null);
    setFilePage((current) => Math.min(pageCount, current + 1));
  }

  function handleSync() {
    refreshReasonRef.current = 'sync';
    setIsLoading(true);
    setErrorMessage(null);
    setIsSyncing(true);
    setRefreshVersion((current) => current + 1);
  }

  async function reloadManagedFiles() {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) return;

    const response = await fetch(fileManagementPath({
      knowledgeId: managedKnowledge.knowledgeId,
      tenantId: managedKnowledge.tenantId,
    }), { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload && Array.isArray(payload.records)) {
      setManagedFiles(payload.records as ManagedKnowledgeFileRecord[]);
    }
  }

  async function handleUploadManagedFile() {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId || !managedFile) return;

    setIsFileActionLoading(true);
    setFileActionMessage(null);
    try {
      const formData = new FormData();
      formData.set('tenantId', managedKnowledge.tenantId);
      formData.set('uploadedByUserId', 'platform-ui');
      formData.set('file', managedFile);
      const response = await fetch(fileManagementPath({
        knowledgeId: managedKnowledge.knowledgeId,
        tenantId: managedKnowledge.tenantId,
      }), {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        setFileActionMessage('文件上传失败，请检查类型和大小后重试');
        return;
      }
      setManagedFile(null);
      setFileActionMessage('文件已上传');
      await reloadManagedFiles();
    } catch {
      setFileActionMessage('文件上传失败，请检查类型和大小后重试');
    } finally {
      setIsFileActionLoading(false);
    }
  }

  async function handleDownloadManagedFile(file: ManagedKnowledgeFileRecord) {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) return;

    setFileActionMessage(null);
    try {
      const response = await fetch(fileDownloadPath({
        knowledgeId: managedKnowledge.knowledgeId,
        tenantId: managedKnowledge.tenantId,
        fileId: file.fileId,
      }), { method: 'GET' });
      if (!response.ok) {
        setFileActionMessage('文件暂时无法下载');
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
      setFileActionMessage('文件下载已准备');
    } catch {
      setFileActionMessage('文件暂时无法下载');
    }
  }

  async function handleArchiveManagedFile(file: ManagedKnowledgeFileRecord) {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) return;

    setIsFileActionLoading(true);
    setFileActionMessage(null);
    try {
      const response = await fetch(fileArchivePath({
        knowledgeId: managedKnowledge.knowledgeId,
        tenantId: managedKnowledge.tenantId,
        fileId: file.fileId,
      }), { method: 'DELETE' });
      if (!response.ok) {
        setFileActionMessage('文件归档失败，请稍后重试');
        return;
      }
      setFileActionMessage('文件已归档');
      await reloadManagedFiles();
    } catch {
      setFileActionMessage('文件归档失败，请稍后重试');
    } finally {
      setIsFileActionLoading(false);
    }
  }

  async function handleParseManagedFile(file: ManagedKnowledgeFileRecord) {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) return;

    setIsFileActionLoading(true);
    setFileActionMessage(null);
    try {
      const response = await fetch(fileParsePath({
        knowledgeId: managedKnowledge.knowledgeId,
        tenantId: managedKnowledge.tenantId,
        fileId: file.fileId,
      }), { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        setFileActionMessage('文件解析暂时无法处理');
        return;
      }
      setFileActionMessage(payload.status === 'failed' ? '文件解析失败：当前文件类型暂未接入解析器' : '文件解析已完成');
      await reloadManagedFiles();
    } catch {
      setFileActionMessage('文件解析暂时无法处理');
    } finally {
      setIsFileActionLoading(false);
    }
  }

  async function handleLoadManagedChunks(file: ManagedKnowledgeFileRecord) {
    if (!managedKnowledge?.tenantId || !managedKnowledge.knowledgeId) return;

    setExpandedParseFileId(file.fileId);
    setFileActionMessage(null);
    try {
      const response = await fetch(fileParseChunksPath({
        knowledgeId: managedKnowledge.knowledgeId,
        tenantId: managedKnowledge.tenantId,
        fileId: file.fileId,
      }), { method: 'GET' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setFileActionMessage('解析片段暂时无法加载');
        return;
      }
      setManagedChunksByFileId((current) => ({
        ...current,
        [file.fileId]: payload.records as ManagedKnowledgeChunkRecord[],
      }));
    } catch {
      setFileActionMessage('解析片段暂时无法加载');
    }
  }

  async function handleKeywordSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = keywordSearchInput.trim();
    const tenantId = selectedTenantParam ?? scopedKnowledgeItems[0]?.tenantId;
    if (!keyword) {
      setKeywordSearchResults([]);
      setKeywordSearchMessage('请输入关键词后再检索知识片段');
      return;
    }
    if (!tenantId) {
      setKeywordSearchResults([]);
      setKeywordSearchMessage('当前范围暂无可检索知识库');
      return;
    }

    setIsKeywordSearching(true);
    setKeywordSearchMessage('正在检索片段...');
    try {
      const response = await fetch(keywordSearchPath({ tenantId, keyword }), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setKeywordSearchResults([]);
        setKeywordSearchMessage('知识库片段检索暂时不可用');
        return;
      }

      const records = payload.records as KnowledgeSearchResultRecord[];
      setKeywordSearchResults(records);
      setKeywordSearchMessage(records.length > 0 ? `已命中 ${records.length} 个引用片段` : '暂无匹配片段');
    } catch {
      setKeywordSearchResults([]);
      setKeywordSearchMessage('知识库片段检索暂时不可用');
    } finally {
      setIsKeywordSearching(false);
    }
  }

  async function handleGenerateVectorIndex() {
    const tenantId = selectedTenantParam ?? scopedKnowledgeItems[0]?.tenantId;
    if (!tenantId) {
      setEmbeddingMessage('当前范围暂无可生成向量索引的知识库');
      return;
    }

    setIsEmbeddingLoading(true);
    setEmbeddingMessage('正在生成 mock embedding 索引...');
    try {
      const response = await fetch(vectorEmbeddingPath(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        setEmbeddingMessage('知识库向量索引暂时无法生成');
        return;
      }

      const embeddingCount = typeof payload.embeddingCount === 'number' ? payload.embeddingCount : 0;
      setEmbeddingMessage(
        payload.status === 'empty'
          ? '当前范围暂无可生成向量索引的已解析片段'
          : `已生成 ${embeddingCount} 个 mock embedding 索引`,
      );
    } catch {
      setEmbeddingMessage('知识库向量索引暂时无法生成');
    } finally {
      setIsEmbeddingLoading(false);
    }
  }

  async function handleVectorSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = vectorSearchInput.trim();
    const tenantId = selectedTenantParam ?? scopedKnowledgeItems[0]?.tenantId;
    if (!query) {
      setVectorSearchResults([]);
      setVectorSearchMessage('请输入语义检索内容');
      return;
    }
    if (!tenantId) {
      setVectorSearchResults([]);
      setVectorSearchMessage('当前范围暂无可检索知识库');
      return;
    }

    setIsVectorSearching(true);
    setVectorSearchMessage('正在检索相似片段...');
    try {
      const response = await fetch(vectorSearchPath({ tenantId, query }), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setVectorSearchResults([]);
        setVectorSearchMessage('知识库向量检索暂时不可用');
        return;
      }

      const records = payload.records as KnowledgeVectorSearchResultRecord[];
      setVectorSearchResults(records);
      setVectorSearchMessage(records.length > 0 ? `已命中 ${records.length} 个相似片段` : '暂无相似片段');
    } catch {
      setVectorSearchResults([]);
      setVectorSearchMessage('知识库向量检索暂时不可用');
    } finally {
      setIsVectorSearching(false);
    }
  }

  async function handleKnowledgeQa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = qaQuestionInput.trim();
    const tenantId = selectedTenantParam ?? scopedKnowledgeItems[0]?.tenantId;
    if (!question) {
      setQaResponse(null);
      setQaMessage('请输入知识库问答问题');
      return;
    }
    if (!tenantId) {
      setQaResponse(null);
      setQaMessage('当前范围暂无可问答知识库');
      return;
    }

    setIsQaLoading(true);
    setQaMessage('正在基于引用片段生成回答...');
    try {
      const response = await fetch(knowledgeQaPath(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
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
            : '知识库问答暂时无法处理',
        );
        return;
      }

      const nextResponse = payload as KnowledgeQaResponseRecord;
      setQaResponse(nextResponse);
      setQaMessage(
        nextResponse.safeStatus === 'no_citation'
          ? '当前范围暂无可引用片段'
          : `已生成回答，引用 ${nextResponse.citations.length} 个片段`,
      );
    } catch {
      setQaResponse(null);
      setQaMessage('知识库问答暂时无法处理');
    } finally {
      setIsQaLoading(false);
    }
  }

  async function handleLoadQaAudits() {
    const tenantId = selectedTenantParam ?? scopedKnowledgeItems[0]?.tenantId;
    if (!tenantId) {
      setQaAuditRecords([]);
      setQaAuditMessage('当前范围暂无可查询审计的知识库');
      return;
    }

    setIsQaAuditLoading(true);
    setQaAuditMessage('正在读取问答审计...');
    try {
      const response = await fetch(qaAuditPath({ tenantId }), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setQaAuditRecords([]);
        setQaAuditMessage('问答审计暂时无法加载');
        return;
      }

      const records = payload.records as KnowledgeQaAuditRecord[];
      setQaAuditRecords(records);
      setQaAuditMessage(records.length > 0 ? `已读取 ${records.length} 条问答审计` : '暂无问答审计记录');
    } catch {
      setQaAuditRecords([]);
      setQaAuditMessage('问答审计暂时无法加载');
    } finally {
      setIsQaAuditLoading(false);
    }
  }

  const metricCards = [
    { label: '接入机构', value: formatNumber(view?.allTotals.tenantCount ?? 0), helper: `${formatNumber(view?.allTotals.sourceFileCount ?? 0)} 个源文件`, icon: Building2, tone: 'bg-blue-300/[0.12] text-blue-200' },
    { label: '知识条目', value: formatNumber(view?.allTotals.knowledgeCount ?? 0), helper: `${formatNumber(view?.allTotals.chunkCount ?? 0)} 个解析片段`, icon: Database, tone: 'bg-cyan-300/[0.12] text-cyan-200' },
    { label: '累计命中', value: formatNumber(view?.allTotals.hitCount ?? 0), helper: `平均 ${view?.allTotals.averageHitCount ?? 0} 次/条`, icon: TrendingUp, tone: 'bg-emerald-300/[0.12] text-emerald-200' },
    { label: '解析覆盖', value: formatPercent(view?.allTotals.trainingCoverageRate ?? 0), helper: `${view?.allTotals.trainedCount ?? 0} 条已完成`, icon: CheckCircle2, tone: 'bg-violet-300/[0.12] text-violet-200' },
    { label: '待优化', value: formatNumber(view?.allTotals.pendingOptimizationCount ?? 0), helper: `${view?.allTotals.failedImportJobCount ?? 0} 个异常任务`, icon: AlertTriangle, tone: 'bg-amber-300/[0.12] text-amber-200' },
  ];

  return (
    <section className="space-y-5" aria-labelledby="platform-knowledge-heading">
      <div className={cn(sectionShell, 'p-5 lg:p-6')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
              <Sparkles className="h-4 w-4" />
              平台知识运营中枢
            </div>
            <h1 id="platform-knowledge-heading" className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-4xl">知识库管理</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              查看各机构知识解析、命中表现、导入概况和高频问题。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="rounded-full border border-white/10 bg-[#071322]/72 px-3 py-2 text-xs font-semibold text-slate-300">
              最近同步：{lastSyncedAt}
            </span>
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.10] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isSyncing ? '同步中...' : '同步数据'}
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.10] px-4 py-3 text-sm font-semibold text-rose-100">
          {errorMessage}。请稍后重试或点击同步数据重新加载。
        </div>
      ) : null}

      {isLoading && view ? (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.10] px-4 py-3 text-sm font-semibold text-cyan-100" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在刷新知识库运营数据...
        </div>
      ) : null}

      {!view || !filesResponse || !itemsResponse ? (
        <article className={cn(sectionShell, 'p-8 text-center')} aria-live="polite">
          {errorMessage ? (
            <>
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-200" />
              <h2 className="mt-3 text-lg font-semibold tracking-normal text-white">知识库运营数据暂时无法加载</h2>
              <p className="mt-2 text-sm text-slate-400">请稍后重试或点击同步数据重新加载。</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200" />
              <h2 className="mt-3 text-lg font-semibold tracking-normal text-white">正在加载知识库运营数据...</h2>
              <p className="mt-2 text-sm text-slate-400">正在读取只读运营 contract。</p>
            </>
          )}
        </article>
      ) : (
        <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="平台知识库总指标">
        {metricCards.map((metric) => (
          <article key={metric.label} className={cn(sectionShell, 'p-4')}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-slate-400">{metric.label}</div>
              <div className={cn('grid h-10 w-10 place-items-center rounded-2xl', metric.tone)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-normal text-white">{metric.value}</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">{metric.helper}</div>
          </article>
        ))}
      </section>

      {capabilityResponse ? (
        <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识库生产能力状态">
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">生产能力状态</h2>
                <p className="mt-1 text-sm text-slate-400">展示内部能力与生产级高风险能力开关。</p>
              </div>
            </div>
            <Badge className="border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100">
              tenant 每日 {capabilityResponse.qaQuotaPolicy.tenantDailyLimit} 次 · institution 每日 {capabilityResponse.qaQuotaPolicy.institutionDailyLimit} 次
            </Badge>
          </div>
          <div className="p-5">
            <div className="mb-4 rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
              {capabilityMessage}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {capabilityResponse.capabilities.map((capability) => (
                <article key={capability.id} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-normal text-white">{capability.label}</h3>
                    <Badge className={capability.enabled ? 'border-emerald-300/20 bg-emerald-300/[0.10] text-emerald-100' : 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100'}>
                      {capability.enabled ? '已启用' : '未启用'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{capability.summary}</p>
                  {!capability.enabled ? (
                    <div className="mt-3 space-y-2 text-xs leading-5 text-amber-100">
                      <div>{capability.disabledReason}</div>
                      <div>{capability.entryCondition}</div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </article>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <article className={cn(sectionShell, 'p-5')}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-300/[0.12] text-blue-200">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">机构概况</h2>
                <p className="mt-1 text-sm text-slate-400">按机构查看知识量、命中和解析覆盖。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[view.allTenantStats, ...view.tenants].map((tenant) => {
                const isActive = selectedTenantId === tenant.tenantId;
                return (
                  <button
                    key={tenant.tenantId}
                    type="button"
                    onClick={() => handleSelectTenant(tenant.tenantId)}
                    className={cn(
                      'w-full rounded-2xl border p-4 text-left transition',
                      isActive ? 'border-cyan-300/30 bg-cyan-300/[0.12]' : 'border-white/10 bg-[#071322]/72 hover:bg-white/[0.08]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{tenant.tenantName}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatNumber(tenant.knowledgeCount)} 条知识 · {formatNumber(tenant.hitCount)} 次命中
                        </div>
                      </div>
                      <Badge className={isActive ? 'border-cyan-300/30 bg-cyan-300/[0.16] text-cyan-100' : 'border-violet-300/20 bg-violet-300/[0.10] text-violet-100'}>
                        {formatPercent(tenant.trainingCoverageRate)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className={cn(sectionShell, 'p-5')} aria-label="当前知识库范围">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/[0.12] text-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">当前范围</h2>
                <p className="mt-1 text-sm text-slate-400">{scopeName}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <StatPill label="知识" value={formatNumber(view.totals.knowledgeCount)} />
              <StatPill label="片段" value={formatNumber(view.totals.chunkCount)} />
              <StatPill label="命中覆盖" value={formatPercent(view.totals.hitCoverageRate)} />
              <StatPill label="解析覆盖" value={formatPercent(view.totals.trainingCoverageRate)} />
            </div>
          </article>
        </aside>

        <div className="space-y-5">
          <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <article className={cn(sectionShell, 'p-5')}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-normal text-white">{scopeName}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {formatNumber(view.totals.knowledgeCount)} 条知识 · {formatNumber(view.totals.folderCount)} 个文件夹 · 累计命中 {formatNumber(view.totals.hitCount)} 次
                  </p>
                </div>
                <label className="relative block w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={fileSearch}
                    onChange={(event) => handleFileSearchChange(event.target.value)}
                    placeholder="搜索全平台文件名"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-[#071322]/72 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatPill label="知识" value={formatNumber(view.totals.knowledgeCount)} />
                <StatPill label="文件夹" value={formatNumber(view.totals.folderCount)} />
                <StatPill label="累计命中" value={formatNumber(view.totals.hitCount)} />
                <StatPill label="导入成功率" value={formatPercent(view.totals.importSuccessRate)} />
              </div>
            </article>

            <article className={cn(sectionShell, 'p-5')}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/[0.12] text-cyan-200">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">运营信号</h2>
                  <p className="mt-1 text-sm text-slate-400">用于定位知识健康度风险。</p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">高频问题</dt>
                  <dd className="font-semibold text-white">{scopedTopQuestions[0]?.questionTitle ?? '暂无高频问题'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">热点分类</dt>
                  <dd className="font-semibold text-white">{scopedCategories[0]?.categoryName ?? '暂无分类'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">零命中知识</dt>
                  <dd className="font-semibold text-white">{formatNumber(zeroHitCount)} 条</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">导入成功率</dt>
                  <dd className="font-semibold text-white">{formatPercent(view.totals.importSuccessRate)}</dd>
                </div>
              </dl>
            </article>
          </section>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="机构上传文件列表">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-300/[0.12] text-blue-200">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">机构上传文件</h2>
                  <p className="mt-1 text-sm text-slate-400">只展示文件元数据与产品化解析状态。</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={fileSearch}
                    onChange={(event) => handleFileSearchChange(event.target.value)}
                    placeholder="搜索文件名"
                    className="h-10 w-full rounded-2xl border border-white/10 bg-[#071322]/72 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSelectPage}
                  disabled={scopedFiles.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  选择本页
                </button>
              </div>
            </div>

            <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatPill label="源文件" value={formatNumber(view.totals.sourceFileCount)} />
              <StatPill label="总大小" value={formatFileSize(view.totals.totalFileSizeKb)} />
              <StatPill label="解析成功" value={formatNumber(parsedFileCount)} />
              <StatPill label="解析失败" value={formatNumber(failedFileCount)} />
            </div>

            <div className="p-5">
              {selectedFileIds.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-3 text-sm font-semibold text-cyan-100">
                  已选择 {selectedFileIds.length} 个文件
                </div>
              ) : null}

              {scopedFiles.length === 0 ? (
                <EmptyState title={filesResponse.emptyState.title} description={filesResponse.emptyState.description} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {scopedFiles.map((file) => (
                    <KnowledgeFileCard
                      key={file.fileId}
                      file={file}
                      checked={selectedFileIds.includes(file.fileId)}
                      onToggle={() => handleToggleFile(file.fileId)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                第 {fileRangeStart}-{fileRangeEnd} 条，共 {totalFileCount} 个文件
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={!filePageInfo?.hasPreviousPage}
                  className="h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="font-semibold text-slate-200">第 {safeFilePage}/{pageCount} 页</span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!filePageInfo?.hasNextPage}
                  className="h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </article>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className={cn(sectionShell, 'overflow-hidden')}>
              <div className="flex items-center gap-3 border-b border-white/10 p-5">
                <BarChart3 className="h-5 w-5 text-cyan-200" />
                <h2 className="text-lg font-semibold tracking-normal text-white">分类表现</h2>
              </div>
              <div className="divide-y divide-white/10">
                {scopedCategories.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="暂无分类表现" description="当前机构范围还没有分类统计。" />
                  </div>
                ) : (
                  scopedCategories.map((category) => (
                    <div key={category.categoryCode} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-base font-semibold text-white">
                            <BookOpen className="h-4 w-4 text-cyan-200" />
                            {category.categoryName}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {formatNumber(category.knowledgeCount)} 条 · {formatNumber(category.chunkCount)} 个片段 · 解析 {formatPercent(category.trainingCoverageRate)}
                          </div>
                        </div>
                        <Badge className="border-violet-300/20 bg-violet-300/[0.12] text-violet-100">{formatNumber(category.hitCount)} 次命中</Badge>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
                          style={{ width: `${Math.max(8, (category.hitCount / maxCategoryHits) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className={cn(sectionShell, 'overflow-hidden')}>
              <div className="flex items-center gap-3 border-b border-white/10 p-5">
                <TrendingUp className="h-5 w-5 text-emerald-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">高频问题</h2>
                  <p className="mt-1 text-sm text-slate-400">按检索命中次数降序展示前 10 个问题。</p>
                </div>
              </div>
              <div className="divide-y divide-white/10">
                {scopedTopQuestions.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="暂无高频问题" description="当前范围没有命中问题记录。" />
                  </div>
                ) : (
                  scopedTopQuestions.map((question, index) => (
                    <div key={question.knowledgeId} className="flex gap-3 p-5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-300/[0.12] text-sm font-semibold text-cyan-100">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{question.questionTitle}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <Badge className="border-white/10 bg-white/[0.06] text-slate-300">{question.category}</Badge>
                          <span>{question.tenantName}</span>
                          <span>{formatNumber(question.hitCount)} 次</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <article className={cn(sectionShell, 'overflow-hidden')}>
            <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">知识条目</h2>
                  <p className="mt-1 text-sm text-slate-400">平台端展示运营摘要，详细内容由机构端维护。</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-400">共 {formatNumber(scopedKnowledgeItems.length)} 条</span>
            </div>
            <KnowledgeTable items={scopedKnowledgeItems} />
          </article>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识片段检索">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">检索片段</h2>
                  <p className="mt-1 text-sm text-slate-400">按关键词读取已解析文件片段并返回引用位置。</p>
                </div>
              </div>
              <form onSubmit={handleKeywordSearch} className="flex w-full flex-col gap-2 sm:flex-row lg:w-[460px]">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    aria-label="输入检索关键词"
                    value={keywordSearchInput}
                    onChange={(event) => setKeywordSearchInput(event.target.value)}
                    placeholder="输入关键词"
                    className="h-10 w-full rounded-2xl border border-white/10 bg-[#071322]/72 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isKeywordSearching}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.10] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isKeywordSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  检索片段
                </button>
              </form>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
                {keywordSearchMessage}
              </div>
              {keywordSearchResults.length === 0 ? (
                <EmptyState title="暂无匹配片段" description="输入关键词后可查看已解析文件的引用片段。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {keywordSearchResults.map((result) => (
                    <article key={result.chunkId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                      <div className="text-xs font-semibold text-slate-400">
                        {result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">{result.textPreview}</p>
                      <div className="mt-3 text-xs font-semibold text-cyan-100">{result.matchReason}</div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </article>

          <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识向量索引">
              <div className="flex items-center gap-3 border-b border-white/10 p-5">
                <Layers3 className="h-5 w-5 text-emerald-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">生成向量索引</h2>
                  <p className="mt-1 text-sm text-slate-400">为当前范围的已解析片段生成 deterministic mock embedding。</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
                  {embeddingMessage}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateVectorIndex}
                  disabled={isEmbeddingLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.10] px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEmbeddingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
                  生成向量索引
                </button>
              </div>
            </article>

            <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端语义检索">
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-cyan-200" />
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal text-white">语义检索</h2>
                    <p className="mt-1 text-sm text-slate-400">用 mock embedding 相似度返回引用片段。</p>
                  </div>
                </div>
                <form onSubmit={handleVectorSearch} className="flex w-full flex-col gap-2 sm:flex-row lg:w-[460px]">
                  <label className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      aria-label="输入语义检索内容"
                      value={vectorSearchInput}
                      onChange={(event) => setVectorSearchInput(event.target.value)}
                      placeholder="输入检索内容"
                      className="h-10 w-full rounded-2xl border border-white/10 bg-[#071322]/72 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isVectorSearching}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.10] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVectorSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    语义检索
                  </button>
                </form>
              </div>
              <div className="p-5">
                <div className="mb-4 rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
                  {vectorSearchMessage}
                </div>
                {vectorSearchResults.length === 0 ? (
                  <EmptyState title="暂无相似片段" description="生成向量索引后可按语义相似度查看引用片段。" />
                ) : (
                  <div className="grid gap-3">
                    {vectorSearchResults.map((result) => (
                      <article key={result.chunkId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                          <span>{result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}</span>
                          <span className="text-cyan-100">相似度 {result.score.toFixed(3)}</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">{result.textPreview}</p>
                        <div className="mt-3 text-xs font-semibold text-cyan-100">{result.matchReason}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </section>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识库问答">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-emerald-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">知识库问答</h2>
                  <p className="mt-1 text-sm text-slate-400">基于关键词和 mock embedding 召回片段生成低敏回答。</p>
                </div>
              </div>
              <form onSubmit={handleKnowledgeQa} className="flex w-full flex-col gap-2 lg:w-[620px]">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      aria-label="输入知识库问题"
                      value={qaQuestionInput}
                      onChange={(event) => setQaQuestionInput(event.target.value)}
                      placeholder="输入问题"
                      className="h-10 w-full rounded-2xl border border-white/10 bg-[#071322]/72 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                    />
                  </label>
                  <select
                    aria-label="选择问答检索模式"
                    value={qaRetrievalMode}
                    onChange={(event) => setQaRetrievalMode(event.target.value as 'keyword' | 'vector' | 'hybrid')}
                    className="h-10 rounded-xl border border-white/10 bg-[#071322]/72 px-3 text-sm font-semibold text-slate-100 outline-none"
                  >
                    <option value="hybrid">混合检索</option>
                    <option value="keyword">关键词</option>
                    <option value="vector">语义</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isQaLoading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.10] px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isQaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                    发起问答
                  </button>
                </div>
              </form>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
                {qaMessage}
              </div>
              {!qaResponse ? (
                <EmptyState title="暂无问答结果" description="输入问题后可查看回答和引用来源。" />
              ) : (
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <article className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                    <div className="text-xs font-semibold text-slate-400">
                      {qaResponse.retrievalMode === 'hybrid' ? '混合检索' : qaResponse.retrievalMode === 'keyword' ? '关键词' : '语义'}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-100">{qaResponse.answer}</p>
                    <div className="mt-3 text-xs font-semibold text-emerald-100">审计编号 {qaResponse.auditId}</div>
                  </article>
                  <div className="grid gap-3">
                    {qaResponse.citations.length === 0 ? (
                      <EmptyState title="暂无引用来源" description="当前回答没有可展示的引用片段。" />
                    ) : (
                      qaResponse.citations.map((citation) => (
                        <article key={citation.chunkId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                            <span>{citation.knowledgeTitle} · {citation.fileName} · 片段 {citation.chunkIndex + 1}</span>
                            <span className="text-cyan-100">分数 {citation.score.toFixed(3)}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">{citation.textPreview}</p>
                          <div className="mt-3 text-xs font-semibold text-cyan-100">{citation.matchReason}</div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端问答审计">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-200" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">问答审计</h2>
                  <p className="mt-1 text-sm text-slate-400">查看当前机构范围的低敏问答记录。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadQaAudits}
                disabled={isQaAuditLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-300/[0.10] px-4 text-sm font-semibold text-blue-100 transition hover:bg-blue-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isQaAuditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                刷新审计
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-slate-300">
                {qaAuditMessage}
              </div>
              {qaAuditRecords.length === 0 ? (
                <EmptyState title="暂无问答审计" description="点击刷新后可查看当前范围的问答审计记录。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {qaAuditRecords.map((record) => (
                    <article key={record.auditId} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                        <span>{qaRetrievalModeLabels[record.retrievalMode]} · 引用 {record.citationCount}</span>
                        <span>{formatDate(record.createdAt)}</span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold tracking-normal text-white">{record.question}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{record.answerPreview}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border-emerald-300/20 bg-emerald-300/[0.10] text-emerald-100">
                          {record.safeStatus}
                        </Badge>
                        {record.safeFailureMessage ? (
                          <Badge className="border-amber-300/20 bg-amber-300/[0.10] text-amber-100">
                            {record.safeFailureMessage}
                          </Badge>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="知识库文件管理操作区">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/[0.12] text-emerald-200">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-white">文件管理操作</h2>
                  <p className="mt-1 text-sm text-slate-400">平台端上传、下载和归档原始文件，仅展示低敏元数据。</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <select
                  aria-label="选择文件所属知识库"
                  value={effectiveManagedKnowledgeId}
                  onChange={(event) => setManagedKnowledgeId(event.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-[#071322]/72 px-3 text-sm font-semibold text-slate-100 outline-none"
                >
                  {scopedKnowledgeItems.map((item) => (
                    <option key={item.knowledgeId} value={item.knowledgeId}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-slate-200">
                  <FileText className="h-4 w-4" />
                  <span>{managedFile?.name ?? '选择文件'}</span>
                  <input
                    aria-label="选择知识库文件"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.xlsx"
                    className="sr-only"
                    onChange={(event) => setManagedFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleUploadManagedFile}
                  disabled={!managedKnowledge || !managedFile || isFileActionLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.10] px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  上传文件
                </button>
              </div>
            </div>

            {fileActionMessage ? (
              <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold text-cyan-100">
                {fileActionMessage}
              </div>
            ) : null}

            <div className="p-5">
              {!managedKnowledge ? (
                <EmptyState title="暂无可管理知识库" description="当前范围没有可绑定文件的知识条目。" />
              ) : managedFiles.length === 0 ? (
                <EmptyState title="暂无知识库文件" description="可先上传 PDF、DOCX、TXT、MD、CSV 或 XLSX 文件。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {managedFiles.map((file) => (
                    <div
                      key={file.fileId}
                      className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{file.originalFilename}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                            <span>{file.fileType}</span>
                            <span>{file.sizeLabel}</span>
                            <span>{file.status === 'active' ? '可下载' : '已归档'}</span>
                            <Badge className={managedParseStatusClasses[file.parseStatus]}>
                              {managedParseStatusLabels[file.parseStatus]} · {file.chunkCount} 片段
                            </Badge>
                          </div>
                          {file.safeFailureMessage ? (
                            <div className="mt-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.08] px-3 py-2 text-xs font-semibold text-rose-100">
                              {file.safeFailureMessage}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadManagedFile(file)}
                            disabled={file.status !== 'active'}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.10] px-3 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            下载文件
                          </button>
                          <button
                            type="button"
                            onClick={() => handleParseManagedFile(file)}
                            disabled={file.status !== 'active' || isFileActionLoading}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.10] px-3 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FileText className="h-4 w-4" />
                            发起解析
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadManagedChunks(file)}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-300/[0.10] px-3 text-xs font-semibold text-blue-100"
                          >
                            <Layers3 className="h-4 w-4" />
                            查看片段
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveManagedFile(file)}
                            disabled={file.status !== 'active' || isFileActionLoading}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.10] px-3 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Archive className="h-4 w-4" />
                            归档文件
                          </button>
                        </div>
                      </div>
                      {expandedParseFileId === file.fileId ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          {(managedChunksByFileId[file.fileId] ?? []).length === 0 ? (
                            <div className="text-xs font-semibold text-slate-400">暂无解析片段</div>
                          ) : (
                            (managedChunksByFileId[file.fileId] ?? []).map((chunk) => (
                              <div key={chunk.chunkId} className="rounded-lg border border-white/10 bg-[#071322]/72 px-3 py-2">
                                <div className="text-xs font-semibold text-slate-400">
                                  片段 {chunk.chunkIndex + 1} · {chunk.charCount} 字
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{chunk.textPreview}</p>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className={cn(sectionShell, 'overflow-hidden')}>
            <div className="flex items-center gap-3 border-b border-white/10 p-5">
              <Layers3 className="h-5 w-5 text-violet-200" />
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">导入与解析任务</h2>
                <p className="mt-1 text-sm text-slate-400">用于平台侧发现批量导入失败、解析异常和任务堆积。</p>
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {scopedJobs.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="暂无任务记录" description="当前机构范围没有导入或解析任务。" />
                </div>
              ) : (
                scopedJobs.map((job) => (
                  <div key={job.taskId} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Badge className={importJobStatusClasses[job.status]}>{importJobStatusLabels[job.status]}</Badge>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">{job.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{job.tenantName}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          成功 {formatNumber(job.successCount)} / {formatNumber(job.totalCount)}，失败 {formatNumber(job.failedCount)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-400">{job.updatedAt}</div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </div>
        </>
      )}
    </section>
  );
}
