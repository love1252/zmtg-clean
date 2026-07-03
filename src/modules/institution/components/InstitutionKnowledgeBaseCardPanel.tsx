'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  FileText,
  FolderPlus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type DirectoryId = 'all' | 'scripts' | 'projects' | 'aftercare' | 'campaigns' | 'training';

type KnowledgeEntry = {
  id: string;
  title: string;
  directoryId: Exclude<DirectoryId, 'all'>;
  folder: string;
  status: '待接入' | '待解析' | '已解析示例' | '待训练';
  updatedAt: string;
  hitHint: string;
  segmentLabel: string;
  summary: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  meta: string;
  parseStatus: '待解析' | '解析中' | '已解析' | '失败' | '待训练';
  characterLabel: string;
  updatedAt: string;
  error: string;
  actionState: string;
};

type TaskRecord = {
  id: string;
  name: string;
  status: '待解析' | '解析中' | '已解析' | '失败' | '待训练';
  createdAt: string;
  updatedAt: string;
  error: string;
  operation: string;
};

const directories: Array<{
  id: DirectoryId;
  label: string;
  count: number;
  description: string;
}> = [
  { id: 'all', label: '全部知识', count: 24, description: '受控示例目录汇总' },
  { id: 'scripts', label: '咨询话术', count: 7, description: '接待、咨询、复诊沟通' },
  { id: 'projects', label: '项目资料', count: 5, description: '项目说明与服务边界' },
  { id: 'aftercare', label: '术后护理', count: 4, description: '护理提醒与注意事项' },
  { id: 'campaigns', label: '活动政策', count: 3, description: '优惠、权益、活动口径' },
  { id: 'training', label: '培训资料', count: 5, description: '内部培训与操作 SOP' },
];

const metrics = [
  { label: '知识条目', value: '24', helper: '示例结构，待接入真实知识数据' },
  { label: '文件数', value: '18', helper: '受控 fallback，不读取文件存储' },
  { label: '已解析 / 待解析', value: '11 / 7', helper: '仅用于 UI 状态演示' },
  { label: '待优化 / 低命中', value: '6 / 3', helper: '运营提示示例，非真实风控' },
];

const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: 'consultation-opening-script',
    title: '初诊咨询接待标准话术',
    directoryId: 'scripts',
    folder: '咨询话术 / 初诊接待',
    status: '已解析示例',
    updatedAt: '2026-07-02 10:20',
    hitHint: '命中稳定；低命中提示为受控示例',
    segmentLabel: '片段数 16（示例）',
    summary: '用于演示咨询顾问接待流程、禁用承诺和转人工提醒的知识条目结构。',
  },
  {
    id: 'project-introduction-fallback',
    title: '光电项目说明与适用范围',
    directoryId: 'projects',
    folder: '项目资料 / 光电项目',
    status: '待接入',
    updatedAt: '2026-07-01 16:45',
    hitHint: '低命中：建议补充适用人群与禁忌说明',
    segmentLabel: '片段数待接入真实解析后展示',
    summary: '当前仅展示卡片字段，不代表真实项目资料已进入生产知识库。',
  },
  {
    id: 'aftercare-cold-compress',
    title: '术后冷敷护理提醒',
    directoryId: 'aftercare',
    folder: '术后护理 / 居家提醒',
    status: '待训练',
    updatedAt: '2026-06-30 09:10',
    hitHint: '待训练：后续接入真实训练任务后更新',
    segmentLabel: '受控 fallback：预计 8 个片段',
    summary: '示例摘要用于展示护理知识卡片，不触发训练、检索或 AI 调用。',
  },
  {
    id: 'campaign-rights-policy',
    title: '暑期活动权益说明',
    directoryId: 'campaigns',
    folder: '活动政策 / 暑期活动',
    status: '待解析',
    updatedAt: '2026-06-29 18:30',
    hitHint: '待解析：真实解析能力后续接入',
    segmentLabel: '片段数待解析',
    summary: '仅作为活动政策卡片排版样例，不代表活动规则已发布。',
  },
  {
    id: 'training-service-sop',
    title: '客服服务流程培训 SOP',
    directoryId: 'training',
    folder: '培训资料 / 服务流程',
    status: '已解析示例',
    updatedAt: '2026-06-28 14:15',
    hitHint: '命中偏低：建议补充异常场景问答',
    segmentLabel: '片段数 12（示例）',
    summary: '用于展示内部培训材料如何拆分为知识条目和任务记录。',
  },
];

