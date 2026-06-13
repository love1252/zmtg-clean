'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
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
  trained: '已训练',
  training: '训练中',
  pending: '待训练',
  failed: '训练异常',
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
            <th className="border-b border-white/10 px-4 py-3">训练状态</th>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshReasonRef = useRef<'auto' | 'sync'>('auto');
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
  const zeroHitCount = view?.totals.zeroHitCount ?? 0;

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

  const metricCards = [
    { label: '接入机构', value: formatNumber(view?.allTotals.tenantCount ?? 0), helper: `${formatNumber(view?.allTotals.sourceFileCount ?? 0)} 个源文件`, icon: Building2, tone: 'bg-blue-300/[0.12] text-blue-200' },
    { label: '知识条目', value: formatNumber(view?.allTotals.knowledgeCount ?? 0), helper: `${formatNumber(view?.allTotals.chunkCount ?? 0)} 个训练片段`, icon: Database, tone: 'bg-cyan-300/[0.12] text-cyan-200' },
    { label: '累计命中', value: formatNumber(view?.allTotals.hitCount ?? 0), helper: `平均 ${view?.allTotals.averageHitCount ?? 0} 次/条`, icon: TrendingUp, tone: 'bg-emerald-300/[0.12] text-emerald-200' },
    { label: '训练覆盖', value: formatPercent(view?.allTotals.trainingCoverageRate ?? 0), helper: `${view?.allTotals.trainedCount ?? 0} 条已训练`, icon: CheckCircle2, tone: 'bg-violet-300/[0.12] text-violet-200' },
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
              查看各机构知识训练、命中表现、导入概况和高频问题。
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

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <article className={cn(sectionShell, 'p-5')}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-300/[0.12] text-blue-200">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">机构概况</h2>
                <p className="mt-1 text-sm text-slate-400">按机构查看知识量、命中和训练覆盖。</p>
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
              <StatPill label="训练覆盖" value={formatPercent(view.totals.trainingCoverageRate)} />
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
                            {formatNumber(category.knowledgeCount)} 条 · {formatNumber(category.chunkCount)} 个片段 · 训练 {formatPercent(category.trainingCoverageRate)}
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

          <article className={cn(sectionShell, 'overflow-hidden')}>
            <div className="flex items-center gap-3 border-b border-white/10 p-5">
              <Layers3 className="h-5 w-5 text-violet-200" />
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-white">导入与训练任务</h2>
                <p className="mt-1 text-sm text-slate-400">用于平台侧发现批量导入失败、训练异常和任务堆积。</p>
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {scopedJobs.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="暂无任务记录" description="当前机构范围没有导入或训练任务。" />
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
