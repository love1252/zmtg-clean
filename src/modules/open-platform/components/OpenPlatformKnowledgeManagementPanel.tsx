'use client';

import { useEffect, useMemo, useState } from 'react';
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
  filterKnowledgeFiles,
  getPlatformKnowledgeMockData,
  getPlatformKnowledgeScope,
  normalizeTenantName,
  type ImportJobStatus,
  type KnowledgeFileItem,
  type KnowledgeFileParseStatus,
  type KnowledgeItem,
  type KnowledgeTrainingStatus,
  type TenantKnowledgeStats,
} from '@/modules/open-platform/mock/platformKnowledge';
import { cn } from '@/shared/utils/cn';

const ALL_TENANTS = 'all';
const FILE_PAGE_SIZE = 6;

const sectionShell = 'rounded-[24px] border border-white/10 bg-white/[0.075] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl';
const innerCard = 'rounded-2xl border border-white/10 bg-[#071322]/72';

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
  const emptyState = getPlatformKnowledgeMockData().emptyState;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{title ?? emptyState.title}</div>
      <p className="mt-1 text-sm text-slate-400">{description ?? emptyState.description}</p>
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
  file: KnowledgeFileItem;
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
          <p className="mt-1 truncate text-xs text-slate-400">{normalizeTenantName(file.tenantName)}</p>
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