const documentRecords: DocumentRecord[] = [
  {
    id: 'doc-consultation-script',
    name: '初诊咨询标准话术.md',
    meta: 'Markdown / 42 KB',
    parseStatus: '已解析',
    characterLabel: '解析字符数 18,420（示例）',
    updatedAt: '2026-07-02 10:20',
    error: '暂无错误',
    actionState: '操作待接入真实功能',
  },
  {
    id: 'doc-aftercare-pdf',
    name: '术后护理提醒.pdf',
    meta: 'PDF / 1.2 MB',
    parseStatus: '待训练',
    characterLabel: '解析字符数待接入真实解析后展示',
    updatedAt: '2026-06-30 09:10',
    error: '暂无错误',
    actionState: '训练入口受控禁用',
  },
  {
    id: 'doc-campaign-xlsx',
    name: '暑期活动权益表.xlsx',
    meta: 'Spreadsheet / 86 KB',
    parseStatus: '失败',
    characterLabel: '受控 fallback：未读取文件内容',
    updatedAt: '2026-06-29 18:30',
    error: '示例错误：文件结构需人工确认',
    actionState: '重新解析待接入真实功能',
  },
];

const taskRecords: TaskRecord[] = [
  {
    id: 'task-parse-consultation',
    name: '咨询话术解析任务',
    status: '已解析',
    createdAt: '2026-07-02 10:00',
    updatedAt: '2026-07-02 10:20',
    error: '暂无错误',
    operation: '仅展示状态样例，不代表真实任务已运行',
  },
  {
    id: 'task-parse-campaign',
    name: '活动政策文件解析任务',
    status: '失败',
    createdAt: '2026-06-29 18:00',
    updatedAt: '2026-06-29 18:30',
    error: '示例错误：字段格式不一致',
    operation: '需后续任务接入重新解析能力',
  },
  {
    id: 'task-train-aftercare',
    name: '术后护理知识训练任务',
    status: '待训练',
    createdAt: '2026-06-30 09:10',
    updatedAt: '2026-06-30 09:10',
    error: '暂无错误',
    operation: '训练按钮受控禁用，等待真实训练 runtime',
  },
  {
    id: 'task-parse-project',
    name: '项目资料解析任务',
    status: '解析中',
    createdAt: '2026-07-01 16:30',
    updatedAt: '2026-07-01 16:45',
    error: '暂无错误',
    operation: '进度为界面示例，不轮询后端',
  },
  {
    id: 'task-parse-new-policy',
    name: '新政策补充解析任务',
    status: '待解析',
    createdAt: '2026-07-03 09:00',
    updatedAt: '2026-07-03 09:00',
    error: '暂无错误',
    operation: '等待后续接入真实解析入口',
  },
];

const controlledActions = [
  { label: '上传文档', icon: Upload },
  { label: '新建知识', icon: BookOpen },
  { label: '新建文件夹', icon: FolderPlus },
  { label: '重新解析', icon: RefreshCw },
  { label: '重新训练', icon: RefreshCw },
  { label: '删除', icon: Trash2 },
];

const searchExamples = ['活动权益如何说明？', '术后冷敷需要注意什么？', '初诊咨询如何转人工？'];

