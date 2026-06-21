'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  Trash2,
  Upload,
  X,
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
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';
import { packTarGz } from '@/shared/utils/tar';

const ALL_TENANTS = 'all';
const workspaceTabs = [
  { id: 'files', label: '文件管理' },
  { id: 'items', label: '知识条目' },
  { id: 'search', label: '检索测试' },
  { id: 'audit', label: '问答审计' },
  { id: 'jobs', label: '导入任务' },
] as const;

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white shadow-sm';
const innerCard = 'rounded-lg border border-[#e6edf5] bg-[#f8fafc]';

type KnowledgeWorkspaceTab = (typeof workspaceTabs)[number]['id'];

type KnowledgeFileParseStatus = OpenPlatformKnowledgeManagementFiles['records'][number]['parseStatus'];
type KnowledgeTrainingStatus = OpenPlatformKnowledgeManagementItems['records'][number]['trainingStatus'];
type ImportJobStatus = OpenPlatformKnowledgeManagementView['importJobs'][number]['status'];
type KnowledgeDirectoryRecord = OpenPlatformKnowledgeManagementView['directories'][number];
type KnowledgeFileRecord = OpenPlatformKnowledgeManagementFiles['records'][number];
type KnowledgeItemRecord = OpenPlatformKnowledgeManagementItems['records'][number];
type KnowledgeFileDownloadTarget = KnowledgeFileRecord & {
  knowledgeId: string;
};
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
const fileStatusLabels: Record<KnowledgeFileParseStatus, string> = {
  parsed: '已解析',
  failed: '解析失败',
  parsing: '解析中',
  pending: '待解析',
};

const fileStatusClasses: Record<KnowledgeFileParseStatus, string> = {
  parsed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-100 bg-rose-50 text-rose-700',
  parsing: 'border-blue-100 bg-blue-50 text-blue-700',
  pending: 'border-amber-100 bg-amber-50 text-amber-700',
};

const trainingStatusLabels: Record<KnowledgeTrainingStatus, string> = {
  trained: '已完成',
  training: '处理中',
  pending: '待处理',
  failed: '处理异常',
};

const trainingStatusClasses: Record<KnowledgeTrainingStatus, string> = {
  trained: 'border-violet-100 bg-violet-50 text-violet-700',
  training: 'border-blue-100 bg-blue-50 text-blue-700',
  pending: 'border-amber-100 bg-amber-50 text-amber-700',
  failed: 'border-rose-100 bg-rose-50 text-rose-700',
};

const importJobStatusLabels: Record<ImportJobStatus, string> = {
  completed: '已完成',
  running: '进行中',
  failed: '有失败',
  partial_failed: '部分失败',
};

const importJobStatusClasses: Record<ImportJobStatus, string> = {
  completed: 'border-violet-100 bg-violet-50 text-violet-700',
  running: 'border-blue-100 bg-blue-50 text-blue-700',
  failed: 'border-rose-100 bg-rose-50 text-rose-700',
  partial_failed: 'border-amber-100 bg-amber-50 text-amber-700',
};

const managedParseStatusLabels: Record<ManagedKnowledgeFileRecord['parseStatus'], string> = {
  pending: '待解析',
  processing: '解析中',
  succeeded: '解析成功',
  failed: '解析失败',
};

