'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  FileText,
  FolderPlus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import type { InstitutionKnowledgeItemDto } from '@/modules/institution/domain/institution-knowledge-management';
import { listInstitutionKnowledgeItems } from '@/modules/institution/client/tenant-business-client';
import { cn } from '@/shared/utils/cn';

type DirectoryId = 'all' | 'consultation' | 'project' | 'aftercare' | 'campaign' | 'training' | 'other';
type LoadStatus = 'idle' | 'loading' | 'success' | 'error';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type SearchStatus = 'idle' | 'searching' | 'success' | 'empty' | 'error';

type InstitutionKnowledgeFileRecord = {
  fileId: string;
  knowledgeId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'active' | 'archived';
  fileType: string;
  sizeLabel: string;
  parseStatus: 'pending' | 'processing' | 'succeeded' | 'failed';
  failureReasonCode?: string | null;
  safeFailureMessage: string | null;
  textLength?: number;
  chunkCount: number;
  parserVersion?: string | null;
  uploadedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
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

type ControlledAction = {
  label: string;
  icon: LucideIcon;
  reason: string;
};

const directorySeeds: Array<{
  id: DirectoryId;
  label: string;
  description: string;
  keywords: string[];
}> = [
  { id: 'all', label: '全部知识', description: '当前机构可见知识汇总', keywords: [] },
  { id: 'consultation', label: '咨询话术', description: '接待、咨询、复诊沟通', keywords: ['咨询', '话术', '接待', '沟通'] },
  { id: 'project', label: '项目资料', description: '项目说明与服务边界', keywords: ['项目', '资料', '说明'] },
  { id: 'aftercare', label: '术后护理', description: '护理提醒与注意事项', keywords: ['术后', '护理', '复诊', '冷敷'] },
  { id: 'campaign', label: '活动政策', description: '优惠、权益、活动口径', keywords: ['活动', '政策', '权益', '优惠'] },
  { id: 'training', label: '培训资料', description: '内部培训与操作 SOP', keywords: ['培训', 'SOP', '流程'] },
  { id: 'other', label: '其他知识', description: '未归入预设目录的真实数据', keywords: [] },
];

const unsupportedDocumentExamples = [
  '复杂 PDF / Word / Excel 深度解析仍为后续接入',
  'OCR、扫描件识别、复杂表格抽取未接入',
];

const controlledActions: ControlledAction[] = [
  { label: '新建知识', icon: BookOpen, reason: '待接入可靠新建知识 API' },
  { label: '新建文件夹', icon: FolderPlus, reason: '待接入目录写入 API' },
  { label: '重新解析', icon: RefreshCw, reason: '待接入机构端重新解析触发入口' },
  { label: '重新训练', icon: RefreshCw, reason: '未接训练 runtime' },
  { label: '删除', icon: Trash2, reason: '待接入删除审计和恢复策略' },
];

const statusLabels: Record<InstitutionKnowledgeItemDto['status'], string> = {
  ready: '可用',
  pending: '处理中',
  empty: '空内容',
  failed: '失败',
  disabled: '已下架',
  denied: '已拒绝',
};

const parseStatusLabels: Record<InstitutionKnowledgeFileRecord['parseStatus'], string> = {
  pending: '待解析',
  processing: '解析中',
  succeeded: '已解析',
  failed: '失败',
};

function statusClassName(status: InstitutionKnowledgeItemDto['status'] | InstitutionKnowledgeFileRecord['parseStatus']) {
  if (status === 'ready' || status === 'succeeded') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'failed' || status === 'denied') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'processing' || status === 'pending') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
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

function getVisibleError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return fallback;
}

function getDirectoryId(item: InstitutionKnowledgeItemDto): DirectoryId {
  const source = `${item.category} ${item.title} ${item.descriptionPreview}`.toLowerCase();
  const matched = directorySeeds.find((directory) =>
    directory.id !== 'all' && directory.id !== 'other'
      ? directory.keywords.some((keyword) => source.includes(keyword.toLowerCase()))
      : false,
  );
  return matched?.id ?? 'other';
}

function isAllowedUploadFile(file: File | null) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return name.endsWith('.txt') || name.endsWith('.md');
}

function ControlledButton({ action }: { action: ControlledAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled
      aria-label={`${action.label}（${action.reason}）`}
      title={action.reason}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
    >
      <Icon className="h-4 w-4" />
      {action.label}
    </button>
  );
}