function KnowledgeTable({ items }: { items: KnowledgeItem[] }) {
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
                <span className="line-clamp-2">{item.summaryPreview}</span>
              </td>
              <td className="border-b border-white/10 px-4 py-4 text-slate-300">{normalizeTenantName(item.tenantName)}</td>
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState('刚刚');
  const [data, setData] = useState(() => getPlatformKnowledgeMockData());

  const scope = useMemo(
    () => getPlatformKnowledgeScope(data, selectedTenantId === ALL_TENANTS ? null : selectedTenantId),
    [data, selectedTenantId],
  );
  const allTenantStats = useMemo<TenantKnowledgeStats>(
    () => ({
      tenantId: ALL_TENANTS,
      tenantName: '全部机构',
      status: 'active',
      knowledgeCount: data.totals.knowledgeCount,
      folderCount: data.totals.folderCount,
      hitCount: data.totals.hitCount,
      trainedCount: data.totals.trainedCount,
      failedTrainingCount: data.totals.failedTrainingCount,
      zeroHitCount: data.totals.zeroHitCount,
      chunkCount: data.totals.chunkCount,
      averageHitCount: data.totals.averageHitCount,
      hitCoverageRate: data.totals.hitCoverageRate,
      trainingCoverageRate: data.totals.trainingCoverageRate,
      importSuccessRate: data.totals.importSuccessRate,
    }),
    [data],
  );
  const scopeName = scope.scopeName;
  const scopedFiles = scope.files;
  const scopedKnowledgeItems = scope.knowledgeItems;
  const scopedJobs = scope.importJobs;
  const scopedTopQuestions = scope.topQuestions;
  const scopedCategories = scope.categories;
  const filteredFiles = useMemo(() => {
    return filterKnowledgeFiles(scopedFiles, { keyword: fileSearch });
  }, [fileSearch, scopedFiles]);
  const pageCount = Math.max(1, Math.ceil(filteredFiles.length / FILE_PAGE_SIZE));
  const safeFilePage = Math.min(filePage, pageCount);
  const pagedFiles = filteredFiles.slice((safeFilePage - 1) * FILE_PAGE_SIZE, safeFilePage * FILE_PAGE_SIZE);
  const maxCategoryHits = Math.max(1, ...scopedCategories.map((category) => category.hitCount));
  const parsedFileCount = scope.totals.parsedFileCount;
  const failedFileCount = scope.totals.failedFileCount;
  const zeroHitCount = scope.totals.zeroHitCount;

  useEffect(() => {
    if (!isSyncing) return undefined;

    const timer = window.setTimeout(() => {
      setLastSyncedAt(new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()));
      setData(getPlatformKnowledgeMockData());
      setIsSyncing(false);
    }, 380);

    return () => window.clearTimeout(timer);
  }, [isSyncing]);

  function handleSelectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    setFilePage(1);
    setSelectedFileIds([]);
  }

  function handleFileSearchChange(value: string) {
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
    setSelectedFileIds(pagedFiles.map((file) => file.fileId));
  }

  function handleSync() {
    setIsSyncing(true);
  }

  const metricCards = [
    { label: '接入机构', value: formatNumber(data.totals.tenantCount), helper: `${formatNumber(data.totals.sourceFileCount)} 个源文件`, icon: Building2, tone: 'bg-blue-300/[0.12] text-blue-200' },
    { label: '知识条目', value: formatNumber(data.totals.knowledgeCount), helper: `${formatNumber(data.totals.chunkCount)} 个训练片段`, icon: Database, tone: 'bg-cyan-300/[0.12] text-cyan-200' },
    { label: '累计命中', value: formatNumber(data.totals.hitCount), helper: `平均 ${data.totals.averageHitCount} 次/条`, icon: TrendingUp, tone: 'bg-emerald-300/[0.12] text-emerald-200' },
    { label: '训练覆盖', value: formatPercent(data.totals.trainingCoverageRate), helper: `${data.totals.trainedCount} 条已训练`, icon: CheckCircle2, tone: 'bg-violet-300/[0.12] text-violet-200' },
    { label: '待优化', value: formatNumber(data.totals.pendingOptimizationCount), helper: `${data.totals.failedImportJobCount} 个异常任务`, icon: AlertTriangle, tone: 'bg-amber-300/[0.12] text-amber-200' },
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
              {[allTenantStats, ...data.tenants].map((tenant) => {
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
                        <div className="truncate text-sm font-semibold text-white">{normalizeTenantName(tenant.tenantName)}</div>
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
              <StatPill label="知识" value={formatNumber(scope.totals.knowledgeCount)} />
              <StatPill label="片段" value={formatNumber(scope.totals.chunkCount)} />
              <StatPill label="命中覆盖" value={formatPercent(scope.totals.hitCoverageRate)} />
              <StatPill label="训练覆盖" value={formatPercent(scope.totals.trainingCoverageRate)} />
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
                    {formatNumber(scope.totals.knowledgeCount)} 条知识 · {formatNumber(scope.totals.folderCount)} 个文件夹 · 累计命中 {formatNumber(scope.totals.hitCount)} 次
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
                <StatPill label="知识" value={formatNumber(scope.totals.knowledgeCount)} />
                <StatPill label="文件夹" value={formatNumber(scope.totals.folderCount)} />
                <StatPill label="累计命中" value={formatNumber(scope.totals.hitCount)} />
                <StatPill label="导入成功率" value={formatPercent(scope.totals.importSuccessRate)} />
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
                  <dd className="font-semibold text-white">{formatPercent(scope.totals.importSuccessRate)}</dd>
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
                  disabled={pagedFiles.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  选择本页
                </button>
              </div>
            </div>

            <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatPill label="源文件" value={formatNumber(scopedFiles.length)} />
              <StatPill label="总大小" value={formatFileSize(scopedFiles.reduce((total, file) => total + file.fileSizeKb, 0))} />
              <StatPill label="解析成功" value={formatNumber(parsedFileCount)} />
              <StatPill label="解析失败" value={formatNumber(failedFileCount)} />
            </div>

            <div className="p-5">
              {selectedFileIds.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-3 text-sm font-semibold text-cyan-100">
                  已选择 {selectedFileIds.length} 个文件
                </div>
              ) : null}

              {pagedFiles.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {pagedFiles.map((file) => (
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
                第 {filteredFiles.length === 0 ? 0 : (safeFilePage - 1) * FILE_PAGE_SIZE + 1}-{Math.min(safeFilePage * FILE_PAGE_SIZE, filteredFiles.length)} 条，共 {filteredFiles.length} 个文件
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilePage((current) => Math.max(1, current - 1))}
                  disabled={safeFilePage <= 1}
                  className="h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="font-semibold text-slate-200">第 {safeFilePage}/{pageCount} 页</span>
                <button
                  type="button"
                  onClick={() => setFilePage((current) => Math.min(pageCount, current + 1))}
                  disabled={safeFilePage >= pageCount}
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
                          <span>{normalizeTenantName(question.tenantName)}</span>
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
                        <div className="mt-1 text-sm text-slate-400">{normalizeTenantName(job.tenantName)}</div>
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
    </section>
  );
}