const managedParseStatusClasses: Record<ManagedKnowledgeFileRecord['parseStatus'], string> = {
  pending: 'border-amber-100 bg-amber-50 text-amber-700',
  processing: 'border-blue-100 bg-blue-50 text-blue-700',
  succeeded: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-100 bg-rose-50 text-rose-700',
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

function productizeKnowledgeRuntimeCopy(value: string) {
  return value
    .replaceAll('deterministic mock embedding', '受控向量索引')
    .replaceAll('mock embedding', '受控向量')
    .replaceAll('受控向量 相似度', '受控向量相似度')
    .replaceAll('mock/local QA', '受控本地问答')
    .replaceAll('mock_local_embedding', '受控本地向量')
    .replaceAll('mock-local-embedding-v1', '受控本地向量 V1');
}

function EmptyState({ title, description }: { title?: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#dbe5f0] bg-[#f8fafc] px-4 py-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{title ?? '暂无匹配的知识库运营数据'}</div>
      <p className="mt-1 text-sm text-slate-500">{description ?? '请调整机构范围或文件名搜索条件后再查看。'}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(innerCard, 'p-3')}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{value}</div>
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

function KnowledgeFileTable({
  files,
  selectedFileIds,
  onToggle,
}: {
  files: KnowledgeFileRecord[];
  selectedFileIds: string[];
  onToggle: (fileId: string) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e6edf5]">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-semibold text-slate-500">
          <tr>
            <th className="w-10 px-3 py-2" />
            <th className="px-3 py-2">文件名</th>
            <th className="px-3 py-2">机构</th>
            <th className="px-3 py-2">分类 / 文件夹</th>
            <th className="px-3 py-2">解析状态</th>
            <th className="px-3 py-2">大小</th>
            <th className="px-3 py-2">更新时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf2f7] bg-white">
          {files.map((file) => (
            <tr key={file.fileId} className="align-middle hover:bg-[#f8fafc]">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`选择 ${file.fileName}`}
                  checked={selectedFileIds.includes(file.fileId)}
                  onChange={() => onToggle(file.fileId)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </td>
              <td className="max-w-[260px] px-3 py-2">
                <div className="truncate font-semibold text-slate-950">{file.fileName}</div>
                {file.safeErrorMessage ? (
                  <div className="mt-1 line-clamp-1 text-xs font-semibold text-rose-600">{file.safeErrorMessage}</div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-slate-600">{file.tenantName}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="border-blue-100 bg-blue-50 text-blue-700">{file.category}</Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">{file.folder}</Badge>
                </div>
              </td>
              <td className="px-3 py-2">
                <Badge className={fileStatusClasses[file.parseStatus]}>{fileStatusLabels[file.parseStatus]}</Badge>
              </td>
              <td className="px-3 py-2 text-slate-600">{file.fileType} · {formatFileSize(file.fileSizeKb)}</td>
              <td className="px-3 py-2 text-slate-500">{file.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <tr className="text-xs font-semibold text-slate-500">
            <th className="border-b border-[#e6edf5] px-4 py-3">知识标题</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">摘要预览</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">机构</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">分类 / 文件夹</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">解析状态</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">命中</th>
            <th className="border-b border-[#e6edf5] px-4 py-3">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.knowledgeId} className="align-top">
              <td className="border-b border-[#e6edf5] px-4 py-4 font-semibold text-slate-950">{item.title}</td>
              <td className="max-w-[320px] border-b border-[#e6edf5] px-4 py-4 text-slate-500">
                <span className="line-clamp-2">{item.descriptionPreview}</span>
              </td>
              <td className="border-b border-[#e6edf5] px-4 py-4 text-slate-600">{item.tenantName}</td>
              <td className="border-b border-[#e6edf5] px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-blue-100 bg-blue-50 text-blue-700">{item.category}</Badge>
                  <Badge className="border-violet-100 bg-violet-50 text-violet-700">{item.folder}</Badge>
                </div>
              </td>
              <td className="border-b border-[#e6edf5] px-4 py-4">
                <Badge className={trainingStatusClasses[item.trainingStatus]}>
                  {trainingStatusLabels[item.trainingStatus]} · {item.chunkCount} 片段
                </Badge>
              </td>
              <td className="border-b border-[#e6edf5] px-4 py-4 font-semibold text-slate-950">{formatNumber(item.hitCount)}</td>
              <td className="border-b border-[#e6edf5] px-4 py-4 text-slate-500">{item.updatedAt}</td>
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

function directoryMutationPath(directoryId: string) {
  return `/api/v1/open-platform/knowledge-management/directories/${encodeURIComponent(directoryId)}`;
}

function directoriesPath() {
  return '/api/v1/open-platform/knowledge-management/directories';
}

function directoryReorderPath() {
  return '/api/v1/open-platform/knowledge-management/directories/reorder';
}

function getDirectoryParentName(directory: KnowledgeDirectoryRecord, directories: KnowledgeDirectoryRecord[]) {
  if (!directory.parentId) return null;

  return directories.find((item) => item.directoryId === directory.parentId)?.name ?? null;
}

function knowledgeItemMatchesDirectory(
  item: KnowledgeItemRecord,
  directory: KnowledgeDirectoryRecord | null,
  directories: KnowledgeDirectoryRecord[],
) {
  if (!directory || directory.kind === 'virtual_root') return true;
  if (directory.kind === 'knowledge_library') return item.category === directory.name;

  const parentName = getDirectoryParentName(directory, directories);
  return item.folder === directory.name && (!parentName || item.category === parentName);
}

function knowledgeFileMatchesDirectory(
  file: KnowledgeFileRecord,
  directory: KnowledgeDirectoryRecord | null,
  directories: KnowledgeDirectoryRecord[],
) {
  if (!directory || directory.kind === 'virtual_root') return true;
  if (directory.kind === 'knowledge_library') return file.category === directory.name;

  const parentName = getDirectoryParentName(directory, directories);
  return file.folder === directory.name && (!parentName || file.category === parentName);
}

function hasKnowledgeFileDownloadScope(file: KnowledgeFileRecord | undefined): file is KnowledgeFileDownloadTarget {
  return Boolean(file?.knowledgeId && file.tenantId && file.fileId);
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

export function OpenPlatformKnowledgeManagementPanel() {
  const [selectedTenantId, setSelectedTenantId] = useState(ALL_TENANTS);
  const [fileSearch, setFileSearch] = useState('');
  const [filePage, setFilePage] = useState(1);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<KnowledgeWorkspaceTab>('files');
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
  const [embeddingMessage, setEmbeddingMessage] = useState('选择范围后可生成已解析片段的受控向量索引');
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
  const [editingDirectoryId, setEditingDirectoryId] = useState<string | null>(null);
  const [directoryDraftName, setDirectoryDraftName] = useState('');
  const [directoryActionMessage, setDirectoryActionMessage] = useState<string | null>(null);
  const [directoryActionId, setDirectoryActionId] = useState<string | null>(null);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(null);
  const [isFileActionLoading, setIsFileActionLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshReasonRef = useRef<'auto' | 'sync'>('auto');
  const uploadPanelRef = useRef<HTMLElement | null>(null);
  const managedFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedTenantParam = selectedTenantId === ALL_TENANTS ? null : selectedTenantId;

  useEffect(() => {
    let isActive = true;
    const isManualSync = refreshReasonRef.current === 'sync';

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
    ])
      .then(([nextView, nextFiles, nextItems]) => {
        if (!isActive) return;

        setView(nextView);
        setFilesResponse(nextFiles);
        setItemsResponse(nextItems);
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
  const directoryRows = view?.directories ?? [];
  const activeSelectedDirectoryId = directoryRows.some((row) => row.directoryId === selectedDirectoryId)
    ? selectedDirectoryId
    : null;
  const selectedDirectory = directoryRows.find((row) => row.directoryId === activeSelectedDirectoryId) ?? null;
  const visibleFiles = scopedFiles.filter((file) =>
    knowledgeFileMatchesDirectory(file, selectedDirectory, directoryRows),
  );
  const visibleFileIds = new Set(visibleFiles.map((file) => file.fileId));
  const visibleSelectedFileIds = selectedFileIds.filter((fileId) => visibleFileIds.has(fileId));
  const visibleKnowledgeItems = scopedKnowledgeItems.filter((item) =>
    knowledgeItemMatchesDirectory(item, selectedDirectory, directoryRows),
  );
  const visibleTotalFileCount = selectedDirectory ? visibleFiles.length : totalFileCount;
  const visibleFileRangeStart = visibleTotalFileCount === 0 ? 0 : selectedDirectory ? 1 : fileRangeStart;
  const visibleFileRangeEnd = selectedDirectory ? visibleFiles.length : fileRangeEnd;
  const hasManagedKnowledgeOptions = visibleKnowledgeItems.length > 0;
  const canManageDirectories = Boolean(selectedTenantParam);
  const effectiveManagedKnowledgeId = visibleKnowledgeItems.some(
    (item) => item.knowledgeId === managedKnowledgeId,
  )
    ? managedKnowledgeId
    : visibleKnowledgeItems[0]?.knowledgeId ?? '';
  const managedKnowledge = visibleKnowledgeItems.find(
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
    setSelectedDirectoryId(null);
    setEditingDirectoryId(null);
    setDirectoryActionMessage(null);
  }

  function handleSelectDirectory(directoryId: string) {
    setSelectedDirectoryId(directoryId);
    setSelectedFileIds([]);
    setManagedKnowledgeId('');
    setFileActionMessage(null);
  }

  function handleFileSearchChange(value: string) {
    setIsLoading(true);
    setErrorMessage(null);
    setFileSearch(value);
    setFilePage(1);
    setSelectedFileIds([]);
  }

  function beginRenameDirectory(directory: KnowledgeDirectoryRecord) {
    setEditingDirectoryId(directory.directoryId);
    setDirectoryDraftName(directory.name);
    setDirectoryActionMessage(null);
  }

  function updateDirectoryInView(directory: KnowledgeDirectoryRecord) {
    setView((current) => {
      if (!current) return current;

      return {
        ...current,
        directories: current.directories.map((item) =>
          item.directoryId === editingDirectoryId || item.directoryId === directory.directoryId
            ? { ...item, ...directory }
            : item,
        ),
      };
    });
  }

  function addDirectoryToView(directory: KnowledgeDirectoryRecord) {
    setView((current) => {
      if (!current) return current;
      const withoutDuplicate = current.directories.filter((item) => item.directoryId !== directory.directoryId);

      return {
        ...current,
        directories: [...withoutDuplicate, directory].sort((left, right) =>
          left.sortOrder - right.sortOrder || left.depth - right.depth || left.name.localeCompare(right.name, 'zh-CN'),
        ),
      };
    });
  }

  function removeDirectoryFromView(directoryId: string) {
    setView((current) => {
      if (!current) return current;

      return {
        ...current,
        directories: current.directories.filter((item) => item.directoryId !== directoryId),
      };
    });
    setSelectedDirectoryId((current) => current === directoryId ? null : current);
  }

  async function readDirectoryMutationMessage(response: Response) {
    const payload = await response.json().catch(() => null) as {
      message?: string;
      directory?: KnowledgeDirectoryRecord;
    } | null;

    return {
      message: payload?.message ?? (response.ok ? '目录操作已完成' : '目录操作暂时无法完成'),
      directory: payload?.directory,
    };
  }

  async function handleSaveDirectoryName(directory: KnowledgeDirectoryRecord) {
    if (!selectedTenantParam) {
      setDirectoryActionMessage('请选择具体机构后再编辑目录');
      return;
    }

    setDirectoryActionId(directory.directoryId);
    setDirectoryActionMessage('正在保存目录名称...');
    try {
      const response = await fetch(directoryMutationPath(directory.directoryId), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenantParam, name: directoryDraftName.trim() }),
      });
      const result = await readDirectoryMutationMessage(response);
      setDirectoryActionMessage(result.message);
      if (response.ok && result.directory) {
        updateDirectoryInView(result.directory);
        setEditingDirectoryId(null);
      }
    } catch {
      setDirectoryActionMessage('目录名称暂时无法保存');
    } finally {
      setDirectoryActionId(null);
    }
  }

  async function handleCreateDirectory(parentDirectory?: KnowledgeDirectoryRecord | null) {
    if (!selectedTenantParam) {
      setDirectoryActionMessage('请选择具体机构后再新增目录');
      return;
    }

    const actionId = parentDirectory ? `create:${parentDirectory.directoryId}` : 'create';
    setDirectoryActionId(actionId);
    setDirectoryActionMessage('正在创建目录...');
    try {
      const response = await fetch(directoriesPath(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantParam,
          name: parentDirectory ? '新子目录' : '新目录',
          parentId: parentDirectory?.directoryId ?? null,
        }),
      });
      const result = await readDirectoryMutationMessage(response);
      setDirectoryActionMessage(result.message);
      if (response.ok && result.directory) {
        addDirectoryToView(result.directory);
      }
    } catch {
      setDirectoryActionMessage('目录暂时无法创建');
    } finally {
      setDirectoryActionId(null);
    }
  }

  async function handleArchiveDirectory(directory: KnowledgeDirectoryRecord) {
    if (!selectedTenantParam) {
      setDirectoryActionMessage('请选择具体机构后再归档目录');
      return;
    }

    setDirectoryActionId(directory.directoryId);
    setDirectoryActionMessage('正在检查目录是否可归档...');
    try {
      const response = await fetch(
        `${directoryMutationPath(directory.directoryId)}?tenantId=${encodeURIComponent(selectedTenantParam)}`,
        { method: 'DELETE' },
      );
      const result = await readDirectoryMutationMessage(response);
      setDirectoryActionMessage(result.message);
      if (response.ok && result.directory?.status === 'archived') {
        removeDirectoryFromView(directory.directoryId);
      }
    } catch {
      setDirectoryActionMessage('目录暂时无法归档');
    } finally {
      setDirectoryActionId(null);
    }
  }

  async function handleMoveDirectory(directory: KnowledgeDirectoryRecord) {
    if (!selectedTenantParam) {
      setDirectoryActionMessage('请选择具体机构后再调整目录排序');
      return;
    }
    const siblingRows = directoryRows.filter((row) =>
      row.kind !== 'virtual_root' &&
      row.parentId === directory.parentId,
    );
    const siblingIndex = siblingRows.findIndex((row) => row.directoryId === directory.directoryId);
    if (siblingIndex <= 0) {
      setDirectoryActionMessage('目录已在当前层级顶部');
      return;
    }
    const previousSibling = siblingRows[siblingIndex - 1];
    const currentIndex = directoryRows.findIndex((row) => row.directoryId === directory.directoryId);
    const previousIndex = directoryRows.findIndex((row) => row.directoryId === previousSibling.directoryId);
    if (currentIndex < 0 || previousIndex < 0) {
      setDirectoryActionMessage('目录排序暂时无法保存');
      return;
    }
    const nextDirectoryRows = [...directoryRows];
    [nextDirectoryRows[currentIndex], nextDirectoryRows[previousIndex]] = [
      nextDirectoryRows[previousIndex],
      nextDirectoryRows[currentIndex],
    ];
    const reorderedDirectoryRows = nextDirectoryRows.map((row, index) => ({ ...row, sortOrder: index }));

    setDirectoryActionId(directory.directoryId);
    setDirectoryActionMessage('正在保存目录排序...');
    try {
      const response = await fetch(directoryReorderPath(), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantParam,
          directoryIds: reorderedDirectoryRows.map((row) => row.directoryId),
        }),
      });
      const result = await readDirectoryMutationMessage(response);
      setDirectoryActionMessage(result.message);
      if (response.ok) {
        setView((current) => current ? { ...current, directories: reorderedDirectoryRows } : current);
      }
    } catch {
      setDirectoryActionMessage('目录排序暂时无法保存');
    } finally {
      setDirectoryActionId(null);
    }
  }

  function handleToggleFile(fileId: string) {
    setSelectedFileIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
    );
  }

  function handleSelectPage() {
    setSelectedFileIds(visibleFiles.map((file) => file.fileId));
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

  function handleOpenUploadDocument() {
    setActiveWorkspaceTab('files');

    const openUploadPanel = () => {
      uploadPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!managedKnowledge) {
        setFileActionMessage('暂无可上传的知识库条目，请先新建知识后再上传文档。');
        return;
      }

      setFileActionMessage('请选择要上传的文档。');
      managedFileInputRef.current?.click();
    };

    if (activeWorkspaceTab === 'files') {
      openUploadPanel();
      return;
    }

    window.setTimeout(openUploadPanel, 0);
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

  async function handleBulkDownloadSelectedFiles() {
    if (visibleSelectedFileIds.length === 0) return;

    const selectedFiles = visibleSelectedFileIds
      .map((fileId) => visibleFiles.find((file) => file.fileId === fileId))
      .filter(hasKnowledgeFileDownloadScope);

    if (selectedFiles.length === 0) {
      setFileActionMessage('已选文件缺少知识库归属，暂无法打包下载');
      return;
    }

    setFileActionMessage(null);
    try {
      // Obtain file names via metadata API, then download each file & pack as .tar.gz
      const fileElements: Array<{ name: string; blob: Blob }> = [];
      for (const file of selectedFiles) {
        const response = await fetch(fileDownloadPath({
          knowledgeId: file.knowledgeId,
          tenantId: file.tenantId,
          fileId: file.fileId,
        }), { method: 'GET' });
        if (!response.ok) continue;
        const blob = await response.blob();
        const fileName = file.fileName || `${file.fileId}.bin`;
        fileElements.push({ name: fileName, blob });
      }

      if (fileElements.length === 0) {
        setFileActionMessage('没有可下载的文件');
        return;
      }

      // pack as tar.gz using existing platform library
      import('@/shared/utils/tar').then(async ({ packTarGz }) => {
        const tarGzBlob = await packTarGz(fileElements);
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(tarGzBlob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `knowledge-files-${Date.now()}.tar.gz`;
          anchor.click();
          URL.revokeObjectURL(url);
        }
        setFileActionMessage(`${fileElements.length} 个文件打包下载已准备`);
      }).catch(() => {
        setFileActionMessage('打包下载失败，请稍后重试');
      });
    } catch {
      setFileActionMessage('打包下载失败，请稍后重试');
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
      const safeMessage =
        payload && typeof payload === 'object' && 'parse' in payload &&
        payload.parse && typeof payload.parse === 'object' &&
        'safeFailureMessage' in payload.parse &&
        typeof payload.parse.safeFailureMessage === 'string'
          ? payload.parse.safeFailureMessage
          : null;
      setFileActionMessage(
        payload.status === 'failed'
          ? `文件解析失败：${safeMessage ?? '知识库文件解析失败，请稍后重试'}`
          : safeMessage
            ? `文件解析已完成：${safeMessage}`
            : '文件解析已完成',
      );
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
    setEmbeddingMessage('正在生成受控向量索引...');
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
          : `已生成 ${embeddingCount} 个受控向量索引`,
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
    { label: '接入机构', value: formatNumber(view?.allTotals.tenantCount ?? 0), helper: `${formatNumber(view?.allTotals.sourceFileCount ?? 0)} 个源文件`, icon: Building2, tone: 'bg-blue-50 text-blue-600' },
    { label: '知识条目', value: formatNumber(view?.allTotals.knowledgeCount ?? 0), helper: `${formatNumber(view?.allTotals.chunkCount ?? 0)} 个解析片段`, icon: Database, tone: 'bg-cyan-50 text-cyan-600' },
    { label: '累计命中', value: formatNumber(view?.allTotals.hitCount ?? 0), helper: `平均 ${view?.allTotals.averageHitCount ?? 0} 次/条`, icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: '解析覆盖', value: formatPercent(view?.allTotals.trainingCoverageRate ?? 0), helper: `${view?.allTotals.trainedCount ?? 0} 条已完成`, icon: CheckCircle2, tone: 'bg-violet-50 text-violet-600' },
    { label: '待优化', value: formatNumber(view?.allTotals.pendingOptimizationCount ?? 0), helper: `${view?.allTotals.failedImportJobCount ?? 0} 个异常任务`, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <section className="space-y-4 text-slate-950" aria-labelledby="platform-knowledge-heading">
      <PlatformSectionBanner
        headingId="platform-knowledge-heading"
        headingLevel="h1"
        title="知识库管理"
        description="按机构、目录、文件和问答链路管理知识库。"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleOpenUploadDocument}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            上传文档
          </button>
          <button
            type="button"
            disabled
            title="新建知识需要后续接入知识条目写入接口"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#dbe5f0] bg-white px-4 text-sm font-semibold text-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BookOpen className="h-4 w-4" />
            新建知识
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isSyncing ? '同步中...' : '同步数据'}
          </button>
        </div>
      </PlatformSectionBanner>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMessage}。请稍后重试或点击同步数据重新加载。
        </div>
      ) : null}

      {isLoading && view ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在刷新知识库运营数据...
        </div>
      ) : null}

      {!view || !filesResponse || !itemsResponse ? (
        <article className={cn(sectionShell, 'p-8 text-center')} aria-live="polite">
          {errorMessage ? (
            <>
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
              <h2 className="mt-3 text-lg font-semibold tracking-normal text-slate-950">知识库运营数据暂时无法加载</h2>
              <p className="mt-2 text-sm text-slate-500">请稍后重试或点击同步数据重新加载。</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <h2 className="mt-3 text-lg font-semibold tracking-normal text-slate-950">正在加载知识库运营数据...</h2>
              <p className="mt-2 text-sm text-slate-500">正在读取只读运营 contract。</p>
            </>
          )}
        </article>
      ) : (
        <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="平台知识库总指标">
        {metricCards.map((metric) => (
          <article key={metric.label} className={cn(sectionShell, 'flex min-h-[56px] items-center justify-between gap-3 px-4 py-3')}>
            <div>
              <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
              <div className="mt-0.5 text-xl font-semibold tracking-normal text-slate-950">{metric.value}</div>
            </div>
            <div className={cn('grid h-9 w-9 place-items-center rounded-lg', metric.tone)}>
              <metric.icon className="h-4 w-4" />
            </div>
          </article>
        ))}
      </section>

	      <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)_260px]" aria-label="知识库管理工作台">
	        <aside className={cn(sectionShell, 'p-4')} aria-label="知识目录">
	          <div className="flex items-center gap-3">
	            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
	              <Building2 className="h-5 w-5" />
	            </div>
	            <div>
	              <h2 className="text-base font-semibold tracking-normal text-slate-950">知识目录</h2>
	              <p className="mt-1 text-xs text-slate-500">按机构与目录筛选知识。</p>
	            </div>
	          </div>

	          <div className="mt-4 space-y-2">
	            {[view.allTenantStats, ...view.tenants].map((tenant) => {
	              const isActive = selectedTenantId === tenant.tenantId;
	              return (
	                <button
	                  key={tenant.tenantId}
	                  type="button"
	                  aria-current={isActive ? 'true' : undefined}
	                  onClick={() => handleSelectTenant(tenant.tenantId)}
	                  className={cn(
	                    'w-full rounded-lg border px-3 py-2 text-left transition',
	                    isActive ? 'border-blue-200 bg-blue-50' : 'border-[#e6edf5] bg-white hover:bg-[#f8fafc]',
	                  )}
	                >
	                  <div className="flex items-start justify-between gap-3">
	                    <div className="min-w-0">
	                      <div className={cn('truncate text-sm font-semibold', isActive ? 'text-blue-700' : 'text-slate-950')}>{tenant.tenantName}</div>
	                      <div className="mt-1 text-xs text-slate-500">
	                        {formatNumber(tenant.knowledgeCount)} 条知识 · {formatNumber(tenant.hitCount)} 次命中
	                      </div>
	                    </div>
	                    <Badge className={isActive ? 'border-blue-100 bg-white text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
	                      {formatPercent(tenant.trainingCoverageRate)}
	                    </Badge>
	                  </div>
	                </button>
	              );
	            })}
	          </div>

	          <div className="mt-4 border-t border-[#e6edf5] pt-4">
	            <div className="mb-2 flex items-center justify-between gap-2">
	              <div className="text-xs font-semibold text-slate-500">知识库目录</div>
	              <button
	                type="button"
	                aria-label="新增目录"
	                title="新增目录"
	                onClick={() => void handleCreateDirectory(null)}
	                disabled={!canManageDirectories || directoryActionId === 'create'}
	                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
	              >
	                {directoryActionId === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
	              </button>
	            </div>
	            {directoryActionMessage ? (
	              <div className="mb-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-xs font-semibold leading-5 text-emerald-700">
	                {directoryActionMessage}
	              </div>
	            ) : null}
	            <div className="space-y-1">
	            {directoryRows.length > 0 ? directoryRows.map((row) => {
	              const isActiveDirectory = activeSelectedDirectoryId === row.directoryId;
	              return (
	              <div
	                key={row.directoryId}
	                className={cn(
	                  'flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition',
	                  row.depth > 0 ? 'ml-4 text-slate-600' : 'font-semibold text-slate-800',
	                  isActiveDirectory ? 'bg-blue-50' : 'hover:bg-[#f8fafc]',
	                )}
	              >
	                {editingDirectoryId === row.directoryId ? (
	                  <div className="flex min-w-0 flex-1 items-center gap-1">
	                    <input
	                      aria-label="目录名称"
	                      value={directoryDraftName}
	                      onChange={(event) => setDirectoryDraftName(event.target.value)}
	                      className="h-8 min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none"
	                    />
	                    <button
	                      type="button"
	                      aria-label="保存目录名称"
	                      title="保存目录名称"
	                      onClick={() => void handleSaveDirectoryName(row)}
	                      disabled={directoryActionId === row.directoryId}
	                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-60"
	                    >
	                      {directoryActionId === row.directoryId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
	                    </button>
	                    <button
	                      type="button"
	                      aria-label="取消重命名"
	                      title="取消重命名"
	                      onClick={() => setEditingDirectoryId(null)}
	                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500"
	                    >
	                      <X className="h-3.5 w-3.5" />
	                    </button>
	                  </div>
	                ) : (
	                  <>
	                    <button
	                      type="button"
	                      aria-label={`筛选目录 ${row.name}`}
	                      aria-current={isActiveDirectory ? 'true' : undefined}
	                      onClick={() => handleSelectDirectory(row.directoryId)}
	                      className={cn(
	                        'min-w-0 flex-1 truncate text-left transition',
	                        isActiveDirectory ? 'text-blue-700' : 'text-inherit',
	                      )}
	                    >
	                      {row.name}
	                    </button>
	                    <div className="flex shrink-0 items-center gap-1">
	                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{formatNumber(row.knowledgeCount)}</span>
	                      {canManageDirectories && row.kind !== 'virtual_root' ? (
	                        <>
	                          {row.kind === 'knowledge_library' ? (
	                            <button
	                              type="button"
	                              aria-label={`新增子目录 ${row.name}`}
	                              title={`新增子目录 ${row.name}`}
	                              onClick={() => void handleCreateDirectory(row)}
	                              disabled={directoryActionId === `create:${row.directoryId}`}
	                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
	                            >
	                              {directoryActionId === `create:${row.directoryId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
	                            </button>
	                          ) : null}
	                          <button
	                            type="button"
	                            aria-label={`上移 ${row.name}`}
	                            title={`上移 ${row.name}`}
	                            onClick={() => void handleMoveDirectory(row)}
	                            disabled={directoryActionId === row.directoryId}
	                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
	                          >
	                            <ArrowUp className="h-3.5 w-3.5" />
	                          </button>
	                          <button
	                            type="button"
	                            aria-label={`重命名 ${row.name}`}
	                            title={`重命名 ${row.name}`}
	                            onClick={() => beginRenameDirectory(row)}
	                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-100"
	                          >
	                            <Edit3 className="h-3.5 w-3.5" />
	                          </button>
	                          <button
	                            type="button"
	                            aria-label={`归档 ${row.name}`}
	                            title={`归档 ${row.name}`}
	                            onClick={() => void handleArchiveDirectory(row)}
	                            disabled={directoryActionId === row.directoryId}
	                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
	                          >
	                            {directoryActionId === row.directoryId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
	                          </button>
	                        </>
	                      ) : null}
	                    </div>
	                  </>
	                )}
	              </div>
	              );
	            }) : (
	              <div className="rounded-lg border border-dashed border-[#dbe5f0] bg-[#f8fafc] px-3 py-4 text-sm font-semibold text-slate-500">
	                暂无知识目录
	              </div>
	            )}
	            </div>
	          </div>
	        </aside>

	        <div className="min-w-0 space-y-4" aria-label="文件管理工作区">

          <div className={cn(sectionShell, 'flex flex-wrap gap-2 p-2')} role="tablist" aria-label="知识库工作区">
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === tab.id}
                onClick={() => setActiveWorkspaceTab(tab.id)}
                className={cn(
                  'h-9 rounded-lg px-3 text-sm font-semibold transition',
                  activeWorkspaceTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-[#f1f5f9] hover:text-slate-950',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeWorkspaceTab === 'files' ? (
	          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="机构上传文件列表">
	            <div className="space-y-3 border-b border-[#e6edf5] p-4">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex items-center gap-3">
	                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
	                    <FileText className="h-5 w-5" />
	                  </div>
	                  <div>
	                    <h2 className="text-lg font-semibold tracking-normal text-slate-950">文件管理</h2>
	                    <p className="mt-1 text-sm text-slate-500">上传、解析、下载、归档文件并查看低敏元数据。</p>
	                  </div>
	                </div>
	                <span className="shrink-0 text-sm font-semibold text-slate-500">共 {formatNumber(visibleTotalFileCount)} 个文件</span>
	              </div>
	              <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_120px_140px_120px_auto]">
	                <label className="relative block min-w-0">
	                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
	                  <input
	                    value={fileSearch}
	                    onChange={(event) => handleFileSearchChange(event.target.value)}
	                    placeholder="搜索文件名"
	                    className="h-10 w-full rounded-lg border border-[#dbe5f0] bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-300"
	                  />
	                </label>
	                <select
	                  aria-label="按机构筛选文件"
	                  value={selectedTenantId}
	                  onChange={(event) => handleSelectTenant(event.target.value)}
	                  className="h-10 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
	                >
	                  {[view.allTenantStats, ...view.tenants].map((tenant) => (
	                    <option key={tenant.tenantId} value={tenant.tenantId}>
	                      {tenant.tenantName}
	                    </option>
	                  ))}
	                </select>
	                <select
	                  aria-label="按解析状态筛选文件"
	                  value="all"
	                  disabled
	                  className="h-10 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-500 outline-none disabled:opacity-70"
	                >
	                  <option value="all">解析状态：全部</option>
	                </select>
	                <select
	                  aria-label="按文件类型筛选文件"
	                  value="all"
	                  disabled
	                  className="h-10 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-500 outline-none disabled:opacity-70"
	                >
	                  <option value="all">文件类型：全部</option>
	                </select>
	                <button
	                  type="button"
	                  disabled
	                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#dbe5f0] bg-white px-4 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
	                >
	                  更多筛选
	                </button>
	              </div>
	              <div className="flex flex-wrap items-center gap-2">
	                <button
	                  type="button"
	                  onClick={handleSelectPage}
	                  disabled={visibleFiles.length === 0}
	                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
	                >
	                  选择本页
	                </button>
	                <button
	                  type="button"
	                  onClick={() => handleBulkDownloadSelectedFiles()}
	                  disabled={visibleSelectedFileIds.length === 0}
	                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
	                >
	                  <Download className="h-4 w-4" />
	                  打包下载
	                </button>
	                <button
	                  type="button"
	                  disabled
	                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
	                >
	                  <FileText className="h-4 w-4" />
	                  解析已选
	                </button>
	              </div>
	            </div>

            <div className="grid gap-3 border-b border-[#e6edf5] p-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatPill label="源文件" value={formatNumber(view.totals.sourceFileCount)} />
              <StatPill label="总大小" value={formatFileSize(view.totals.totalFileSizeKb)} />
              <StatPill label="解析成功" value={formatNumber(parsedFileCount)} />
              <StatPill label="解析失败" value={formatNumber(failedFileCount)} />
            </div>

            <div className="p-4">
	              {visibleSelectedFileIds.length > 0 ? (
	                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
	                  <span className="text-sm font-semibold text-blue-700">
	                    已选择 {visibleSelectedFileIds.length} 个文件
	                  </span>
	                </div>
	              ) : null}

              {visibleFiles.length === 0 ? (
                <EmptyState title={filesResponse.emptyState.title} description={filesResponse.emptyState.description} />
              ) : (
                <KnowledgeFileTable files={visibleFiles} selectedFileIds={visibleSelectedFileIds} onToggle={handleToggleFile} />
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#e6edf5] px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                第 {visibleFileRangeStart}-{visibleFileRangeEnd} 条，共 {visibleTotalFileCount} 个文件
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={!filePageInfo?.hasPreviousPage}
                  className="h-9 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="font-semibold text-slate-700">第 {safeFilePage}/{pageCount} 页</span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!filePageInfo?.hasNextPage}
                  className="h-9 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </article>
          ) : null}

          {activeWorkspaceTab === 'items' ? (
          <>
          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className={cn(sectionShell, 'overflow-hidden')}>
              <div className="flex items-center gap-3 border-b border-[#e6edf5] p-5">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">分类表现</h2>
              </div>
              <div className="divide-y divide-[#e6edf5]">
                {scopedCategories.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="暂无分类表现" description="当前机构范围还没有分类统计。" />
                  </div>
                ) : (
                  scopedCategories.map((category) => (
                    <div key={category.categoryCode} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            {category.categoryName}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {formatNumber(category.knowledgeCount)} 条 · {formatNumber(category.chunkCount)} 个片段 · 解析 {formatPercent(category.trainingCoverageRate)}
                          </div>
                        </div>
                        <Badge className="border-violet-100 bg-violet-50 text-violet-700">{formatNumber(category.hitCount)} 次命中</Badge>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
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
              <div className="flex items-center gap-3 border-b border-[#e6edf5] p-5">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">高频问题</h2>
                  <p className="mt-1 text-sm text-slate-500">按检索命中次数降序展示前 10 个问题。</p>
                </div>
              </div>
              <div className="divide-y divide-[#e6edf5]">
                {scopedTopQuestions.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="暂无高频问题" description="当前范围没有命中问题记录。" />
                  </div>
                ) : (
                  scopedTopQuestions.map((question, index) => (
                    <div key={question.knowledgeId} className="flex gap-3 p-5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-950">{question.questionTitle}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge className="border-[#e6edf5] bg-white text-slate-600">{question.category}</Badge>
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
            <div className="flex flex-col gap-3 border-b border-[#e6edf5] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识条目</h2>
                  <p className="mt-1 text-sm text-slate-500">平台端展示运营摘要，详细内容由机构端维护。</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-500">共 {formatNumber(visibleKnowledgeItems.length)} 条</span>
            </div>
            <KnowledgeTable items={visibleKnowledgeItems} />
          </article>
          </>
          ) : null}

          {activeWorkspaceTab === 'search' ? (
          <>
          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识片段检索">
            <div className="flex flex-col gap-4 border-b border-[#e6edf5] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">检索片段</h2>
                  <p className="mt-1 text-sm text-slate-500">按关键词读取已解析文件片段并返回引用位置。</p>
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
                    className="h-10 w-full rounded-2xl border border-[#e6edf5] bg-[#f8fafc] pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isKeywordSearching}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isKeywordSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  检索片段
                </button>
              </form>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-slate-600">
                {keywordSearchMessage}
              </div>
              {keywordSearchResults.length === 0 ? (
                <EmptyState title="暂无匹配片段" description="输入关键词后可查看已解析文件的引用片段。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {keywordSearchResults.map((result) => (
                    <article key={result.chunkId} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                      <div className="text-xs font-semibold text-slate-500">
                        {result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{result.textPreview}</p>
                      <div className="mt-3 text-xs font-semibold text-blue-700">{productizeKnowledgeRuntimeCopy(result.matchReason)}</div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </article>

          <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识向量索引">
              <div className="flex items-center gap-3 border-b border-[#e6edf5] p-5">
                <Layers3 className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">生成向量索引</h2>
                  <p className="mt-1 text-sm text-slate-500">为当前范围的已解析片段生成受控向量索引，仅用于只读检索预览。</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-slate-600">
                  {embeddingMessage}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateVectorIndex}
                  disabled={isEmbeddingLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEmbeddingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
                  生成向量索引
                </button>
              </div>
            </article>

            <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端语义检索">
              <div className="flex flex-col gap-4 border-b border-[#e6edf5] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal text-slate-950">语义检索</h2>
                    <p className="mt-1 text-sm text-slate-500">用受控向量相似度返回引用片段，不调用外部模型。</p>
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
                      className="h-10 w-full rounded-2xl border border-[#e6edf5] bg-[#f8fafc] pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isVectorSearching}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVectorSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    语义检索
                  </button>
                </form>
              </div>
              <div className="p-5">
                <div className="mb-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-slate-600">
                  {vectorSearchMessage}
                </div>
                {vectorSearchResults.length === 0 ? (
                  <EmptyState title="暂无相似片段" description="生成向量索引后可按语义相似度查看引用片段。" />
                ) : (
                  <div className="grid gap-3">
                    {vectorSearchResults.map((result) => (
                      <article key={result.chunkId} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                          <span>{result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}</span>
                          <span className="text-blue-700">相似度 {result.score.toFixed(3)}</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{result.textPreview}</p>
                        <div className="mt-3 text-xs font-semibold text-blue-700">{productizeKnowledgeRuntimeCopy(result.matchReason)}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </section>

          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端知识库问答">
            <div className="flex flex-col gap-4 border-b border-[#e6edf5] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识库问答</h2>
                  <p className="mt-1 text-sm text-slate-500">基于关键词和受控向量召回片段生成低敏回答。</p>
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
                      className="h-10 w-full rounded-2xl border border-[#e6edf5] bg-[#f8fafc] pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35"
                    />
                  </label>
                  <select
                    aria-label="选择问答检索模式"
                    value={qaRetrievalMode}
                    onChange={(event) => setQaRetrievalMode(event.target.value as 'keyword' | 'vector' | 'hybrid')}
                    className="h-10 rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-3 text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value="hybrid">混合检索</option>
                    <option value="keyword">关键词</option>
                    <option value="vector">语义</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isQaLoading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isQaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                    发起问答
                  </button>
                </div>
              </form>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-slate-600">
                {qaMessage}
              </div>
              {!qaResponse ? (
                <EmptyState title="暂无问答结果" description="输入问题后可查看回答和引用来源。" />
              ) : (
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <article className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                    <div className="text-xs font-semibold text-slate-500">
                      {qaResponse.retrievalMode === 'hybrid' ? '混合检索' : qaResponse.retrievalMode === 'keyword' ? '关键词' : '语义'}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{qaResponse.answer}</p>
                    <div className="mt-3 text-xs font-semibold text-emerald-700">审计编号 {qaResponse.auditId}</div>
                  </article>
                  <div className="grid gap-3">
                    {qaResponse.citations.length === 0 ? (
                      <EmptyState title="暂无引用来源" description="当前回答没有可展示的引用片段。" />
                    ) : (
                      qaResponse.citations.map((citation) => (
                        <article key={citation.chunkId} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                            <span>{citation.knowledgeTitle} · {citation.fileName} · 片段 {citation.chunkIndex + 1}</span>
                            <span className="text-blue-700">分数 {citation.score.toFixed(3)}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{citation.textPreview}</p>
                          <div className="mt-3 text-xs font-semibold text-blue-700">{productizeKnowledgeRuntimeCopy(citation.matchReason)}</div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>
          </>
          ) : null}

          {activeWorkspaceTab === 'audit' ? (
          <article className={cn(sectionShell, 'overflow-hidden')} aria-label="平台端问答审计">
            <div className="flex flex-col gap-4 border-b border-[#e6edf5] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">问答审计</h2>
                  <p className="mt-1 text-sm text-slate-500">查看当前机构范围的低敏问答记录。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadQaAudits}
                disabled={isQaAuditLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isQaAuditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                刷新审计
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-slate-600">
                {qaAuditMessage}
              </div>
              {qaAuditRecords.length === 0 ? (
                <EmptyState title="暂无问答审计" description="点击刷新后可查看当前范围的问答审计记录。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {qaAuditRecords.map((record) => (
                    <article key={record.auditId} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                        <span>{qaRetrievalModeLabels[record.retrievalMode]} · 引用 {record.citationCount}</span>
                        <span>{formatDate(record.createdAt)}</span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold tracking-normal text-slate-950">{record.question}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{record.answerPreview}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
                          {record.safeStatus}
                        </Badge>
                        {record.safeFailureMessage ? (
                          <Badge className="border-amber-100 bg-amber-50 text-amber-700">
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
          ) : null}

          {activeWorkspaceTab === 'files' ? (
	          <article ref={uploadPanelRef} className={cn(sectionShell, 'overflow-hidden')} aria-label="知识库文件管理操作区">
            <div className="flex flex-col gap-4 border-b border-[#e6edf5] p-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">上传与解析</h2>
                  <p className="mt-1 text-sm text-slate-500">平台端上传、下载和归档原始文件，仅展示低敏元数据。</p>
                </div>
              </div>

	              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <select
                  aria-label="选择文件所属知识库"
                  disabled={!hasManagedKnowledgeOptions}
                  value={hasManagedKnowledgeOptions ? effectiveManagedKnowledgeId : '__empty__'}
                  onChange={(event) => setManagedKnowledgeId(event.target.value)}
                  className="h-10 rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {hasManagedKnowledgeOptions ? visibleKnowledgeItems.map((item) => (
                    <option key={item.knowledgeId} value={item.knowledgeId}>
                      {item.title}
                    </option>
                  )) : (
                    <option value="__empty__">暂无可选知识库</option>
                  )}
                </select>
	                <label className="inline-flex h-10 min-w-[96px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#dbe5f0] bg-white px-3 text-sm font-semibold text-slate-700">
	                  <FileText className="h-4 w-4 shrink-0" />
	                  <span className="max-w-[160px] truncate whitespace-nowrap">{managedFile?.name ?? '选择文件'}</span>
	                  <input
	                    ref={managedFileInputRef}
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
	                  className="inline-flex h-10 min-w-[96px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
	                >
	                  <Upload className="h-4 w-4 shrink-0" />
	                  上传文件
                </button>
              </div>
            </div>

            {fileActionMessage ? (
              <div className="border-b border-[#e6edf5] px-4 py-3 text-sm font-semibold text-blue-700">
                {fileActionMessage}
              </div>
            ) : null}

            <div className="p-4">
              {!managedKnowledge ? (
                <EmptyState title="暂无可管理知识库" description="当前范围没有可绑定文件的知识条目。" />
              ) : managedFiles.length === 0 ? (
                <EmptyState title="暂无知识库文件" description="可先上传 PDF、DOCX、TXT、MD、CSV 或 XLSX 文件。" />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {managedFiles.map((file) => (
                    <div
                      key={file.fileId}
                      className="rounded-lg border border-[#e6edf5] bg-[#f8fafc] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">{file.originalFilename}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                            <span>{file.fileType}</span>
                            <span>{file.sizeLabel}</span>
                            <span>{file.status === 'active' ? '可下载' : '已归档'}</span>
                            <span>{formatNumber(file.textLength)} 字符</span>
                            <Badge className={managedParseStatusClasses[file.parseStatus]}>
                              {managedParseStatusLabels[file.parseStatus]} · {file.chunkCount} 片段
                            </Badge>
                          </div>
                          {file.safeFailureMessage ? (
                            <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                              {file.safeFailureMessage}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadManagedFile(file)}
                            disabled={file.status !== 'active'}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            下载文件
                          </button>
                          <button
                            type="button"
                            onClick={() => handleParseManagedFile(file)}
                            disabled={file.status !== 'active' || isFileActionLoading}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FileText className="h-4 w-4" />
                            发起解析
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadManagedChunks(file)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 text-xs font-semibold text-sky-700"
                          >
                            <Layers3 className="h-4 w-4" />
                            查看片段
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveManagedFile(file)}
                            disabled={file.status !== 'active' || isFileActionLoading}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Archive className="h-4 w-4" />
                            归档文件
                          </button>
                        </div>
                      </div>
                      {expandedParseFileId === file.fileId ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-[#e6edf5] bg-white p-3">
                          {(managedChunksByFileId[file.fileId] ?? []).length === 0 ? (
                            <div className="text-xs font-semibold text-slate-500">暂无解析片段</div>
                          ) : (
                            (managedChunksByFileId[file.fileId] ?? []).map((chunk) => (
                              <div key={chunk.chunkId} className="rounded-lg border border-[#e6edf5] bg-[#f8fafc] px-3 py-2">
                                <div className="text-xs font-semibold text-slate-500">
                                  片段 {chunk.chunkIndex + 1} · {chunk.charCount} 字
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700">{chunk.textPreview}</p>
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
          ) : null}

          {activeWorkspaceTab === 'jobs' ? (
          <article className={cn(sectionShell, 'overflow-hidden')}>
            <div className="flex items-center gap-3 border-b border-[#e6edf5] p-4">
              <Layers3 className="h-5 w-5 text-violet-600" />
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">导入与解析任务</h2>
                <p className="mt-1 text-sm text-slate-500">用于平台侧发现批量导入失败、解析异常和任务堆积。</p>
              </div>
            </div>
            <div className="divide-y divide-[#e6edf5]">
              {scopedJobs.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="暂无任务记录" description="当前机构范围没有导入或解析任务。" />
                </div>
              ) : (
                scopedJobs.map((job) => (
                  <div key={job.taskId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Badge className={importJobStatusClasses[job.status]}>{importJobStatusLabels[job.status]}</Badge>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-950">{job.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{job.tenantName}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          成功 {formatNumber(job.successCount)} / {formatNumber(job.totalCount)}，失败 {formatNumber(job.failedCount)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-500">{job.updatedAt}</div>
                  </div>
                ))
              )}
            </div>
          </article>
	          ) : null}
	        </div>

	        <aside className="space-y-3" aria-label="运营信号">
	          <article className={cn(sectionShell, 'p-4')}>
	            <div className="flex items-center justify-between gap-3">
	              <div>
	                <h2 className="text-base font-semibold tracking-normal text-slate-950">运营信号</h2>
	                <p className="mt-1 text-xs text-slate-500">最近同步：{lastSyncedAt}</p>
	              </div>
	              <button
	                type="button"
	                onClick={handleSync}
	                disabled={isSyncing}
	                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dbe5f0] bg-white px-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
	              >
	                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
	                刷新
	              </button>
	            </div>
	          </article>

	          <article className={cn(sectionShell, 'p-4')}>
	            <h3 className="text-sm font-semibold tracking-normal text-slate-950">高频提问 TOP 5</h3>
	            <div className="mt-3 space-y-3">
	              {scopedTopQuestions.slice(0, 5).length === 0 ? (
	                <div className="text-sm text-slate-500">暂无高频问题</div>
	              ) : (
	                scopedTopQuestions.slice(0, 5).map((question, index) => (
	                  <div key={question.knowledgeId} className="flex items-center gap-3 text-sm">
	                    <span className="w-4 shrink-0 text-xs font-semibold text-slate-500">{index + 1}</span>
	                    <span className="min-w-0 flex-1 truncate text-slate-700">{question.questionTitle}</span>
	                    <span className="shrink-0 font-semibold text-slate-500">{formatNumber(question.hitCount)}</span>
	                  </div>
	                ))
	              )}
	            </div>
	          </article>

	          <article className={cn(sectionShell, 'p-4')}>
	            <h3 className="text-sm font-semibold tracking-normal text-slate-950">热门知识分类 TOP 5</h3>
	            <div className="mt-3 space-y-3">
	              {scopedCategories.slice(0, 5).length === 0 ? (
	                <div className="text-sm text-slate-500">暂无分类</div>
	              ) : (
	                scopedCategories.slice(0, 5).map((category) => (
	                  <div key={category.categoryCode} className="flex items-center justify-between gap-3 text-sm">
	                    <span className="min-w-0 truncate text-slate-700">{category.categoryName}</span>
	                    <span className="shrink-0 font-semibold text-slate-500">{formatNumber(category.hitCount)}</span>
	                  </div>
	                ))
	              )}
	            </div>
	          </article>

	          <article className={cn(sectionShell, 'p-4')}>
	            <div className="text-sm text-slate-500">命中次数（近7天）</div>
	            <div className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{formatNumber(view.totals.hitCount)}</div>
	            <div className="mt-1 text-xs font-semibold text-emerald-600">较上周保持可观测</div>
	          </article>

	          <article className={cn(sectionShell, 'p-4')}>
	            <div className="text-sm text-slate-500">导入成功率（近7天）</div>
	            <div className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{formatPercent(view.totals.importSuccessRate)}</div>
	            <div className="mt-1 text-xs font-semibold text-emerald-600">基于当前范围统计</div>
	          </article>
	        </aside>
	      </div>
        </>
      )}
    </section>
  );
}