function statusClassName(status: KnowledgeEntry['status'] | DocumentRecord['parseStatus'] | TaskRecord['status']) {
  if (status === '已解析' || status === '已解析示例') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === '失败') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === '解析中') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function ControlledButton({ label, icon: Icon }: { label: string; icon: typeof Upload }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label}（待接入真实功能）`}
      title="待接入真实功能"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function InstitutionKnowledgeBaseCardPanel() {
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<DirectoryId>('all');

  const selectedEntries = useMemo(() => {
    if (selectedDirectoryId === 'all') return knowledgeEntries;
    return knowledgeEntries.filter((entry) => entry.directoryId === selectedDirectoryId);
  }, [selectedDirectoryId]);

  const selectedDirectory = directories.find((directory) => directory.id === selectedDirectoryId) ?? directories[0];

  return (
    <section
      aria-label="机构知识库卡片功能壳"
      className="space-y-5 rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-7"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">机构端知识库功能壳</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">机构知识库</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            用于维护机构内部话术、项目说明、服务流程和培训知识。当前为受控运营视图，真实上传 / 解析 / 训练 / 检索能力后续接入。
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            以下内容为示例结构或受控 fallback，用于对齐机构端参考图的卡片布局，不伪装为生产数据。
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            受控说明
          </div>
          <p className="mt-1 text-xs leading-5">
            本组件不请求后端、不写库、不调用 AI / provider / search API，所有操作入口均为 disabled 或待接入说明。
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">受控操作入口</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              上传文档、新建知识、新建文件夹、重新解析、重新训练和删除均待接入真实功能，本轮不可执行。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {controlledActions.map((action) => (
              <ControlledButton key={action.label} label={action.label} icon={action.icon} />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside aria-label="机构知识目录" className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">知识目录</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">前端本地选中态切换，不请求后端。</p>
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
                  当前目录：{selectedDirectory.label}。条目为示例结构或待接入真实知识数据。
                </p>
              </div>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {selectedEntries.length} 条示例
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-normal text-slate-950">{entry.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          {entry.folder}
                        </span>
                        <span className={cn('rounded-full border px-2.5 py-1', statusClassName(entry.status))}>
                          {entry.status}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                          {entry.hitHint}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">更新于 {entry.updatedAt}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{entry.summary}</p>
                  <div className="mt-3 rounded-xl border border-white bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                    {entry.segmentLabel}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="机构知识库文件文档卡片" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">文件 / 文档</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">文件信息为受控示例，不做真实上传、解析或下载。</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {documentRecords.map((document) => (
                <article key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-950">{document.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{document.meta}</p>
                    </div>
                    <FileText className="h-5 w-5 shrink-0 text-cyan-600" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={cn('rounded-full border px-2.5 py-1', statusClassName(document.parseStatus))}>
                      {document.parseStatus}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                      {document.actionState}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                    <div>
                      <dt className="font-semibold text-slate-500">解析字符数</dt>
                      <dd>{document.characterLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">更新时间</dt>
                      <dd>{document.updatedAt}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">错误信息</dt>
                      <dd>{document.error}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="机构知识库检索测试卡片" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">检索测试</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">真实检索测试能力待接入，不调用 AI / provider / search API。</p>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed"
              >
                <Search className="h-4 w-4" />
                开始检索测试
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">只读输入壳</span>
              <input
                readOnly
                value="术后冷敷需要注意什么？"
                aria-label="知识库检索测试只读输入"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {searchExamples.map((example) => (
                <span key={example} className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                  示例问题：{example}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              检索结果区域：当前仅展示空状态。后续接入真实检索测试后，再展示命中知识、引用片段、分数和人工复核提示。
            </div>
          </section>

          <section aria-label="机构知识库解析训练任务记录" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">解析 / 训练任务记录</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">任务记录为受控示例，不轮询任务队列。</p>
            </div>
            <div className="mt-4 grid gap-3">
              {taskRecords.map((task) => (
                <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">{task.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className={cn('rounded-full border px-2.5 py-1', statusClassName(task.status))}>
                          {task.status}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          创建 {task.createdAt}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          更新 {task.updatedAt}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {task.operation}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">错误信息：{task.error}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside aria-label="机构知识库运营建议风险提示" className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">运营建议 / 风险提示</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">全部为受控示例或 fallback，不伪装真实风控。</p>
          </div>
          <div className="space-y-3">
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold text-amber-800">低命中知识</h3>
              <p className="mt-1 text-xs leading-5 text-amber-700">项目说明和培训 SOP 示例命中偏低，建议补充常见问法。</p>
            </article>
            <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
              <h3 className="text-sm font-semibold text-cyan-800">待补充资料</h3>
              <p className="mt-1 text-xs leading-5 text-cyan-700">活动政策缺少生效时间、适用门店和人工确认口径。</p>
            </article>
            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <h3 className="text-sm font-semibold text-rose-800">解析失败文件</h3>
              <p className="mt-1 text-xs leading-5 text-rose-700">暑期活动权益表为示例失败状态，需后续接入真实错误归因。</p>
            </article>
            <article className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <h3 className="text-sm font-semibold text-violet-800">待训练内容</h3>
              <p className="mt-1 text-xs leading-5 text-violet-700">术后护理条目处于待训练展示状态，当前不会触发训练 runtime。</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-800">建议动作</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                <li>先由运营确认目录、卡片字段和空状态。</li>
                <li>后续单独任务接入机构端页面。</li>
                <li>真实能力接入前保持按钮禁用和受控说明。</li>
              </ul>
            </article>
          </div>
        </aside>
      </div>
    </section>
  );
}