export function InstitutionKnowledgeBaseCardPanel() {
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<DirectoryId>('all');
  const [knowledgeStatus, setKnowledgeStatus] = useState<LoadStatus>('loading');
  const [knowledgeMessage, setKnowledgeMessage] = useState('正在读取机构可见知识库数据...');
  const [knowledgeItems, setKnowledgeItems] = useState<InstitutionKnowledgeItemDto[]>([]);
  const [filesByKnowledgeId, setFilesByKnowledgeId] = useState<Record<string, InstitutionKnowledgeFileRecord[]>>({});
  const [fileMessage, setFileMessage] = useState('文件列表将随真实知识条目加载。');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('支持上传 .txt / .md，上传后使用现有机构端 API 自动保存并简单解析。');
  const [searchInput, setSearchInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchMessage, setSearchMessage] = useState('请输入关键词测试已解析片段检索；不会调用 AI provider 或向量数据库。');
  const [searchResults, setSearchResults] = useState<InstitutionKnowledgeSearchResultRecord[]>([]);

  const loadKnowledgeFiles = useCallback(async (items: InstitutionKnowledgeItemDto[]) => {
    if (items.length === 0) {
      setFilesByKnowledgeId({});
      setFileMessage('当前没有真实文件记录。');
      return;
    }

    try {
      const entries = await Promise.all(
        items.map(async (item) => {
          const response = await fetch(`/api/institution/knowledge-management/items/${encodeURIComponent(item.knowledgeId)}/files`, {
            cache: 'no-store',
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload || !Array.isArray(payload.records)) return [item.knowledgeId, []] as const;
          return [item.knowledgeId, payload.records as InstitutionKnowledgeFileRecord[]] as const;
        }),
      );
      setFilesByKnowledgeId(Object.fromEntries(entries));
      const total = entries.reduce((sum, [, files]) => sum + files.length, 0);
      setFileMessage(total > 0 ? `已读取 ${total} 个真实文件记录。` : '当前知识条目暂无真实文件记录。');
    } catch {
      setFilesByKnowledgeId({});
      setFileMessage('文件列表暂时不可用，知识条目仍可查看。');
    }
  }, []);

  const loadKnowledgeItems = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setKnowledgeStatus('loading');
      setKnowledgeMessage('正在读取机构可见知识库数据...');
    }
    const result = await listInstitutionKnowledgeItems({ page: 1, pageSize: 20 });

    if (!result.ok) {
      setKnowledgeItems([]);
      setFilesByKnowledgeId({});
      setKnowledgeStatus('error');
      setKnowledgeMessage(result.error.message || '机构知识库数据暂时不可用');
      return;
    }

    setKnowledgeItems(result.records);
    setKnowledgeStatus('success');
    setKnowledgeMessage(
      result.records.length > 0
        ? `已读取 ${result.pageInfo.total} 条机构可见知识，统计基于现有 API 返回。`
        : '当前机构暂无可见知识库数据，请上传 txt / md 后查看。',
    );
    await loadKnowledgeFiles(result.records);
  }, [loadKnowledgeFiles]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialKnowledgeItems() {
      const result = await listInstitutionKnowledgeItems({ page: 1, pageSize: 20 });
      if (!isMounted) return;

      if (!result.ok) {
        setKnowledgeItems([]);
        setFilesByKnowledgeId({});
        setKnowledgeStatus('error');
        setKnowledgeMessage(result.error.message || '机构知识库数据暂时不可用');
        return;
      }

      setKnowledgeItems(result.records);
      setKnowledgeStatus('success');
      setKnowledgeMessage(
        result.records.length > 0
          ? `已读取 ${result.pageInfo.total} 条机构可见知识，统计基于现有 API 返回。`
          : '当前机构暂无可见知识库数据，请上传 txt / md 后查看。',
      );
      await loadKnowledgeFiles(result.records);
    }

    void loadInitialKnowledgeItems();

    return () => {
      isMounted = false;
    };
  }, [loadKnowledgeFiles]);

  const directories = useMemo(() => {
    const counts = new Map<DirectoryId, number>();
    for (const seed of directorySeeds) counts.set(seed.id, 0);
    counts.set('all', knowledgeItems.length);
    for (const item of knowledgeItems) {
      const directoryId = getDirectoryId(item);
      counts.set(directoryId, (counts.get(directoryId) ?? 0) + 1);
    }

    return directorySeeds.map((seed) => ({ ...seed, count: counts.get(seed.id) ?? 0 }));
  }, [knowledgeItems]);

  const selectedItems = useMemo(() => {
    if (selectedDirectoryId === 'all') return knowledgeItems;
    return knowledgeItems.filter((item) => getDirectoryId(item) === selectedDirectoryId);
  }, [knowledgeItems, selectedDirectoryId]);

  const selectedDirectory = directories.find((directory) => directory.id === selectedDirectoryId) ?? directories[0];
  const allFiles = useMemo(() => Object.values(filesByKnowledgeId).flat(), [filesByKnowledgeId]);
  const visibleFiles = useMemo(() => {
    const selectedKnowledgeIds = new Set(selectedItems.map((item) => item.knowledgeId));
    if (selectedDirectoryId === 'all') return allFiles;
    return allFiles.filter((file) => selectedKnowledgeIds.has(file.knowledgeId));
  }, [allFiles, selectedDirectoryId, selectedItems]);
  const parsedCount = allFiles.filter((file) => file.parseStatus === 'succeeded').length;
  const pendingCount = allFiles.filter((file) => file.parseStatus === 'pending' || file.parseStatus === 'processing').length;
  const failedCount = allFiles.filter((file) => file.parseStatus === 'failed').length;
  const lowHitCount = knowledgeItems.filter((item) => item.chunkCount === 0 || item.status !== 'ready').length;

  const metrics = [
    { label: '知识条目', value: String(knowledgeItems.length), helper: '来自机构端 items API 当前可见范围' },
    { label: '文件数', value: String(allFiles.length), helper: '来自机构端 files API 当前可见范围' },
    { label: '已解析 / 待解析', value: `${parsedCount} / ${pendingCount}`, helper: '基于文件解析状态实时展示' },
    { label: '待优化 / 低命中', value: `${lowHitCount} / ${failedCount}`, helper: '基于空片段、非 ready 和失败文件的基础提示' },
  ];

  function changeUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadStatus('idle');
    if (!file) {
      setUploadMessage('支持上传 .txt / .md，上传后使用现有机构端 API 自动保存并简单解析。');
      return;
    }
    setUploadMessage(
      isAllowedUploadFile(file)
        ? `已选择 ${file.name}，可上传并触发现有简单解析。`
        : '当前最小闭环仅开放 txt / md；复杂 PDF / Word / Excel 深度解析仍为后续接入。',
    );
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadStatus('error');
      setUploadMessage('请先选择 txt / md 文件。');
      return;
    }
    if (!isAllowedUploadFile(uploadFile)) {
      setUploadStatus('error');
      setUploadMessage('当前最小闭环仅开放 txt / md；复杂 PDF / Word / Excel 深度解析仍为后续接入。');
      return;
    }

    setUploadStatus('uploading');
    setUploadMessage('正在上传并触发现有简单解析...');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await fetch('/api/institution/knowledge-management/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadStatus('error');
        setUploadMessage(getVisibleError(payload, '上传失败，请稍后重试。'));
        return;
      }

      setUploadStatus('success');
      const chunkCount = typeof payload?.chunkCount === 'number' ? payload.chunkCount : 0;
      setUploadMessage(`上传成功，已触发现有简单解析，生成 ${chunkCount} 个片段。`);
      setUploadFile(null);
      await loadKnowledgeItems();
    } catch {
      setUploadStatus('error');
      setUploadMessage('上传失败，请稍后重试。');
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = searchInput.trim();
    if (!keyword) {
      setSearchStatus('error');
      setSearchResults([]);
      setSearchMessage('请输入关键词后再检索。');
      return;
    }

    setSearchStatus('searching');
    setSearchMessage('正在使用机构端关键词检索 API 查询已解析片段...');
    try {
      const params = new URLSearchParams({ keyword });
      const response = await fetch(`/api/institution/knowledge-management/search?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        setSearchStatus('error');
        setSearchResults([]);
        setSearchMessage(getVisibleError(payload, '关键词检索暂时不可用。'));
        return;
      }

      const records = payload.records as InstitutionKnowledgeSearchResultRecord[];
      setSearchResults(records);
      setSearchStatus(records.length > 0 ? 'success' : 'empty');
      setSearchMessage(records.length > 0 ? `已命中 ${records.length} 个真实解析片段。` : '暂无匹配片段。');
    } catch {
      setSearchStatus('error');
      setSearchResults([]);
      setSearchMessage('关键词检索暂时不可用。');
    }
  }

  return (
    <section
      aria-label="机构知识库卡片功能壳"
      className="space-y-5 rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-7"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">机构端知识库最小闭环</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">机构知识库</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            用于维护机构内部话术、项目说明、服务流程和培训知识。当前接入现有机构端知识库列表、txt / md 上传和关键词检索测试。
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            本轮不接 AI provider、不接向量数据库、不做复杂 PDF / Word / Excel 深度解析，也不宣称生产可用。
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            最小闭环说明
          </div>
          <p className="mt-1 text-xs leading-5">
            上传和检索使用现有机构端 API；新建、重新训练、向量和复杂删除仍受控禁用。
          </p>
        </div>
      </div>

      <section aria-label="机构知识库顶部指标" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-500">{metric.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{metric.helper}</p>
          </article>
        ))}
      </section>

      <section aria-label="机构知识库受控操作" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">操作入口</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              上传文档已接入现有 API；新建、目录、重新解析、重新训练和删除继续保持受控。
            </p>
          </div>
          <form onSubmit={submitUpload} className="flex w-full flex-col gap-2 xl:w-[520px]">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="选择知识库上传文件"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={changeUploadFile}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-cyan-700"
              />
              <button
                type="submit"
                disabled={uploadStatus === 'uploading'}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadStatus === 'uploading' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                上传文档
              </button>
            </div>
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-semibold',
                uploadStatus === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : uploadStatus === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500',
              )}
            >
              {uploadMessage}
            </div>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {controlledActions.map((action) => (
            <ControlledButton key={action.label} action={action} />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside aria-label="机构知识目录" className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识目录</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">目录按当前真实知识数据的分类和标题归集。</p>
          </div>
          <div className="space-y-2">
            {directories.map((directory) => {
              const isSelected = directory.id === selectedDirectoryId;
              return (
                <button
                  key={directory.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDirectoryId(directory.id)}
                  className={cn(
                    'w-full rounded-2xl border px-3 py-3 text-left transition',
                    isSelected
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-200 hover:bg-white',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{directory.label}</span>
                    <span className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-xs font-semibold">
                      {directory.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 opacity-80">{directory.description}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-5">
          <section aria-label="机构知识条目卡片" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识条目</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  当前目录：{selectedDirectory.label}。{knowledgeMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadKnowledgeItems()}
                disabled={knowledgeStatus === 'loading'}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn('h-4 w-4', knowledgeStatus === 'loading' ? 'animate-spin' : '')} />
                刷新真实数据
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {knowledgeStatus === 'loading' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  正在加载机构知识库卡片数据...
                </div>
              ) : knowledgeStatus === 'error' ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                  {knowledgeMessage}
                </div>
              ) : selectedItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。
                </div>
              ) : (
                selectedItems.map((entry) => (
                  <article key={entry.knowledgeId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-semibold tracking-normal text-slate-950">知识条目：{entry.title}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                            {entry.category || '未分类'}
                          </span>
                          <span className={cn('rounded-full border px-2.5 py-1', statusClassName(entry.status))}>
                            {statusLabels[entry.status]}
                          </span>
                          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-cyan-700">
                            {entry.visibility === 'owned' ? '本机构归属' : '平台授权可见'}
                          </span>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                            {entry.chunkCount > 0 ? `命中基础：${entry.chunkCount} 个片段` : '低命中提示：暂无片段'}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">更新于 {formatDate(entry.updatedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">摘要：{entry.descriptionPreview || '暂无摘要。'}</p>
                    <div className="mt-3 rounded-xl border border-white bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                      片段数 {entry.chunkCount}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section aria-label="机构知识库文件文档卡片" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">文件 / 文档</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{fileMessage}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {visibleFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 lg:col-span-3">
                  当前范围暂无真实文件记录。上传 txt / md 成功后会显示在这里。
                </div>
              ) : (
                visibleFiles.map((document) => (
                  <article key={`${document.knowledgeId}-${document.fileId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{document.originalFilename}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{document.fileType} / {document.sizeLabel}</p>
                      </div>
                      <FileText className="h-5 w-5 shrink-0 text-cyan-600" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={cn('rounded-full border px-2.5 py-1', statusClassName(document.parseStatus))}>
                        {parseStatusLabels[document.parseStatus]}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                        {document.status === 'active' ? '可查看' : '已归档'}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                      <div>
                        <dt className="font-semibold text-slate-500">解析字符数</dt>
                        <dd>{typeof document.textLength === 'number' ? document.textLength : '待解析结果返回'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">更新时间</dt>
                        <dd>{formatDate(document.updatedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">错误信息</dt>
                        <dd>{document.safeFailureMessage || '暂无错误'}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              )}
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-500">
              {unsupportedDocumentExamples.map((example) => (
                <div key={example} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-700">
                  {example}
                </div>
              ))}
            </div>
          </section>

          <section aria-label="机构知识库检索测试卡片" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">检索测试</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">使用现有关键词检索 API 查询已解析片段；不调用 AI provider，不使用向量数据库。</p>
              </div>
              <form onSubmit={submitSearch} className="flex w-full flex-col gap-2 lg:w-[460px] sm:flex-row">
                <input
                  aria-label="输入知识库检索关键词"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="输入关键词，例如 冷敷"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={searchStatus === 'searching'}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searchStatus === 'searching' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  开始检索测试
                </button>
              </form>
            </div>
            <div
              className={cn(
                'mt-4 rounded-xl border px-3 py-2 text-xs font-semibold',
                searchStatus === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : searchStatus === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : searchStatus === 'empty'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500',
              )}
            >
              {searchMessage}
            </div>
            <div className="mt-4 grid gap-3">
              {searchResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  暂无检索结果。命中后会展示知识标题、文件名、片段序号和低敏片段预览。
                </div>
              ) : (
                searchResults.map((result) => (
                  <article key={result.chunkId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                      <span>{result.knowledgeTitle} · {result.fileName} · 片段 {result.chunkIndex + 1}</span>
                      <span className="text-cyan-700">关键词命中</span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{result.textPreview}</p>
                    <div className="mt-2 text-xs font-semibold text-cyan-700">{result.matchReason}</div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section aria-label="机构知识库解析训练任务记录" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">解析 / 训练任务记录</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">解析记录来自真实文件状态；训练仍未接入。</p>
            </div>
            <div className="mt-4 grid gap-3">
              {allFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  暂无解析任务记录。上传 txt / md 后会显示解析状态。
                </div>
              ) : (
                allFiles.map((file) => (
                  <article key={`${file.knowledgeId}-${file.fileId}-task`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">{file.originalFilename} 解析任务</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className={cn('rounded-full border px-2.5 py-1', statusClassName(file.parseStatus))}>
                            {parseStatusLabels[file.parseStatus]}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                            创建 {formatDate(file.createdAt)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                            更新 {formatDate(file.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        重新训练未接入；不会触发训练 runtime
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">错误信息：{file.safeFailureMessage || '暂无错误'}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>

        <aside aria-label="机构知识库运营建议风险提示" className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">运营建议 / 风险提示</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">基于当前可见数据给出基础提示，不伪装真实风控。</p>
          </div>
          <div className="space-y-3">
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold text-amber-800">低命中知识</h3>
              <p className="mt-1 text-xs leading-5 text-amber-700">{lowHitCount > 0 ? `当前有 ${lowHitCount} 条知识需要补片段或确认状态。` : '当前可见知识均有基础片段。'}</p>
            </article>
            <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
              <h3 className="text-sm font-semibold text-cyan-800">待补充资料</h3>
              <p className="mt-1 text-xs leading-5 text-cyan-700">如检索为空，请先补充 txt / md 资料并确认解析成功。</p>
            </article>
            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <h3 className="text-sm font-semibold text-rose-800">解析失败文件</h3>
              <p className="mt-1 text-xs leading-5 text-rose-700">{failedCount > 0 ? `当前有 ${failedCount} 个文件解析失败。` : '当前未发现解析失败文件。'}</p>
            </article>
            <article className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <h3 className="text-sm font-semibold text-violet-800">待训练内容</h3>
              <p className="mt-1 text-xs leading-5 text-violet-700">训练、AI 问答和向量能力仍为后续专项，不在本轮触发。</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-800">建议动作</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                <li>优先上传 txt / md 并确认解析状态。</li>
                <li>使用关键词检索验证片段是否可命中。</li>
                <li>后续再补审计、重新解析、删除和训练专项。</li>
              </ul>
            </article>
          </div>
        </aside>
      </div>
    </section>
  );
}
